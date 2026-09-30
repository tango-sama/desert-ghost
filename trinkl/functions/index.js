/* ───────────────────────────────────────────────────────────────
   Desert Shop — Cloud Functions
   createYalidineParcel: called from the admin panel when an order is
   confirmed. Reads the order from Firestore, calls the Yalidine API to
   create a parcel (bordereau), and writes the tracking number back.

   Credentials are entered in the admin Settings page and stored in the
   server-only Firestore doc `private/yalidine` ({ apiId, apiToken }), which
   clients cannot read (see firestore.rules). The Admin SDK below bypasses
   those rules. Origin wilaya is read from the `originWilaya` field of the
   single site_settings document (also set in the admin Settings page).
   ─────────────────────────────────────────────────────────────── */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
// Hoisted to the top with the other module requires: `refreshAllParcels`
// below registers well above the notifications section this used to sit in,
// and a `const` require is in TDZ until its own line runs.
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

admin.initializeApp();

const API_BASE = 'https://api.yalidine.app/v1';

exports.createYalidineParcel = onCall(
  { region: 'us-central1' },
  async (req) => {
    const orderId = req.data && req.data.orderId;
    if (!orderId) throw new HttpsError('invalid-argument', 'orderId is required');

    const db = admin.firestore();
    const ref = db.collection('orders').doc(String(orderId));
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Order not found');
    const o = snap.data();

    // Already created? return existing tracking (idempotent).
    if (o.yalidine && o.yalidine.tracking) {
      return { alreadyCreated: true, tracking: o.yalidine.tracking, label: o.yalidine.label || null };
    }

    // Origin wilaya from settings.
    const setSnap = await db.collection('site_settings').limit(1).get();
    const settings = setSnap.empty ? {} : setSnap.docs[0].data();
    const fromWilaya = String(settings.originWilaya || '').trim();
    if (!fromWilaya) {
      throw new HttpsError('failed-precondition', 'حدّدي ولاية الإرسال (originWilaya) في إعدادات لوحة التحكم أولاً.');
    }

    // Yalidine API credentials from the server-only private doc.
    const credSnap = await db.collection('private').doc('yalidine').get();
    const cred = credSnap.exists ? credSnap.data() : {};
    const apiId = String(cred.apiId || '').trim();
    const apiToken = String(cred.apiToken || '').trim();
    if (!apiId || !apiToken) {
      throw new HttpsError('failed-precondition', 'أدخلي API ID و API Token الخاصين بـ Yalidine في إعدادات لوحة التحكم أولاً.');
    }

    const headers = {
      'X-API-ID': apiId,
      'X-API-TOKEN': apiToken,
      'Content-Type': 'application/json',
    };

    // Stopdesk: pick a Yalidine center in the destination wilaya. The center's
    // commune (not the customer's) must be used as to_commune_name, otherwise
    // Yalidine rejects with "stopdesk_id does not belong to to_commune_name".
    const isStopdesk = (o.deliveryType === 'office' || o.deliveryType === 'desk');
    let stopdeskCenter = null;
    if (isStopdesk && o.wilayaId) {
      try {
        const cRes = await fetch(`${API_BASE}/centers/?wilaya_id=${encodeURIComponent(o.wilayaId)}`, { headers });
        if (cRes.ok) {
          const cj = await cRes.json();
          const centers = (cj && cj.data) || [];
          if (centers.length) {
            // The desk actually chosen, recorded on the order as Yalidine's own
            // center_id (Order.deskId/deskCarrier in the shop). Only an id
            // recorded against Yalidine is usable — center ids are per-carrier.
            const ownDesk = String(o.deskCarrier || '') === 'yalidine' && o.deskId != null
              ? String(o.deskId).trim()
              : '';
            const wanted = String(o.communeFr || o.baladiya || '').toLowerCase().trim();
            stopdeskCenter =
              (ownDesk && centers.find(function (c) { return String(c.center_id) === ownDesk; })) ||
              centers.find(function (c) { return String(c.commune_name || '').toLowerCase().trim() === wanted; }) ||
              centers[0];
          }
        }
      } catch (e) { /* fall back to home delivery below */ }
    }

    // Split full name into first / family.
    const fullName = String(o.customer || '').trim();
    const parts = fullName.split(/\s+/).filter(Boolean);
    const firstname = parts.shift() || fullName || '—';
    const familyname = parts.join(' ') || firstname;

    const productList = (o.deliveryLabel && String(o.deliveryLabel).trim())
      ? String(o.deliveryLabel).trim().slice(0, 250)
      : ((o.items || []).map((it) => `${it.title} x${it.qty || 1}`).join(', ') || 'منتجات').slice(0, 250);
    // Yalidine's `price` is the PRODUCT value only: it independently computes
    // its own freight from destination/weight and adds it on top to get what
    // the driver collects. `parcelPrice` / `total` already include OUR
    // deliveryFee estimate, so sending them as-is charges delivery twice.
    // Strip our fee back out. The bare `subtotal` fallback never had delivery
    // baked in, so it is left alone.
    const desiredTotal = Number(o.parcelPrice != null ? o.parcelPrice : (o.total != null ? o.total : o.subtotal)) || 0;
    const includesDelivery = o.parcelPrice != null || o.total != null;
    const ourDeliveryFee = includesDelivery ? (Number(o.deliveryFee) || 0) : 0;
    const codPrice = Math.max(0, desiredTotal - ourDeliveryFee);
    const useStopdesk = isStopdesk && !!stopdeskCenter;

    const parcel = {
      order_id: String(o.num || orderId),
      from_wilaya_name: fromWilaya,
      firstname,
      familyname,
      contact_phone: String(o.phone || '').replace(/\s/g, ''),
      address: [String(o.address || '').trim(), `${o.baladiya || ''} - ${o.wilaya || ''}`.trim()].filter(Boolean).join(' - '),
      to_commune_name: useStopdesk ? stopdeskCenter.commune_name : (o.communeFr || o.baladiya || ''),
      to_wilaya_name: useStopdesk ? (stopdeskCenter.wilaya_name || o.wilayaFr || o.wilaya) : (o.wilayaFr || o.wilaya || ''),
      product_list: productList,
      price: codPrice,
      do_insurance: o.insurance === true,
      declared_value: codPrice,
      length: 0, width: 0, height: 0, weight: 1,
      freeshipping: false,
      is_stopdesk: useStopdesk,
      stopdesk_id: useStopdesk ? stopdeskCenter.center_id : null,
      has_exchange: false,
      product_to_collect: null,
    };

    let res, text;
    try {
      res = await fetch(`${API_BASE}/parcels/`, { method: 'POST', headers, body: JSON.stringify([parcel]) });
      text = await res.text();
    } catch (e) {
      throw new HttpsError('unavailable', 'تعذّر الاتصال بـ Yalidine: ' + e.message);
    }
    let body; try { body = JSON.parse(text); } catch (e) { body = text; }
    if (!res.ok) {
      throw new HttpsError('internal', 'Yalidine API error (' + res.status + '): ' + (typeof body === 'string' ? body : JSON.stringify(body)));
    }

    // Response is keyed by order_id: { "<order_id>": { success, tracking, label, ... } }
    let entry = null;
    if (body && typeof body === 'object') entry = body[Object.keys(body)[0]];
    if (!entry || entry.success === false) {
      throw new HttpsError('internal', 'رفضت Yalidine الطرد: ' + JSON.stringify(entry || body));
    }

    const tracking = entry.tracking || null;
    const labelUrl = entry.label || entry.labels || null;

    await ref.update({
      yalidine: { tracking, label: labelUrl, stopdesk: useStopdesk, createdAt: Date.now() },
      status: 'Confirmed',
      fulfilled: true,
      // Canonical lifecycle state (see outcomeFromStatus below). Set here so
      // an order counts as confirmed the moment a parcel exists, rather than
      // waiting for the first tracking refresh to classify it.
      outcome: 'confirmed',
      outcomeAt: Date.now(),
    });

    return { ok: true, tracking, label: labelUrl };
  }
);

/* ───────────────────────────────────────────────────────────────
   cancelYalidineParcel: called from the admin panel's "تعليم كجديد"
   (mark as new) flow before it resets the order locally, so a
   cancelled order doesn't keep shipping behind the admin's back.
   Yalidine only allows deleting a parcel while it's still "En
   préparation" (not yet picked up) — past that point the API refuses
   and it has to be cancelled from Yalidine's own dashboard instead.
   ─────────────────────────────────────────────────────────────── */
exports.cancelYalidineParcel = onCall(
  { region: 'us-central1' },
  async (req) => {
    const orderId = req.data && req.data.orderId;
    if (!orderId) throw new HttpsError('invalid-argument', 'orderId is required');

    const db = admin.firestore();
    const ref = db.collection('orders').doc(String(orderId));
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Order not found');
    const o = snap.data();

    const tracking = o.yalidine && o.yalidine.tracking;
    if (!tracking) return { ok: true, skipped: true };

    const credSnap = await db.collection('private').doc('yalidine').get();
    const cred = credSnap.exists ? credSnap.data() : {};
    const apiId = String(cred.apiId || '').trim();
    const apiToken = String(cred.apiToken || '').trim();
    if (!apiId || !apiToken) {
      throw new HttpsError('failed-precondition', 'أدخلي API ID و API Token الخاصين بـ Yalidine في إعدادات لوحة التحكم أولاً.');
    }
    const headers = { 'X-API-ID': apiId, 'X-API-TOKEN': apiToken, 'Content-Type': 'application/json' };

    let res, text;
    try {
      res = await fetch(`${API_BASE}/parcels/${encodeURIComponent(tracking)}`, { method: 'DELETE', headers });
      text = await res.text();
    } catch (e) {
      throw new HttpsError('unavailable', 'تعذّر الاتصال بـ Yalidine: ' + e.message);
    }
    let body; try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
    // Already gone (e.g. deleted directly from Yalidine's own dashboard) is the
    // end state we want anyway — treat it as success, not a failure to report.
    if (res.status === 404) {
      await ref.update({ yalidine: admin.firestore.FieldValue.delete() });
      return { ok: true, tracking, alreadyGone: true };
    }
    // Response is an array with a single { tracking, deleted } result.
    const entry = Array.isArray(body) ? body[0] : body;
    const deleted = !!(entry && entry.deleted);
    if (!res.ok || !deleted) {
      throw new HttpsError(
        'failed-precondition',
        'تعذّر إلغاء طرد Yalidine — على الأرجح بدأ الشحن بالفعل. يمكن إلغاؤه يدوياً من لوحة تحكم Yalidine: ' +
          (typeof body === 'string' ? body : JSON.stringify(body || {}))
      );
    }

    await ref.update({ yalidine: admin.firestore.FieldValue.delete() });
    return { ok: true, tracking };
  }
);

/* ───────────────────────────────────────────────────────────────
   createNoestParcel: same flow for Noest (app.noest-dz.com).
   Credentials live in private/noest ({ apiToken, userGuid }). Noest's
   account already knows the origin, so no origin wilaya is needed.
   The order is created and then validated so it reaches logistics.
   ─────────────────────────────────────────────────────────────── */
const NOEST_BASE = 'https://app.noest-dz.com';

// Noest sits behind an nginx/WAF that intermittently answers a bare
// "403 Forbidden" HTML page to server-side requests (default Node/undici
// User-Agent, bursts, datacenter IPs). That page never reaches the API, so it
// is safe to retry for every call. 5xx/429 are retried too, except for
// non-idempotent creates where a 5xx may have already created the parcel
// (opts.idempotent === false → only 403/429, which are rejected up front).
const NOEST_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
async function noestFetch(url, init, opts) {
  init = init || {};
  const idempotent = !(opts && opts.idempotent === false);
  const retryOn = idempotent ? [403, 429, 502, 503, 504] : [403, 429];
  const headers = Object.assign({ 'User-Agent': NOEST_UA }, init.headers || {});
  let res;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      res = await fetch(url, Object.assign({}, init, { headers }));
    } catch (e) {
      if (!idempotent || attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
      continue;
    }
    if (!retryOn.includes(res.status) || attempt === 3) return res;
    await new Promise((r) => setTimeout(r, 700 * (attempt + 1) + Math.random() * 300));
  }
  return res;
}
// Short message for error toasts: never show a raw HTML error page.
function noestErrText(body, status) {
  if (typeof body === 'string' && /<html|<body/i.test(body)) {
    return 'Noest رفض الطلب مؤقتاً (HTTP ' + status + ') — أعيدي المحاولة بعد لحظات.';
  }
  return typeof body === 'string' ? body : JSON.stringify(body || {});
}

exports.createNoestParcel = onCall(
  { region: 'us-central1' },
  async (req) => {
    const orderId = req.data && req.data.orderId;
    if (!orderId) throw new HttpsError('invalid-argument', 'orderId is required');

    const db = admin.firestore();
    const ref = db.collection('orders').doc(String(orderId));
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Order not found');
    const o = snap.data();

    if (o.noest && o.noest.tracking) {
      return { alreadyCreated: true, tracking: o.noest.tracking };
    }
    if (!o.wilayaId) {
      throw new HttpsError('failed-precondition', 'الطلب لا يحتوي على رقم ولاية صالح.');
    }

    const credSnap = await db.collection('private').doc('noest').get();
    const cred = credSnap.exists ? credSnap.data() : {};
    const token = String(cred.apiToken || '').trim();
    const guid = String(cred.userGuid || '').trim();
    if (!token || !guid) {
      throw new HttpsError('failed-precondition', 'أدخلي API Token و user_guid الخاصين بـ Noest في إعدادات لوحة التحكم أولاً.');
    }

    const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json' };

    // Stopdesk needs a station code in the destination wilaya. Prefer a desk
    // in the customer's commune; fall back to the wilaya's first desk.
    const isStopdesk = (o.deliveryType === 'office' || o.deliveryType === 'desk');
    let stationCode = null;
    // The desk actually chosen, recorded on the order as Noest's own station
    // `code` (Order.deskId/deskCarrier in the shop — noestCenters syncs the
    // code as each desk's id). Only an id recorded against Noest is usable.
    if (isStopdesk && String(o.deskCarrier || '') === 'noest' && o.deskId != null && String(o.deskId).trim()) {
      stationCode = String(o.deskId).trim();
    }
    if (isStopdesk && !stationCode) {
      try {
        const dRes = await noestFetch(NOEST_BASE + '/api/public/desks', { headers });
        if (dRes.ok) {
          const desks = await dRes.json();
          const norm = (s) => String(s || '').toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim();
          const wantCommune = norm(o.communeFr || o.baladiya);
          let first = null;
          for (const k in desks) {
            const d = desks[k] || {};
            const code = String(d.code || '');
            const m = code.match(/^(\d+)/);
            if (!m || parseInt(m[1], 10) !== Number(o.wilayaId)) continue;
            if (!first) first = code;
            if (wantCommune) {
              const hay = norm([d.commune, d.commune_name, d.name, d.station_name, d.address, d.adresse]
                .filter(Boolean).join(' '));
              if (hay && (hay.includes(wantCommune) || wantCommune.includes(hay))) { stationCode = code; break; }
            }
          }
          if (!stationCode) stationCode = first;
        }
      } catch (e) { /* fall back to home delivery */ }
    }
    const useStopdesk = isStopdesk && !!stationCode;

    const productList = (o.deliveryLabel && String(o.deliveryLabel).trim())
      ? String(o.deliveryLabel).trim().slice(0, 250)
      : ((o.items || []).map((it) => `${it.title} x${it.qty || 1}`).join(', ') || 'منتجات').slice(0, 250);
    const montant = Number(o.parcelPrice != null ? o.parcelPrice : (o.total != null ? o.total : o.subtotal)) || 0;

    const payload = {
      user_guid: guid,
      reference: String(o.num || ('DS-' + orderId)),
      client: (String(o.customer || '').trim() || '—').slice(0, 255),
      phone: String(o.phone || '').replace(/\s/g, ''),
      adresse: [String(o.address || '').trim(), `${o.baladiya || ''} - ${o.wilaya || ''}`.trim()].filter(Boolean).join(' - ').slice(0, 255) || String(o.wilaya || '—'),
      wilaya_id: Number(o.wilayaId),
      commune: o.communeFr || o.baladiya || '',
      montant: montant,
      produit: productList,
      type_id: 1,
      poids: 1,
      stop_desk: useStopdesk ? 1 : 0,
    };
    if (useStopdesk) payload.station_code = stationCode;

    let res, text;
    try {
      res = await noestFetch(NOEST_BASE + '/api/public/create/order', { method: 'POST', headers, body: JSON.stringify(payload) }, { idempotent: false });
      text = await res.text();
    } catch (e) {
      throw new HttpsError('unavailable', 'تعذّر الاتصال بـ Noest: ' + e.message);
    }
    let body; try { body = JSON.parse(text); } catch (e) { body = text; }
    if (!res.ok || !body || body.success !== true || !body.tracking) {
      throw new HttpsError('internal', 'فشل إنشاء طلب Noest: ' + noestErrText(body, res.status));
    }
    const tracking = body.tracking;

    // Do NOT auto-validate. Validating locks the order and moves it into Noest's
    // "en traitement". Leaving it unvalidated keeps it in "prêt à expédier" so the
    // seller can review and validate/ship it from Noest when ready.
    await ref.update({
      noest: { tracking, validated: false, stopdesk: useStopdesk, createdAt: Date.now() },
      status: 'Confirmed',
      fulfilled: true,
      // Canonical lifecycle state (see outcomeFromStatus below). Set here so
      // an order counts as confirmed the moment a parcel exists, rather than
      // waiting for the first tracking refresh to classify it.
      outcome: 'confirmed',
      outcomeAt: Date.now(),
    });

    return { ok: true, tracking, validated: false };
  }
);

/* ───────────────────────────────────────────────────────────────
   cancelNoestParcel: POST /api/public/delete/order with
   { tracking, user_guid }, same auth as createNoestParcel.
   ─────────────────────────────────────────────────────────────── */
exports.cancelNoestParcel = onCall(
  { region: 'us-central1' },
  async (req) => {
    const orderId = req.data && req.data.orderId;
    if (!orderId) throw new HttpsError('invalid-argument', 'orderId is required');

    const db = admin.firestore();
    const ref = db.collection('orders').doc(String(orderId));
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Order not found');
    const o = snap.data();

    const tracking = o.noest && o.noest.tracking;
    if (!tracking) return { ok: true, skipped: true };

    const credSnap = await db.collection('private').doc('noest').get();
    const cred = credSnap.exists ? credSnap.data() : {};
    const token = String(cred.apiToken || '').trim();
    const guid = String(cred.userGuid || '').trim();
    if (!token || !guid) {
      throw new HttpsError('failed-precondition', 'أدخلي API Token و user_guid الخاصين بـ Noest في إعدادات لوحة التحكم أولاً.');
    }
    const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json' };

    let res, text;
    try {
      res = await noestFetch(NOEST_BASE + '/api/public/delete/order', {
        method: 'POST', headers,
        body: JSON.stringify({ tracking, user_guid: guid }),
      });
      text = await res.text();
    } catch (e) {
      throw new HttpsError('unavailable', 'تعذّر الاتصال بـ Noest: ' + e.message);
    }
    let body; try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
    // Already gone (e.g. deleted directly from Noest's own dashboard) is the end
    // state we want anyway — treat it as success. Noest's tracking-info endpoint
    // answers "not found" as a 200 with a French message rather than a real HTTP
    // 404 (see fetchNoestStatus above), so check both shapes defensively.
    const notFound = res.status === 404 ||
      (body && typeof body === 'object' && /trouv|not\s*found/i.test(String(body.message || '')));
    if (notFound) {
      await ref.update({ noest: admin.firestore.FieldValue.delete() });
      return { ok: true, tracking, alreadyGone: true };
    }
    if ([403, 429, 502, 503, 504].includes(res.status)) {
      throw new HttpsError('unavailable', 'Noest: ' + noestErrText(body, res.status));
    }
    if (!res.ok || (body && body.success === false)) {
      throw new HttpsError(
        'failed-precondition',
        'تعذّر إلغاء طرد Noest — تحققي من حالته في لوحة Noest: ' +
          noestErrText(body, res.status)
      );
    }

    await ref.update({ noest: admin.firestore.FieldValue.delete() });
    return { ok: true, tracking };
  }
);

/* ───────────────────────────────────────────────────────────────
   createZrParcel: same flow for ZR Express (api.zrexpress.app — their
   current tenant-based platform, generated via the portal's "API Rest
   → Token API"). Credentials live in private/zrexpress ({ tenantId,
   secretKey }), sent as the X-Tenant / X-Api-Key headers. Unlike
   Yalidine/Noest, ZR Express addresses need territory UUIDs instead of
   plain wilaya/commune names, so the destination is looked up live
   against ZR Express's own territory list right before creating the
   parcel — the same idea as the Yalidine center / Noest desk lookups
   above, just against a different API.
   ─────────────────────────────────────────────────────────────── */
const ZR_BASE = 'https://api.zrexpress.app/api/v1';

// 0XXXXXXXXX → +213XXXXXXXXX (ZR Express wants international format).
function zrPhone(p) {
  let d = String(p || '').replace(/[^\d]/g, '');
  if (d.startsWith('213')) return '+' + d;
  if (d.startsWith('0')) d = d.slice(1);
  return '+213' + d;
}

// A throwaway-but-valid UUID v4 (ZR Express requires a customerId even without a stored customer).
function zrUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0; const v = c === 'x' ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
  });
}

// Parse a ZR error body into a readable message (error.errors[] / detail / title / raw).
// `errors` (their per-field validation details, e.g. "phone: invalid format") is checked
// FIRST — `detail` on a 400 is just the generic wrapper text ("One or more validation
// errors occurred") and hides exactly what was wrong if returned instead.
function zrErrMsg(body, status) {
  if (!body) return 'HTTP ' + status;
  if (typeof body === 'string') return body || ('HTTP ' + status);
  if (body.errors) {
    let msg = '';
    if (Array.isArray(body.errors)) msg = body.errors.map((e) => (e && (e.message || e.description)) || JSON.stringify(e)).join('; ');
    else { try { msg = Object.entries(body.errors).map(([k, v]) => k + ': ' + (Array.isArray(v) ? v.join(', ') : v)).join('; '); } catch (e) { /* fall through */ } }
    if (msg) return msg;
  }
  if (body.detail) return String(body.detail);
  return String(body.title || ('HTTP ' + status));
}

// fetch + parse JSON-or-text in one go.
async function zrFetch(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let body; try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
  return { res, body };
}

async function zrCreds(db) {
  const credSnap = await db.collection('private').doc('zrexpress').get();
  const cred = credSnap.exists ? credSnap.data() : {};
  const tenantId = String(cred.tenantId || '').trim();
  const secretKey = String(cred.secretKey || '').trim();
  if (!tenantId || !secretKey) {
    throw new HttpsError('failed-precondition', 'أدخلي Tenant ID و Secret Key الخاصين بـ ZR Express في إعدادات لوحة التحكم أولاً.');
  }
  return { tenantId, secretKey };
}
function zrHeaders(c) { return { 'X-Tenant': c.tenantId, 'X-Api-Key': c.secretKey, 'Content-Type': 'application/json' }; }

// ZR Express caps pageSize at 1000, but the territory table (58 wilayas + ~1,540
// communes) has more rows than that — fetch every page rather than one oversized
// request, which the API rejects outright.
async function zrAllTerritories(headers) {
  const rows = [];
  for (let pageNumber = 1; ; pageNumber++) {
    const { res, body } = await zrFetch(ZR_BASE + '/territories/search', {
      method: 'POST', headers,
      body: JSON.stringify({ pageNumber, pageSize: 1000, orderBy: ['code asc'] }),
    });
    if (!res.ok) throw new HttpsError('unavailable', 'تعذّر جلب قائمة ولايات ZR Express: ' + zrErrMsg(body, res.status));
    const page = (body && (body.items || body.data || body.results)) || [];
    rows.push(...page);
    if (!body || !body.hasNext || page.length === 0) break;
  }
  return rows;
}

// ZR Express DOES expose real prices via GET /delivery-pricing/rates
// (deliveryType 'home' | 'pickup-point'; priority logic already applied by ZR).
// Rates are per-territory (mostly commune-level); collapse them to one
// [home, desk] per wilaya so the storefront's per-wilaya fee lookups get ZR's
// true prices instead of a borrowed grid. `rows` is ZR's territory list, used to
// map each priced territory back to its wilaya `code`. Returns {} on any failure
// so the caller can fall back to the old placeholder grid rather than zero fees.
async function zrFeeTable(headers, rows) {
  const wCodeById = {};
  rows.forEach((t) => { if (t.level === 'wilaya' && Number(t.code)) wCodeById[t.id] = Number(t.code); });
  rows.forEach((t) => { if (t.level === 'commune' && t.parentId && wCodeById[t.parentId] != null) wCodeById[t.id] = wCodeById[t.parentId]; });

  const { res, body } = await zrFetch(ZR_BASE + '/delivery-pricing/rates', { method: 'GET', headers });
  if (!res.ok) return {};

  const agg = {}; // wilaya code -> { home: {price:count}, desk: {price:count} }
  ((body && body.rates) || []).forEach((r) => {
    const code = wCodeById[r.toTerritoryId];
    if (!code) return;
    (agg[code] = agg[code] || { home: {}, desk: {} });
    (r.deliveryPrices || []).forEach((d) => {
      const p = d.discountedPrice != null ? d.discountedPrice : d.price;
      if (typeof p !== 'number' || p <= 0) return; // ignore 0 / missing prices
      if (d.deliveryType === 'home') agg[code].home[p] = (agg[code].home[p] || 0) + 1;
      else if (d.deliveryType === 'pickup-point') agg[code].desk[p] = (agg[code].desk[p] || 0) + 1;
    });
  });

  // Most common price per wilaya (communes are uniform in practice); ties -> higher.
  const mode = (m) => {
    const e = Object.entries(m);
    if (!e.length) return null;
    e.sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]));
    return Number(e[0][0]);
  };
  const table = {};
  Object.keys(agg).forEach((code) => {
    const home = mode(agg[code].home), desk = mode(agg[code].desk);
    const h = home != null ? home : desk; // if one side is missing, reuse the other
    const d = desk != null ? desk : home; // so no delivery type is ever free
    if (h != null && d != null) table[code] = [h, d];
  });
  return table;
}

// Destination wilaya/commune territory UUIDs, resolved live from ZR Express's own
// territory list (mirrors the Yalidine-center / Noest-desk lookups above).
async function zrResolveTerritory(headers, wilayaCode, communeName) {
  const rows = await zrAllTerritories(headers);
  const wRow = rows.find((t) => t.level === 'wilaya' && Number(t.code) === Number(wilayaCode));
  if (!wRow) throw new HttpsError('failed-precondition', 'ولاية الزبون غير مدعومة لدى ZR Express — حدّثي قوائم التوصيل.');

  const norm = (s) => String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim();
  const wanted = norm(communeName);
  const communeRows = rows.filter((t) => t.level === 'commune' && t.parentId === wRow.id);
  // NO "first commune in the wilaya" fallback: ZR accepts such a parcel and
  // then delivers it to a commune nobody chose, with nothing to notice. An
  // unmatched commune is a real failure — surface it so the admin fixes the
  // destination (the panel's destination popup) instead of the parcel quietly
  // going to the wrong place.
  const cRow = communeRows.find((t) => norm(t.name) === wanted) ||
    communeRows.find((t) => wanted && (norm(t.name).includes(wanted) || wanted.includes(norm(t.name))));
  if (!cRow) {
    throw new HttpsError(
      'failed-precondition',
      'لم يُعثر على بلدية «' + String(communeName || '—') + '» ضمن بلديات ZR Express في هذه الولاية — صحّحي وجهة الطلب ثم أعيدي المحاولة.'
    );
  }

  const hasPickup = communeRows.some((t) => t.delivery && t.delivery.hasPickupPoint);
  return { cityTerritoryId: wRow.id, districtTerritoryId: cRow.id, hasPickup };
}

// Pickup-point (stopdesk) parcels need a hubId in the destination wilaya; falls back to
// home delivery if none is found (same fallback style as the Yalidine/Noest lookups).
async function zrFindHub(headers, cityTerritoryId) {
  try {
    const { res, body } = await zrFetch(ZR_BASE + '/hubs/search', {
      method: 'POST', headers, body: JSON.stringify({ pageNumber: 1, pageSize: 1000 }),
    });
    if (!res.ok) return null;
    const hubs = (body && (body.items || body.data || body.results)) || [];
    const hit = hubs.find((h) => h && h.isPickupPoint && h.address && String(h.address.cityTerritoryId) === String(cityTerritoryId));
    return hit ? hit.id : null;
  } catch (e) { return null; }
}

exports.createZrParcel = onCall(
  { region: 'us-central1' },
  async (req) => {
    const orderId = req.data && req.data.orderId;
    if (!orderId) throw new HttpsError('invalid-argument', 'orderId is required');

    const db = admin.firestore();
    const ref = db.collection('orders').doc(String(orderId));
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Order not found');
    const o = snap.data();

    if (o.zr && o.zr.tracking) {
      return { alreadyCreated: true, tracking: o.zr.tracking };
    }
    if (!o.wilayaId) throw new HttpsError('failed-precondition', 'الطلب لا يحتوي على رقم ولاية صالح.');

    const cred = await zrCreds(db);
    const headers = zrHeaders(cred);

    const isStopdesk = (o.deliveryType === 'office' || o.deliveryType === 'desk');
    const territory = await zrResolveTerritory(headers, o.wilayaId, o.communeFr || o.baladiya);

    let deliveryType = 'home', hubId = null;
    if (isStopdesk) {
      // The desk the customer (or the admin) actually picked, recorded on the
      // order as ZR's own hub id — see Order.deskId/deskCarrier in the shop.
      // Without it zrFindHub below can only return the FIRST pickup hub in the
      // whole wilaya, which is how every stop-desk parcel used to end up at the
      // same office regardless of what was chosen. Only an id recorded against
      // ZR is usable: hub ids mean nothing in Yalidine's or Noest's networks.
      const ownDesk = String(o.deskCarrier || '') === 'zr' && o.deskId != null
        ? String(o.deskId).trim()
        : '';
      if (ownDesk) hubId = ownDesk;
      else if (territory.hasPickup) hubId = await zrFindHub(headers, territory.cityTerritoryId);
      if (hubId) deliveryType = 'pickup-point';
    }
    const useStopdesk = deliveryType === 'pickup-point';

    // ZR limits orderedProducts[].productName to 2–100 chars (description takes 250).
    const productList = (o.deliveryLabel && String(o.deliveryLabel).trim())
      ? String(o.deliveryLabel).trim().slice(0, 250)
      : ((o.items || []).map((it) => `${it.title} x${it.qty || 1}`).join(', ') || 'منتجات').slice(0, 250);
    const amount = Math.max(0, Math.min(150000, Math.round(Number(o.parcelPrice != null ? o.parcelPrice : (o.total != null ? o.total : o.subtotal)) || 0)));

    const payload = {
      customer: {
        customerId: zrUuid(),
        name: (String(o.customer || '').trim() || 'Client').slice(0, 100).padEnd(2, '.'),
        phone: { number1: zrPhone(o.phone) },
      },
      deliveryAddress: {
        cityTerritoryId: territory.cityTerritoryId,
        districtTerritoryId: territory.districtTerritoryId,
        // Stop Desk orders carry no home address (the shop only saves one for
        // home delivery), so fall back to where the parcel is actually going.
        street: (String(o.address || '').trim() || String(o.baladiya || '').trim() ||
          String(o.communeFr || '').trim() || '—').slice(0, 200),
      },
      orderedProducts: [{
        productName: productList.slice(0, 100).padEnd(2, '.'), unitPrice: amount, quantity: 1, stockType: 'none',
        length: 20, width: 10, height: 1, weight: 1,
      }],
      amount,
      description: productList,
      deliveryType,
      externalId: String(o.num || orderId).slice(0, 100),
    };
    if (useStopdesk && hubId) payload.hubId = hubId;

    const { res, body } = await zrFetch(ZR_BASE + '/parcels', { method: 'POST', headers, body: JSON.stringify(payload) });
    if (!(res.status === 201 || res.ok) || !body || !body.id) {
      throw new HttpsError('internal', 'رفضت ZR Express الطرد: ' + zrErrMsg(body, res.status));
    }
    const parcelId = body.id;

    // The create response only returns the parcel id; fetch the tracking number
    // by that id. If this fails, refreshing status later (fetchZrStatus) also
    // looks up by parcelId and heals o.zr.tracking once it succeeds.
    let tracking = null;
    try {
      const { res: pRes, body: pBody } = await zrFetch(ZR_BASE + '/parcels/' + parcelId, { method: 'GET', headers });
      if (pRes.ok) tracking = pBody.trackingNumber || null;
    } catch (e) { /* tracking fills in on the next status refresh */ }

    await ref.update({
      zr: { tracking: tracking || parcelId, parcelId, stopdesk: useStopdesk, createdAt: Date.now() },
      status: 'Confirmed',
      fulfilled: true,
      // Canonical lifecycle state (see outcomeFromStatus below). Set here so
      // an order counts as confirmed the moment a parcel exists, rather than
      // waiting for the first tracking refresh to classify it.
      outcome: 'confirmed',
      outcomeAt: Date.now(),
    });

    return { ok: true, tracking: tracking || parcelId };
  }
);

/* ───────────────────────────────────────────────────────────────
   cancelZrParcel: DELETE /parcels/{id} using ZR Express's OWN internal
   parcel id (stored as o.zr.parcelId at creation — NOT the tracking
   number). ZR refuses to delete exchange/return parcels, and 404s on
   an unknown/already-deleted id.
   ─────────────────────────────────────────────────────────────── */
exports.cancelZrParcel = onCall(
  { region: 'us-central1' },
  async (req) => {
    const orderId = req.data && req.data.orderId;
    if (!orderId) throw new HttpsError('invalid-argument', 'orderId is required');

    const db = admin.firestore();
    const ref = db.collection('orders').doc(String(orderId));
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Order not found');
    const o = snap.data();

    const parcelId = o.zr && (o.zr.parcelId || o.zr.tracking);
    if (!parcelId) return { ok: true, skipped: true };

    const cred = await zrCreds(db);
    const headers = zrHeaders(cred);

    const { res, body } = await zrFetch(ZR_BASE + '/parcels/' + encodeURIComponent(parcelId), {
      method: 'DELETE', headers,
    });
    // Already gone (e.g. deleted directly from ZR's own dashboard — their API
    // returns 404 "Parcels.NotFound" for this) is the end state we want anyway.
    if (res.status === 404) {
      await ref.update({ zr: admin.firestore.FieldValue.delete() });
      return { ok: true, tracking: parcelId, alreadyGone: true };
    }
    if (!res.ok) {
      throw new HttpsError(
        'failed-precondition',
        'تعذّر إلغاء طرد ZR Express — قد يكون طرد تبديل/إرجاع لا يمكن حذفه، أو بدأ الشحن بالفعل: ' + zrErrMsg(body, res.status)
      );
    }

    await ref.update({ zr: admin.firestore.FieldValue.delete() });
    return { ok: true, tracking: parcelId };
  }
);

/* ───────────────────────────────────────────────────────────────
   getParcelStatus: called from the admin panel's "🔄 تحديث" button on
   a confirmed order. Fetches the LIVE status from whichever carrier
   shipped the order (o.noest.tracking or o.yalidine.tracking),
   normalizes the raw carrier status into a small 5-stage pipeline
   (or an "alert" state for failed/suspended/returned parcels), caches
   the result on the order (trackingStatus) so the admin panel can
   render it without hitting the carrier API on every page load, and
   returns it.

   Two things refresh a parcel, and both go through refreshOrderStatus
   below: this callable, from the panel's per-order 🔄 button, and the
   daily refreshAllParcels schedule (16:00 Africa/Algiers), which sweeps
   every parcel that is not delivered yet. Nothing polls in a loop — each
   carrier is asked at most once a day per parcel, paced.
   ─────────────────────────────────────────────────────────────── */
const STAGE_LABELS = ['تم إنشاء الطلب', 'تم التأكيد والشحن', 'في مركز الفرز', 'خرج للتوصيل', 'تم الاستلام'];
// stage = index of the furthest step the parcel has REACHED (that step and every
// one before it render green in the panel). `alert` with a non-null stage = a
// delivery problem shown as a ⚠️ between "خرج للتوصيل" and "تم الاستلام"; `stage:
// null` = a terminal return/cancel with no meaningful step progress.

/* ── Canonical order outcome ──────────────────────────────────────
   `trackingStatus` is a rendering model: a stage index, an alert
   string, and a label, all shaped for the admin's stepper. It is
   fine for drawing a row and useless for answering "how many of
   last month's Meta orders actually got delivered?" — you cannot
   query or aggregate on it.

   So every place that writes trackingStatus also writes a flat
   `outcome` string next to it. Same source of truth (the existing
   per-carrier normalizers), no new carrier logic, no migration:
   orders written before this simply have no `outcome`, and
   lib/profit.ts falls back for them.

   Only RETURN alerts count as `returned`. The other alerts —
   "client not answering", "delivery postponed" — are transient
   problems on a parcel that is still out for delivery, and calling
   those returns would write off orders that go on to deliver fine.
   ───────────────────────────────────────────────────────────────── */
const OUTCOME_RANK = {
  new: 0, confirmed: 1, shipped: 2, delivered: 3, returned: 4, cancelled: 5,
};

function outcomeFromStatus(status) {
  if (!status) return null;
  const alert = String(status.alert || '');
  // Deleted from the carrier's own dashboard — the parcel is not coming.
  if (status.notFoundAtCarrier || /حذف|محذوف/.test(alert)) return 'cancelled';
  // The normalizers phrase every return/cancel alert with مرتجع or إرجاع.
  if (/مرتجع|إرجاع|ملغ/.test(alert)) return 'returned';
  const stage = status.stage;
  if (typeof stage !== 'number') return 'confirmed';
  // Same delivered test the admin stepper uses: last step, no active alert.
  if (!alert && stage >= STAGE_LABELS.length - 1) return 'delivered';
  if (stage >= 1) return 'shipped';
  return 'confirmed';
}

/* Merge the derived outcome into a Firestore update object.

   Guards against going backwards: carrier webhooks can arrive late or out
   of order, and a stale "in transit" event landing after a delivery must
   not un-deliver a completed order. A parcel that comes back AFTER being
   delivered is real, though, so terminal states may still overwrite
   `delivered`. */
function withOutcome(update, status, prevOutcome) {
  const next = outcomeFromStatus(status);
  if (!next) return update;
  const prevRank = OUTCOME_RANK[prevOutcome];
  const nextRank = OUTCOME_RANK[next];
  if (typeof prevRank === 'number' && nextRank < prevRank) return update;
  update.outcome = next;
  update.outcomeAt = Date.now();
  return update;
}

// A carrier not having the parcel yet is ambiguous: it usually just means it was
// created seconds ago and hasn't been indexed on their side yet (normal, resolves
// on the next refresh) — but it can also mean the parcel was deleted directly from
// the carrier's own dashboard, outside this app entirely. The only signal that
// tells these apart is age: a parcel still missing long after creation is gone for
// good, not "still propagating". `notFoundAtCarrier(o, carrier)` below gates on
// this so genuinely-new parcels aren't misreported as deleted.
const NOT_FOUND_GRACE_MS = 15 * 60 * 1000; // 15 minutes
function parcelIsStale(o, carrier) {
  const createdAt = Number(o[carrier] && o[carrier].createdAt) || 0;
  return Date.now() - createdAt > NOT_FOUND_GRACE_MS;
}
function deletedAtCarrierStatus(carrier, carrierName, tracking) {
  return {
    carrier, tracking,
    stage: null,
    alert: 'تم حذف هذا الطرد',
    stageLabels: STAGE_LABELS,
    lastLabel: `محذوف لدى ${carrierName}`,
    lastLocation: null, lastDate: null,
    notFoundAtCarrier: true,
    events: [], updatedAt: Date.now(),
  };
}

// Noest's status keys are a small fixed set, so an exact-match table is safe.
const NOEST_STAGE = {
  upload: 0, edited_informations: 0, customer_validation: 0,
  validation_collect_colis: 1, validation_reception_admin: 1, validation_reception: 1,
  sent_to_redispatch: 2, fdr_activated: 3, mise_a_jour: 3,
  // `livre` = "Enlevé par le livreur" (handed to the courier = out for delivery);
  // only `livred` means the parcel reached the recipient.
  livre: 3, livred: 4,
};
const NOEST_ALERT = {
  colis_suspendu: 'معلّق ⚠️',
  nouvel_tentative_asked_by_customer: 'بانتظار محاولة توصيل جديدة',
  return_asked_by_customer: 'مرتجع (بطلب من الزبون)',
  return_asked_by_hub: 'مرتجع (بطلب من المركز)',
  retour_dispatched_to_partenaires: 'قيد الإرجاع',
  return_dispatched_to_partenaire: 'قيد الإرجاع',
  colis_retour_transmit_to_partner: 'قيد الإرجاع',
  livraison_echoue_recu: 'فشل التسليم',
  return_validated_by_partener: 'تم تأكيد الإرجاع',
  return_redispatched_to_livraison: 'إعادة محاولة التوصيل',
  return_dispatched_to_warehouse: 'أُعيد إلى المخزن',
  pickedup: 'استُلم (إرجاع)',
  valid_return_pickup: 'تم تأكيد استلام الإرجاع',
  pickup_picked_recu: 'تم استلام الإرجاع',
};

// Noest's own French status names, mapped to the 5 steps exactly as they read in
// the Noest dashboard. This is the authoritative signal — the event_key table
// above only backs it up — so a renamed or unmapped key can no longer pin the
// tracker a step behind. Returns { stage:-1 } for text we don't recognize so it
// yields to the key table instead of forcing "just created". Order matters:
// "Livré" (delivered) is checked apart from "En livraison" (out for delivery),
// and "Prêt à expédier" must not be mistaken for "En expédition".
//   Prêt à expédier → 0 · En traitement → 1 · En expédition/En hub → 2
//   En livraison → 3 · Livré → 4 · Suspendu → ⚠️ before delivery
function noestNormalize(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (!s) return { stage: -1, alert: null };
  if (/retour|annul|rembours/.test(s)) return { stage: null, alert: 'مرتجع / ملغى — تحتاج متابعة' };
  if (/suspend|bloqu|[ée]chou|[ée]chec|probl[èe]me|tentative|alerte/.test(s)) return { stage: 3, alert: 'معلّق — مشكلة في التوصيل' };
  // "Enlevé/Remis/Affecté par le livreur" = the parcel left the hub with the
  // courier for delivery — OUT for delivery, not delivered. The "livreur"
  // substring contains "livre", so it must be caught BEFORE the delivered rule.
  if (/enlev[ée] par le livreur|remis au livreur|affect[ée] au livreur|pris(?:e)? en charge par le livreur/.test(s)) return { stage: 3, alert: null };
  // "Livré/Livrée/Livrés" (delivered) — but NOT "livraison" (out for delivery)
  // and NOT "livreur" (courier): a driver-pickup label must never count as
  // delivered. (No \b: a word boundary after the accented "é" never matches
  // without the /u flag.)
  if (/livr[ée]/.test(s) && !/livraison|livreur/.test(s)) return { stage: 4, alert: null };
  if (/en\s*livraison|en cours de livraison|sortie?\s+(en|pour)\s+livraison|distribution/.test(s)) return { stage: 3, alert: null };
  if (/exp[ée]dition|en\s*hub|\bhub\b|en\s*transit|\btransit\b|centre de tri|dispatch|redispatch/.test(s)) return { stage: 2, alert: null };
  if (/traitement|trait[ée]|valid|confirm|ramass|collect|r[ée]ception|re[çc]u/.test(s)) return { stage: 1, alert: null };
  if (/pr[êe]t\s*[àa]\s*exp[ée]dier|pr[êe]t|pr[ée]paration|cr[é]{2}|upload|nouveau|enregistr/.test(s)) return { stage: 0, alert: null };
  return { stage: -1, alert: null };
}

// Yalidine's last_status is free-text French, matched by keyword. Mapped to the 5
// steps exactly as requested:
//   In preparation → 0 · Dispatched → 1 · To the Wilaya → 2
//   Agency center → 3 · Delivered → 4 · On alert → ⚠️ before delivery
// Order matters: returns/alerts first, then "Livré" (delivered) apart from
// "En livraison"; the destination agency ("localisation"/"agence"/"sorti") counts
// as out-for-delivery (3), while a wilaya/hub transfer is sorting (2).
function yalidineNormalize(raw) {
  const s = String(raw || '');
  if (/(retour|[ée]change)/i.test(s)) return { stage: null, alert: 'مرتجع / قيد الإرجاع' };
  // Failures: "Tentative échouée", "En alerte", "Echèc livraison" (è!), "échoué".
  if (/(tentative|alerte|[ée]ch[eè]c|[ée]chou|bloqu|suspend)/i.test(s)) return { stage: 3, alert: 'تنبيه — مشكلة في التوصيل' };
  if (/^livr[ée]/i.test(s)) return { stage: 4, alert: null };
  // Pre-shipping FIRST — "Pas encore expédié" / "Prêt à expédier" contain "expédi",
  // so the dispatched rule below would otherwise mark them already shipped.
  if (/(pas encore|pr[êe]t [àa] exp[ée]dier|pr[ée]paration|v[ée]rifier|cr[é]{2})/i.test(s)) return { stage: 0, alert: null };
  // Agency center / out for delivery — at destination agency, localised, out with driver.
  if (/(agence|localisation|sorti|en\s*livraison|pr[êe]t pour livreur|en attente du client|distribution)/i.test(s)) return { stage: 3, alert: null };
  // To the wilaya / hub transfer / sorting.
  if (/(vers wilaya|wilaya|centre|hub|tri|transfert|en\s*transit)/i.test(s)) return { stage: 2, alert: null };
  // Dispatched / picked up / shipped.
  if (/(exp[ée]di|ramass|enlev|collect|pris en charge)/i.test(s)) return { stage: 1, alert: null };
  return { stage: 0, alert: null };
}

async function fetchNoestStatus(db, o) {
  const credSnap = await db.collection('private').doc('noest').get();
  const cred = credSnap.exists ? credSnap.data() : {};
  const token = String(cred.apiToken || '').trim();
  const guid = String(cred.userGuid || '').trim();
  if (!token) throw new HttpsError('failed-precondition', 'أدخلي بيانات Noest أولاً.');
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json' };

  let res, body;
  try {
    // Noest's API doc marks api_token AND user_guid as required body fields for
    // get/trackings/info. Without user_guid the lookup isn't scoped to the
    // account and Noest answers "Trackings non trouvés" for parcels that exist.
    res = await noestFetch(NOEST_BASE + '/api/public/get/trackings/info', {
      method: 'POST', headers,
      body: JSON.stringify({ api_token: token, user_guid: guid, trackings: [o.noest.tracking] }),
    });
    body = await res.json();
  } catch (e) {
    throw new HttpsError('unavailable', 'تعذّر الاتصال بـ Noest: ' + e.message);
  }
  // Noest returns this (not an HTTP error) for parcels still sitting unvalidated
  // in "prêt à expédier" — very common right after creation, not a real failure.
  // BUT this is also exactly what a parcel deleted from Noest's own dashboard
  // would return forever after, so only treat it as "still pending" while fresh.
  if (body && body.message === 'Trackings non trouvés') {
    if (parcelIsStale(o, 'noest')) return deletedAtCarrierStatus('noest', 'Noest', o.noest.tracking);
    return {
      carrier: 'noest', tracking: o.noest.tracking,
      stage: 0, alert: null, stageLabels: STAGE_LABELS,
      lastLabel: 'بانتظار تأكيد الطلب في Noest', lastLocation: null, lastDate: null,
      events: [], updatedAt: Date.now(),
    };
  }
  if (!res.ok) throw new HttpsError('internal', 'Noest tracking error: ' + JSON.stringify(body));

  const entry = (body && typeof body === 'object')
    ? (body[o.noest.tracking] || body[Object.keys(body)[0]]) : null;
  // Each Noest activity carries who handled it (the agent/livreur), which hub it
  // passed through, and a free-text reason ("Client ne répond pas", etc.). Field
  // names vary, so read them generously and keep any leftover string fields in
  // `extra` so no detail the API returns is dropped from the panel.
  const rawEvents = (entry && (entry.activity || entry.events)) || [];
  const events = rawEvents.map((e) => ({
    key: e.event_key || e.key || e.status || '',
    label: e.event || e.event_key || e.key || e.status || '',
    date: e.date || e.created_at || e.updated_at || null,
    location: e.location || null,
    by: e.by || e.agent || e.user || e.staff || null,                                  // who performed the action
    driver: e.driver || e.livreur || null,                                             // livreur holding the parcel
    content: e.content || e.comment || e.note || e.reason || e.motif || null,          // free-text reason
    causer: e.causer || e.cause || null,                                               // NOEST / PARTENAIRE
    badge: e['badge-class'] || e.badge_class || e.badgeClass || e.badge || null,       // colour hint only
  })).filter((e) => e.date).sort((a, b) => new Date(a.date) - new Date(b.date));

  const last = events[events.length - 1] || null;
  const currentText = (last && last.label) || '';

  // Stage = the furthest milestone reached across the WHOLE history. Noest's own
  // French status names (noestNormalize) are authoritative; the legacy event_key
  // table backs them up so a renamed/unmapped key can't drag a moved parcel back.
  // We take the max so an intermediate event we don't recognise never resets the
  // tracker, and — crucially — never leaves it a step behind the real state.
  let stage = 0;
  let recognized = false;
  events.forEach((e) => {
    if (e.key in NOEST_STAGE) { stage = Math.max(stage, NOEST_STAGE[e.key]); recognized = true; }
    const r = noestNormalize(e.label);
    if (typeof r.stage === 'number' && r.stage >= 0) { stage = Math.max(stage, r.stage); recognized = true; }
  });
  // Alert / terminal state reflects the CURRENT (latest) status, not history — a
  // parcel that was "Suspendu" then moved again should stop warning.
  const cur = noestNormalize(currentText);
  // "Delivered" is terminal and must be confirmed by the CURRENT event. If the
  // latest activity is no longer a delivery (e.g. a returned parcel re-dispatched
  // for re-delivery, or a `livre`/livreur pickup record in mid-history), a
  // historical delivered-looking event must not keep the tracker pinned at
  // "تم الاستلام" — downgrade to the current event's step, never above "خرج للتوصيل".
  if (stage === STAGE_LABELS.length - 1) {
    const lastKeyStage = (last && last.key in NOEST_STAGE) ? NOEST_STAGE[last.key] : -1;
    const lastLabelStage = (typeof cur.stage === 'number') ? cur.stage : -1;
    if (lastKeyStage < 4 && lastLabelStage < 4) {
      stage = Math.max(0, lastKeyStage, lastLabelStage);
      if (stage > STAGE_LABELS.length - 2) stage = STAGE_LABELS.length - 2;
      console.log('[getParcelStatus] Noest delivered downgraded', o.noest.tracking,
        'lastKey:', last && last.key, 'lastLabel:', currentText);
    }
  }
  let alert = cur.alert || (last ? (NOEST_ALERT[last.key] || null) : null);
  if (cur.stage === null) {
    stage = null;                       // return / cancel — no meaningful progress
  } else if (alert) {
    // A delivery problem (Tentative/Suspendu) means the parcel is NOT delivered —
    // pin it at "out for delivery" so the ⚠️ sits before the final step and
    // "تم الاستلام" never turns green (a stray `livre` event must not deliver it).
    stage = STAGE_LABELS.length - 2;
  }
  // Validated in Noest = any activity beyond the initial upload/edit.
  const noestValidated = events.some((e) =>
    e.key === 'customer_validation' || (NOEST_STAGE[e.key] || 0) >= 1 || (e.key in NOEST_ALERT));
  // Log any status text we couldn't place, so a new Noest wording is visible in
  // the Cloud Functions logs instead of silently sticking the tracker.
  events.forEach((e) => {
    if (!(e.key in NOEST_STAGE) && noestNormalize(e.label).stage < 0 && !(e.key in NOEST_ALERT)) {
      console.log('[getParcelStatus] unrecognized Noest status', e.key, e.label, 'tracking:', o.noest.tracking);
    }
  });
  // Some activity but nothing we could place, and still at "just created" — the
  // parcel has clearly moved, so nudge it off stage 0 rather than look stuck.
  if (stage === 0 && !recognized && events.length) stage = 1;

  // The livreur who CURRENTLY holds the parcel: Noest reports the assigned
  // driver top-level (OrderInfo.driver_name / driver_phone) — that's the one
  // piece of info missing from the tracker. Fall back to the most recent
  // activity that names a driver when the top-level fields are empty.
  const orderInfo = (entry && entry.OrderInfo) || {};
  let livreur = null;
  const driverName = String(orderInfo.driver_name || '').trim();
  const driverPhone = String(orderInfo.driver_phone || '').trim();
  if (driverName || driverPhone) {
    livreur = { name: driverName || null, phone: driverPhone || null };
  } else {
    const lastWithDriver = events.reduce((acc, e) => (e.driver ? e : acc), null);
    if (lastWithDriver) livreur = { name: lastWithDriver.driver, phone: null };
  }

  return {
    carrier: 'noest', tracking: o.noest.tracking,
    stage, alert, stageLabels: STAGE_LABELS, livreur,
    // Show Noest's OWN status text (e.g. "En livraison", "Suspendu") so the raw
    // carrier state is always visible next to our step mapping.
    lastLabel: last ? (last.label || alert || (stage != null ? STAGE_LABELS[stage] : null)) : 'بانتظار المعالجة',
    lastLocation: last ? last.location : null,
    lastDate: last ? last.date : null,
    noestValidated,
    events, updatedAt: Date.now(),
  };
}

async function fetchYalidineStatus(db, o) {
  const credSnap = await db.collection('private').doc('yalidine').get();
  const cred = credSnap.exists ? credSnap.data() : {};
  const apiId = String(cred.apiId || '').trim(), apiToken = String(cred.apiToken || '').trim();
  if (!apiId || !apiToken) throw new HttpsError('failed-precondition', 'أدخلي بيانات Yalidine أولاً.');
  const headers = { 'X-API-ID': apiId, 'X-API-TOKEN': apiToken };

  let res, body;
  try {
    res = await fetch(`${API_BASE}/parcels/?tracking=${encodeURIComponent(o.yalidine.tracking)}`, { headers });
    body = await res.json();
  } catch (e) {
    throw new HttpsError('unavailable', 'تعذّر الاتصال بـ Yalidine: ' + e.message);
  }
  if (!res.ok) throw new HttpsError('internal', 'Yalidine tracking error: ' + JSON.stringify(body));
  // Only accept the parcel whose tracking actually matches — if the filter
  // were ever ignored, data[0] would be some other parcel's state.
  const list = (body && Array.isArray(body.data)) ? body.data : [];
  const parcel = list.find((p) => p && p.tracking === o.yalidine.tracking)
    || (body && !body.data && body.tracking === o.yalidine.tracking ? body : null);
  // No parcel record yet (just created, not picked up by Yalidine's system) — same
  // "still pending" case as Noest's unvalidated parcels, not a real failure. BUT
  // it's also exactly what a parcel deleted from Yalidine's own dashboard would
  // return forever after, so only treat it as "still pending" while fresh.
  if (!parcel) {
    if (parcelIsStale(o, 'yalidine')) return deletedAtCarrierStatus('yalidine', 'Yalidine', o.yalidine.tracking);
    return {
      carrier: 'yalidine', tracking: o.yalidine.tracking,
      stage: 0, alert: null, stageLabels: STAGE_LABELS,
      lastLabel: 'بانتظار معالجة الطلب لدى Yalidine', lastLocation: null, lastDate: null,
      events: [], updatedAt: Date.now(),
    };
  }

  const rawStatus = parcel.last_status || '';
  const { stage, alert } = yalidineNormalize(rawStatus);
  const location = [parcel.current_commune_name, parcel.current_wilaya_name].filter(Boolean).join(' - ');

  let events = [];
  try {
    const hRes = await fetch(`${API_BASE}/histories/${encodeURIComponent(o.yalidine.tracking)}`, { headers });
    if (hRes.ok) {
      const hBody = await hRes.json();
      const list = Array.isArray(hBody) ? hBody : (hBody && hBody.data) || [];
      events = list.map((h) => ({
        key: h.status, label: h.status, date: h.date_status,
        location: [h.commune_name, h.wilaya_name].filter(Boolean).join(' - ') || null,
        by: h.driver_name || h.driver || null,
        center: h.center_name || h.center || null,
        content: h.reason || h.raison || null,
        causer: null, badge: null,
      })).sort((a, b) => new Date(a.date) - new Date(b.date));
    }
  } catch (e) { /* history is best-effort; the parcel's own last_status already covers the stepper */ }

  return {
    carrier: 'yalidine', tracking: o.yalidine.tracking,
    stage, alert, stageLabels: STAGE_LABELS,
    // Always surface Yalidine's own French status; the alert is shown via the ⚠️
    // marker/badge in the panel, not by hiding what the carrier actually said.
    lastLabel: rawStatus || alert || 'بانتظار المعالجة',
    lastLocation: location || null,
    lastDate: parcel.date_last_status || null,
    events, updatedAt: Date.now(),
  };
}

// ZR Express's state names are snake_case French ("vers_wilaya",
// "pret_a_expedier", "confirme_au_bureau", "commande_recue"), and the event
// history can also surface the accented description ("Commande reçue",
// "Prêt à expédier"). Normalize both to one lowercase space-separated form so
// a single set of keyword rules covers them — an unrecognized snake_case name
// (e.g. "vers_wilaya") used to fall through every rule and then keep the
// parcel's PREVIOUS stage, which misreported an in-transit parcel as still
// "تم التأكيد والشحن". Same green-step model as the others: created/ready → 0,
// dispatched → 1, hub/wilaya transit → 2, out for delivery → 3, delivered → 4.
// "Out for delivery" is checked before "delivered" — it contains "delivery",
// which "delivered" would otherwise substring-match and misreport.
function zrNormalize(raw) {
  // Split camelCase boundaries FIRST (EnLivraison → "En Livraison") so the
  // snake_case French names, their accented descriptions, and the older
  // English/camelCase names all land on the same lowercase word list.
  const s = String(raw || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents: é→e, à→a, ê→e…
    .replace(/[_\-\s]+/g, ' ').trim();
  if (!s) return { stage: -1, alert: null };
  if (/(retour|retourne|return|cancel|annul)/.test(s)) return { stage: null, alert: 'مرتجع / ملغى — تحتاج متابعة' };
  if (/(fail|echec|problem|probleme|hold|suspend)/.test(s)) return { stage: 3, alert: 'مشكلة في التوصيل' };
  // Client not reachable — ZR's tenant-specific states for failed delivery
  // attempts ("No Answer 1", "No Answer 2", "Client ne répond pas"... ). The
  // parcel is still out for delivery but the delivery keeps failing, so the
  // admin must call the client — flag it as a delivery-problem alert (same
  // step, but with the alert so the panel surfaces it on the whole card).
  // Placed BEFORE the plain out-for-delivery rule so an alerting "no answer"
  // state is never masked by a bare "en livraison" match.
  if (/(no answer|sans reponse|ne repond|injoignable|absent)/.test(s)) return { stage: 3, alert: 'الزبون لا يرد — اتصل به لتسوية التوصيل' };
  if (/out for delivery|en cours de livraison|en livraison|chez livreur|dispatch/.test(s)) return { stage: 3, alert: null };
  // "Encaisse" = COD collected, which only happens once the parcel has been
  // delivered — same terminal step as "delivered"/"livré". Anchored + word
  // boundary so "livré" (delivered) never matches "livraison"/"livreur".
  if (/^(delivered|livre\b)|encaiss/.test(s)) return { stage: 4, alert: null };
  // Hub / sorting / transfer — incl. the "vers wilaya"/"vers centre" transfers
  // that take a parcel from the origin office toward the destination wilaya.
  // Deliberately NOT a generic "arrive" match: "arrivée chez le client" means
  // delivered, and the -1 fallback below keeps unknown states on their known
  // stage rather than guessing.
  if (/(hub|center|centre|sort|tri|transit|vers wilaya|vers centre|vers bureau)/.test(s)) return { stage: 2, alert: null };
  // Pre-shipping FIRST — "Prêt à expédier" contains "expédi", so the dispatched
  // rule below would otherwise mark it as already shipped (same class of bug
  // yalidineNormalize already guards against for the identical French phrasing).
  if (/pret a expedier|ready|pending|commande recue|commande|creat|nouveau/.test(s)) return { stage: 0, alert: null };
  // Dispatched / picked up / confirmed / shipped.
  if (/(pick|ramass|collect|confirme|confirm|expedie|expedition|ship)/.test(s)) return { stage: 1, alert: null };
  // Unrecognized — signal -1 (not 0) so callers fall back to whatever stage was
  // already known instead of visibly regressing an in-progress parcel back to
  // "just created". Logged by the caller so a real gap in this mapping (like the
  // missing "encaisse" case above) shows up instead of silently misreporting.
  return { stage: -1, alert: null };
}

async function fetchZrStatus(db, o) {
  const cred = await zrCreds(db);
  const headers = zrHeaders(cred);
  const tracking = o.zr.tracking;
  const parcelId = o.zr.parcelId;

  // Prefer the direct get-by-id lookup (we already have the parcel's own UUID) —
  // a plain GET, and it can't get stuck the way a trackingNumber search can if the
  // tracking number was never resolved at creation time. Fall back to searching by
  // tracking number for any older record that has no stored parcelId.
  let row = null;
  if (parcelId) {
    const { res, body } = await zrFetch(ZR_BASE + '/parcels/' + parcelId, { method: 'GET', headers });
    if (res.ok) row = body;
    else if (res.status !== 404) throw new HttpsError('internal', 'ZR Express tracking error: ' + zrErrMsg(body, res.status));
  }
  if (!row) {
    const { res, body } = await zrFetch(ZR_BASE + '/parcels/search', {
      method: 'POST', headers,
      body: JSON.stringify({
        pageNumber: 1, pageSize: 1,
        advancedFilter: { logic: 'and', filters: [{ field: 'trackingNumber', operator: 'eq', value: tracking }] },
      }),
    });
    if (!res.ok) throw new HttpsError('internal', 'ZR Express tracking error: ' + zrErrMsg(body, res.status));
    row = ((body && (body.items || body.data || body.results)) || [])[0];
  }
  // Not found yet is ambiguous the same way as Yalidine/Noest above — could be
  // "just created, not indexed yet" or "deleted from ZR's own dashboard".
  if (!row) {
    if (parcelIsStale(o, 'zr')) return deletedAtCarrierStatus('zr', 'ZR Express', tracking);
    return {
      carrier: 'zr', tracking,
      stage: 0, alert: null, stageLabels: STAGE_LABELS,
      lastLabel: 'بانتظار معالجة الطرد لدى ZR Express', lastLocation: null, lastDate: null,
      events: [], updatedAt: Date.now(),
    };
  }

  const rawStatus = (row.state && row.state.name) || '';
  const norm = zrNormalize(rawStatus);
  let stage = norm.stage;
  if (stage === -1) {
    console.log('[getParcelStatus] unrecognized ZR status', JSON.stringify(rawStatus), 'tracking:', tracking);
    const prevTs = o.trackingStatus;
    stage = (prevTs && prevTs.carrier === 'zr' && prevTs.tracking === o.zr.tracking && typeof prevTs.stage === 'number')
      ? prevTs.stage : 0;
  }

  // Full state-transition timeline for the "تفاصيل الشحنة" panel, same role as
  // Yalidine's /histories call — best-effort, a failure here must never break
  // the stepper itself, which already has everything it needs from `row`.
  let events = [];
  try {
    const { res: hRes, body: hBody } = await zrFetch(
      ZR_BASE + '/parcels/' + (row.id || parcelId) + '/state-history',
      { method: 'GET', headers }
    );
    if (hRes.ok && Array.isArray(hBody)) {
      events = hBody.map((h) => {
        const stateName = (h.newState && (h.newState.name || h.newState.description)) || '';
        // ZR attaches a per-state SITUATION to some events (e.g. «مجددا» = the
        // parcel went out for delivery a second time) — surface its name
        // alongside the state name so the panel shows the real situation, not
        // just the raw state. The situation comment (reason) still goes to
        // `content` below.
        const sitNames = Array.isArray(h.situations)
          ? h.situations.map((s) => s.name).filter(Boolean)
          : [];
        // Colour-code each entry the same way the top-level stepper already
        // does — reuse zrNormalize instead of ZR's own per-state `color`
        // (a tenant-configurable hex, not a stable ok/bad/warn signal) so an
        // event's colour always agrees with what the stepper says about it.
        const enorm = zrNormalize(stateName);
        const badge = enorm.alert ? 'badge-danger'
          : enorm.stage === STAGE_LABELS.length - 1 ? 'badge-success'
          : enorm.stage >= 0 ? 'badge-primary'
          : null;
        return {
          key: (h.newState && h.newState.id) || null,
          label: [stateName, ...sitNames].join(' ') || stateName,
          date: h.createdAt || null,
          location: (h.location && [h.location.hubName, h.location.hubCity].filter(Boolean).join(' - ')) || null,
          by: (h.modifiedBy && h.modifiedBy.fullName) || null,
          center: (h.location && h.location.hubName) || null,
          content: h.comment ||
            (Array.isArray(h.situations) ? h.situations.map((s) => s.comment).filter(Boolean).join(' · ') : '') ||
            null,
          causer: null, badge,
        };
      }).filter((e) => e.date).sort((a, b) => new Date(a.date) - new Date(b.date));
    }
  } catch (e) { /* history is best-effort; row.state already covers the stepper */ }

  return {
    carrier: 'zr', tracking: row.trackingNumber || tracking,
    stage, alert: norm.alert, stageLabels: STAGE_LABELS,
    lastLabel: rawStatus || norm.alert || 'بانتظار المعالجة',
    lastLocation: null,
    lastDate: row.lastStateUpdateAt || null,
    events, updatedAt: Date.now(),
  };
}

// The refresh itself, with none of the callable's request plumbing: ask
// whichever carrier owns the parcel, write the normalized status (plus the
// two flags a refresh can heal) back onto the order, return it. Shared by
// the getParcelStatus callable and the daily refreshAllParcels schedule,
// so a hand refresh and the 16:00 run can never drift apart.
async function refreshOrderStatus(db, ref, o) {
  let status;
  if (o.noest && o.noest.tracking) status = await fetchNoestStatus(db, o);
  else if (o.yalidine && o.yalidine.tracking) status = await fetchYalidineStatus(db, o);
  else if (o.zr && o.zr.tracking) status = await fetchZrStatus(db, o);
  else throw new HttpsError('failed-precondition', 'لا يوجد طرد مُنشأ لهذا الطلب بعد.');

  const update = withOutcome({ trackingStatus: status }, status, o.outcome);
  // Noest activity proves the parcel was validated — sync the flag so the
  // panel stops showing «أكّديه في Noest للشحن» on already-confirmed parcels.
  if (status.carrier === 'noest' && status.noestValidated && !(o.noest && o.noest.validated)) {
    update['noest.validated'] = true;
  }
  // ZR Express's create call sometimes can't resolve the real tracking number
  // right away (falls back to the internal parcel id) — heal it once a refresh
  // finds the real one, so the admin panel stops showing the raw parcel id.
  if (status.carrier === 'zr' && status.tracking && status.tracking !== o.zr.tracking) {
    update['zr.tracking'] = status.tracking;
  }
  await ref.update(update);
  return status;
}

exports.getParcelStatus = onCall(
  { region: 'us-central1' },
  async (req) => {
    const orderId = req.data && req.data.orderId;
    if (!orderId) throw new HttpsError('invalid-argument', 'orderId is required');

    const db = admin.firestore();
    const ref = db.collection('orders').doc(String(orderId));
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Order not found');

    return refreshOrderStatus(db, ref, snap.data());
  }
);

/* ───────────────────────────────────────────────────────────────
   refreshAllParcels: the daily run that keeps every still-moving
   parcel's tracking current without anyone having to open the admin
   panel. Owner-requested (2026-09-08), and the reason the panel's manual
   «تحديث حالة الطرود المفتوحة» button was removed.

   Finished parcels are skipped — delivered, returned, cancelled, or
   deleted at the carrier. None of those can change again, so re-asking
   the carrier about them only burns rate limit, and the set of them only
   grows. Everything else is refreshed, however old.

   The one cost: if a carrier ever 404s a live parcel long enough for the
   fetchers to mark it notFoundAtCarrier, the daily run writes it off and
   stops asking. The panel's per-order 🔄 button still refreshes it by hand.

   Nothing has to be pushed to the panel — refreshOrderStatus writes
   trackingStatus/outcome onto the order doc, and the admin panel already
   watches orders live, so an open panel picks the results up on its own.
   ─────────────────────────────────────────────────────────────── */

// Which carrier owns this order's parcel, in the same precedence the admin
// panel uses (orderCarrier in components/admin/carriers.ts).
function parcelCarrier(o) {
  if (o.noest && o.noest.tracking) return 'noest';
  if (o.yalidine && o.yalidine.tracking) return 'yalidine';
  if (o.zr && o.zr.tracking) return 'zr';
  return null;
}

// A parcel whose story is over: delivered, returned, cancelled, or deleted
// from the carrier's own dashboard. None of those can change again, so the
// daily run skips them instead of spending rate limit on them forever.
//
// The call is outcomeFromStatus's, not a second opinion — that is the same
// normalizer every write path already uses to stamp `outcome` on the doc —
// read off the status ALREADY stored on the order. Only a stored status
// that still belongs to the order's current carrier and tracking number is
// trusted, so a re-created parcel reads as unfinished and gets refreshed.
//
// `cancelled` covers notFoundAtCarrier, which the fetchers only set once a
// parcel has been missing for longer than NOT_FOUND_GRACE_MS — a parcel
// created minutes ago is never mistaken for a deleted one.
const FINISHED_OUTCOMES = { delivered: true, returned: true, cancelled: true };

function parcelIsFinished(o) {
  const carrier = parcelCarrier(o);
  const ts = o.trackingStatus;
  if (!carrier || !ts) return false;
  if (ts.carrier !== carrier || ts.tracking !== o[carrier].tracking) return false;
  return FINISHED_OUTCOMES[outcomeFromStatus(ts)] === true;
}

// One carrier call at a time with this gap between them — the same pacing
// the panel's old bulk refresh used, so a run cannot burst past a
// carrier's rate limit.
const REFRESH_GAP_MS = 350;
// Ceiling on one run. The function's own timeout is the real limit
// (below); this keeps the run from ever reaching it, and a truncated run is
// logged loudly rather than passing silently.
const REFRESH_MAX_PARCELS = 400;

async function runParcelRefresh() {
  const db = admin.firestore();
  const snap = await db.collection('orders').get();

  const targets = [];
  snap.forEach((doc) => {
    const o = doc.data();
    if (!parcelCarrier(o)) return;
    if (parcelIsFinished(o)) return;
    targets.push({ ref: doc.ref, id: doc.id, data: o });
  });

  // Newest parcels first: those are the ones actually moving, so if the cap
  // ever truncates a run it drops the stalest parcels, not the live ones.
  targets.sort((a, b) => confirmStampOf(b.data) - confirmStampOf(a.data));
  const truncated = targets.length > REFRESH_MAX_PARCELS;
  const run = truncated ? targets.slice(0, REFRESH_MAX_PARCELS) : targets;
  if (truncated) {
    console.warn(
      `[parcels] ${targets.length} undelivered parcels exceeds the ${REFRESH_MAX_PARCELS} cap — ` +
      `refreshing the ${REFRESH_MAX_PARCELS} newest and skipping ${targets.length - REFRESH_MAX_PARCELS}`
    );
  }

  let ok = 0;
  let fail = 0;
  for (const t of run) {
    try {
      await refreshOrderStatus(db, t.ref, t.data);
      ok++;
    } catch (e) {
      // One unreachable carrier must not abandon the other parcels.
      console.error('[parcels] refresh failed for order', t.id, e && e.message);
      fail++;
    }
    await new Promise((r) => setTimeout(r, REFRESH_GAP_MS));
  }

  const result = { ok, fail, scanned: snap.size, targets: targets.length, truncated };
  console.log('[parcels] daily refresh:', JSON.stringify(result));
  return result;
}

// Parcel creation time, for ordering the run newest-first (mirrors
// confirmStamp in the admin panel).
function confirmStampOf(o) {
  if (o.noest && o.noest.tracking) return Number(o.noest.createdAt) || 0;
  if (o.yalidine && o.yalidine.tracking) return Number(o.yalidine.createdAt) || 0;
  if (o.zr && o.zr.tracking) return Number(o.zr.createdAt) || 0;
  return 0;
}

exports.refreshAllParcels = onSchedule(
  {
    // 16:00 in the store's own timezone, not UTC.
    schedule: '0 16 * * *',
    timeZone: 'Africa/Algiers',
    region: 'us-central1',
    // 400 parcels paced at 350ms plus carrier latency needs far more than
    // the 60s default; 9 minutes covers a full run with room to spare.
    timeoutSeconds: 540,
    memory: '512MiB',
    // A failed run is picked up by the next day's run — retrying a
    // partially-completed batch would just re-hit the carriers.
    retryCount: 0,
  },
  async () => {
    await runParcelRefresh();
  }
);

/* ───────────────────────────────────────────────────────────────
   lookupParcel: admin-only «ربط طلب» (link order) flow. Given a carrier
   and a tracking number for a parcel that was created OUTSIDE this app
   (already shipped at the carrier), fetches that parcel's live info from
   the carrier API WITHOUT creating anything — the admin confirms it's the
   right parcel, then a new order doc is written referencing that tracking
   number directly (never via a create*Parcel call).

   Admin-gated via requireAdmin: the response carries customer PII
   (name/phone/address/COD amount), unlike the pre-existing open callables.
   Returns { carrier, tracking, status, package } where `status` is the same
   normalized TrackingStatus shape the admin tracker already renders, and
   `package` holds the recipient/parcel details used to prefill the order.
   `raw` keeps the untouched carrier object for reference-only display.
   ─────────────────────────────────────────────────────────────── */
const LOOKUP_CARRIERS = {
  yalidine: { name: 'Yalidine' },
  noest: { name: 'Noest' },
  zr: { name: 'ZR Express' },
};

async function lookupYalidine(db, tracking) {
  const credSnap = await db.collection('private').doc('yalidine').get();
  const cred = credSnap.exists ? credSnap.data() : {};
  const apiId = String(cred.apiId || '').trim(), apiToken = String(cred.apiToken || '').trim();
  if (!apiId || !apiToken) throw new HttpsError('failed-precondition', 'أدخلي بيانات Yalidine أولاً.');
  const headers = { 'X-API-ID': apiId, 'X-API-TOKEN': apiToken };

  let res, body;
  try {
    res = await fetch(`${API_BASE}/parcels/?tracking=${encodeURIComponent(tracking)}`, { headers });
    body = await res.json();
  } catch (e) {
    throw new HttpsError('unavailable', 'تعذّر الاتصال بـ Yalidine: ' + e.message);
  }
  if (!res.ok) throw new HttpsError('internal', 'Yalidine tracking error: ' + JSON.stringify(body));
  // Only accept the parcel whose tracking actually matches (same guard as
  // fetchYalidineStatus) — a not-found here is a wrong number, not "pending".
  const list = (body && Array.isArray(body.data)) ? body.data : [];
  const parcel = list.find((p) => p && p.tracking === tracking)
    || (body && !body.data && body.tracking === tracking ? body : null);
  if (!parcel) return null;

  const status = await fetchYalidineStatus(db, { yalidine: { tracking } });
  const cod = Number(parcel.price != null ? parcel.price : parcel.to_pay);
  const parcelInfo = {
    customer: [parcel.firstname, parcel.familyname].filter(Boolean).join(' ').trim() || undefined,
    phone: String(parcel.contact_phone || '').trim() || undefined,
    // Yalidine returns the numeric to_wilaya_id (matches the app's own
    // Yalidine wilaya list) — prefer it, keep the name for display.
    wilaya: parcel.to_wilaya_id != null ? String(parcel.to_wilaya_id) : (parcel.to_wilaya_name || undefined),
    wilayaFr: parcel.to_wilaya_name || undefined,
    commune: parcel.to_commune_name || undefined,
    address: String(parcel.address || '').trim() || undefined,
    productLabel: String(parcel.product_list || '').trim() || undefined,
    price: isFinite(cod) && cod > 0 ? cod : null,
    createdAt: parcel.created_at || parcel.date_creation || null,
    // A stop-desk parcel is flagged by stopdesk_id/stopdesk_name (the API has
    // no is_stopdesk field) — null for home delivery, a code for Stop Desk.
    deliveryType: (parcel.stopdesk_id || parcel.stopdesk_name || parcel.is_stopdesk) ? 'office' : 'home',
    raw: parcel,
  };
  return { status, package: parcelInfo };
}

async function lookupNoest(db, tracking) {
  const credSnap = await db.collection('private').doc('noest').get();
  const cred = credSnap.exists ? credSnap.data() : {};
  const token = String(cred.apiToken || '').trim();
  const guid = String(cred.userGuid || '').trim();
  if (!token) throw new HttpsError('failed-precondition', 'أدخلي بيانات Noest أولاً.');
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json' };

  let res, body;
  try {
    res = await noestFetch(NOEST_BASE + '/api/public/get/trackings/info', {
      method: 'POST', headers,
      body: JSON.stringify({ api_token: token, user_guid: guid, trackings: [tracking] }),
    });
    body = await res.json();
  } catch (e) {
    throw new HttpsError('unavailable', 'تعذّر الاتصال بـ Noest: ' + e.message);
  }
  // Noest's "not found" is a body message, not an HTTP error (same as
  // fetchNoestStatus) — for a LOOKUP this means the number is wrong, not
  // that a parcel is still pending confirmation.
  if (body && body.message === 'Trackings non trouvés') return null;
  if (!res.ok) throw new HttpsError('internal', 'Noest tracking error: ' + JSON.stringify(body));
  const entry = (body && typeof body === 'object')
    ? (body[tracking] || body[Object.keys(body)[0]]) : null;
  if (!entry) return null;

  const status = await fetchNoestStatus(db, { noest: { tracking } });
  // Noest nests the recipient/COD fields under `OrderInfo` (the outer object
  // also carries a top-level `recipientName`). All the old direct field reads
  // (receiver_name/parcel_price/wilaya_name/...) silently came back empty for
  // real parcels, so a linked order prefilled blank — read from OrderInfo.
  const oi = entry.OrderInfo || {};
  const cod = Number(oi.montant != null ? oi.montant : (entry.parcel_price != null ? entry.parcel_price : entry.to_pay));
  const parcelInfo = {
    customer: String(entry.recipientName || oi.client || '').trim() || undefined,
    phone: String(oi.phone || entry.phone || '').trim() || undefined,
    // Noest's wilaya_id is the numeric wilaya code (1-58) the app's own
    // Noest wilaya list uses — send it as the id string so the link modal
    // matches by id (it also tries name matching for the other carriers).
    wilaya: oi.wilaya_id != null ? String(oi.wilaya_id) : (entry.wilaya_name || oi.wilaya || undefined),
    wilayaFr: entry.wilaya_fr || oi.wilaya_name || undefined,
    commune: String(oi.commune || entry.commune_name || entry.commune || '').trim() || undefined,
    address: String(oi.adresse || entry.adresse || entry.address || '').trim() || undefined,
    productLabel: String(oi.produit || entry.product || entry.produit || entry.products || '').trim() || undefined,
    price: isFinite(cod) && cod > 0 ? cod : null,
    createdAt: oi.created_at || entry.created_at || entry.createdAt || entry.date_creation || null,
    deliveryType: oi.stop_desk ? 'office' : 'home',
    raw: entry,
  };
  return { status, package: parcelInfo };
}

async function lookupZr(db, tracking) {
  const cred = await zrCreds(db);
  const headers = zrHeaders(cred);

  const { res, body } = await zrFetch(ZR_BASE + '/parcels/search', {
    method: 'POST', headers,
    body: JSON.stringify({
      pageNumber: 1, pageSize: 1,
      advancedFilter: { logic: 'and', filters: [{ field: 'trackingNumber', operator: 'eq', value: tracking }] },
    }),
  });
  if (!res.ok) throw new HttpsError('internal', 'ZR Express tracking error: ' + zrErrMsg(body, res.status));
  const row = ((body && (body.items || body.data || body.results)) || [])[0];
  if (!row) return null;

  const status = await fetchZrStatus(db, { zr: { tracking } });

  // ZR stores territory ids (UUIDs), not names — resolve the wilaya/commune
  // display names from the territory table best-effort (display-only; the
  // admin can still correct them by hand in the link form).
  const da = row.deliveryAddress || row.address || {};
  let cityName = da.cityName || null;
  let districtName = da.districtName || null;
  if (!cityName || !districtName) {
    try {
      const byId = {};
      const trows = await zrAllTerritories(headers);
      trows.forEach((t) => { byId[t.id] = t; });
      const city = byId[da.cityTerritoryId || da.cityId];
      const district = byId[da.districtTerritoryId || da.districtId];
      if (!cityName) cityName = (city && (city.name || city.nameAr)) || null;
      if (!districtName) districtName = (district && (district.name || district.nameAr)) || null;
    } catch (e) { /* display-only — leave the raw ids as-is */ }
  }
  // ZR's deliveryAddress.cityTerritoryCode is the numeric wilaya code the
  // app's own ZR wilaya list uses — prefer it over the territory's display
  // name (which can differ from the synced list, e.g. "El Menia" territory
  // vs "El Meniaa" in the app), same idea as Noest's wilaya_id.
  const wilayaCode = da.cityTerritoryCode != null ? String(da.cityTerritoryCode) : null;
  const cust = row.customer || {};
  const productList = (row.orderedProducts || [])
    .map((p) => p && `${p.productName || ''}${p.quantity && p.quantity > 1 ? ' x' + p.quantity : ''}`)
    .filter(Boolean).join(', ') || row.description || '';
  const cod = Number(row.amount);
  const isOffice = row.deliveryType === 'pickup-point';
  // For pickup-point parcels, deliveryAddress.hubName is the desk name the
  // app's synced ZR centers use — pass it as the commune so the link modal
  // can select the exact desk (home delivery keeps the district/commune).
  const commune = String(isOffice ? (da.hubName || districtName) : (districtName || da.districtName || '')).trim();
  const parcelInfo = {
    customer: String(cust.name || '').trim() || undefined,
    phone: String((cust.phone && (cust.phone.number1 || cust.phone.number)) || '').trim() || undefined,
    wilaya: wilayaCode || cityName || undefined,
    wilayaFr: cityName || undefined,
    commune: commune || undefined,
    address: String(da.street || '').trim() || undefined,
    productLabel: String(productList || '').trim() || undefined,
    price: isFinite(cod) && cod > 0 ? cod : null,
    createdAt: row.createdAt || row.created_at || null,
    deliveryType: isOffice ? 'office' : 'home',
    raw: row,
  };
  return { status, package: parcelInfo };
}

exports.lookupParcel = onCall(
  { region: 'us-central1', timeoutSeconds: 60 },
  async (req) => {
    requireAdmin(req);
    const carrier = String(req.data && req.data.carrier || '').toLowerCase().trim();
    const tracking = String(req.data && req.data.tracking || '').trim();
    const meta = LOOKUP_CARRIERS[carrier];
    if (!meta) throw new HttpsError('invalid-argument', 'شركة التوصيل غير صالحة.');
    if (!tracking) throw new HttpsError('invalid-argument', 'أدخلي رقم التتبع أولاً.');

    const db = admin.firestore();
    let res;
    if (carrier === 'yalidine') res = await lookupYalidine(db, tracking);
    else if (carrier === 'noest') res = await lookupNoest(db, tracking);
    else res = await lookupZr(db, tracking);

    if (!res) {
      throw new HttpsError('not-found', `لم يتم العثور على طرد بالرقم «${tracking}» لدى ${meta.name}. تأكدي من الرقم وشركة التوصيل.`);
    }
    return { carrier, tracking, status: res.status, package: res.package };
  }
);

/* ───────────────────────────────────────────────────────────────
   getNoestLabels: fetches the shipping-label PDF for one or more
   Noest trackings (the label endpoint needs the API token, so the
   admin panel can't link to it directly). Multiple labels are merged
   into a single PDF for one-click batch printing.
   ─────────────────────────────────────────────────────────────── */
exports.getNoestLabels = onCall(
  { region: 'us-central1', timeoutSeconds: 120, memory: '512MiB' },
  async (req) => {
    const trackings = ((req.data && req.data.trackings) || []).map((t) => String(t).trim()).filter(Boolean).slice(0, 50);
    if (!trackings.length) throw new HttpsError('invalid-argument', 'trackings is required');

    const db = admin.firestore();
    const credSnap = await db.collection('private').doc('noest').get();
    const token = String((credSnap.exists ? credSnap.data() : {}).apiToken || '').trim();
    if (!token) throw new HttpsError('failed-precondition', 'أدخلي بيانات Noest أولاً.');
    const headers = { Authorization: 'Bearer ' + token, Accept: 'application/json' };

    const pdfs = [];
    for (const tr of trackings) {
      let res;
      try {
        res = await noestFetch(NOEST_BASE + '/api/public/get/order/label?tracking=' + encodeURIComponent(tr), { headers });
      } catch (e) {
        throw new HttpsError('unavailable', 'تعذّر الاتصال بـ Noest: ' + e.message);
      }
      if (!res.ok) throw new HttpsError('internal', 'تعذّر جلب وصل ' + tr + ' (HTTP ' + res.status + ')');
      pdfs.push(Buffer.from(await res.arrayBuffer()));
    }

    if (pdfs.length === 1) return { pdf: pdfs[0].toString('base64'), count: 1 };

    // Each Noest label only occupies the top-left quadrant of its A4 page,
    // so tile 4 labels per printed page instead of one per sheet.
    const { PDFDocument } = require('pdf-lib');
    const merged = await PDFDocument.create();
    let page = null, slot = 0, W = 595.28, H = 841.89;
    for (const buf of pdfs) {
      const src = await PDFDocument.load(buf);
      const first = src.getPages()[0];
      const size = first.getSize(); W = size.width; H = size.height;
      const label = await merged.embedPage(first, { left: 0, bottom: H / 2, right: W / 2, top: H });
      if (slot % 4 === 0) page = merged.addPage([W, H]);
      const pos = slot % 4;
      page.drawPage(label, { x: (pos % 2) * (W / 2), y: pos < 2 ? H / 2 : 0 });
      slot++;
    }
    return { pdf: Buffer.from(await merged.save()).toString('base64'), count: pdfs.length };
  }
);

/* ───────────────────────────────────────────────────────────────
   syncNoestFees: fetches the partner's real per-wilaya pricing grid
   from Noest (/api/public/fees) and caches it to the public doc
   delivery_fees/noest, which the storefront reads to price Noest
   deliveries accurately.
   ─────────────────────────────────────────────────────────────── */
exports.syncNoestFees = onCall(
  { region: 'us-central1' },
  async () => {
    const db = admin.firestore();
    const credSnap = await db.collection('private').doc('noest').get();
    const cred = credSnap.exists ? credSnap.data() : {};
    const token = String(cred.apiToken || '').trim();
    if (!token) {
      throw new HttpsError('failed-precondition', 'أدخلي بيانات Noest أولاً.');
    }

    let res, body;
    try {
      res = await noestFetch(NOEST_BASE + '/api/public/fees', { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } });
      body = await res.json();
    } catch (e) {
      throw new HttpsError('unavailable', 'تعذّر جلب أسعار Noest: ' + e.message);
    }
    if (!res.ok) {
      throw new HttpsError('internal', 'Noest fees error: ' + JSON.stringify(body));
    }

    const delivery = (body && body.tarifs && body.tarifs.delivery) || {};
    const fees = {};
    let count = 0;
    for (const k in delivery) {
      const d = delivery[k] || {};
      const wid = String(d.wilaya_id || k);
      const home = parseInt(d.tarif, 10);
      const desk = parseInt(d.tarif_stopdesk, 10);
      if (!isNaN(home) && !isNaN(desk)) { fees[wid] = { home, desk }; count++; }
    }
    await db.collection('delivery_fees').doc('noest').set({ fees, updatedAt: Date.now() });
    return { ok: true, count };
  }
);

/* ───────────────────────────────────────────────────────────────
   syncCarriers: pulls each carrier's real wilaya + commune + stop-desk
   (agency office) lists from its API and caches them (with per-wilaya
   fees) to delivery_data/<carrier>, which the storefront reads to
   populate the right lists per carrier — including the Stop Desk
   dropdown, which must show only that carrier's real desks in the
   selected wilaya, never the commune list.
   ─────────────────────────────────────────────────────────────── */
const WILAYA_NAMES = {"1":["أدرار","Adrar"],"2":["الشلف","Chlef"],"3":["الأغواط","Laghouat"],"4":["أم البواقي","Oum El Bouaghi"],"5":["باتنة","Batna"],"6":["بجاية","Béjaïa"],"7":["بسكرة","Biskra"],"8":["بشار","Béchar"],"9":["البليدة","Blida"],"10":["البويرة","Bouira"],"11":["تمنراست","Tamanrasset"],"12":["تبسة","Tébessa"],"13":["تلمسان","Tlemcen"],"14":["تيارت","Tiaret"],"15":["تيزي وزو","Tizi Ouzou"],"16":["الجزائر","Alger"],"17":["الجلفة","Djelfa"],"18":["جيجل","Jijel"],"19":["سطيف","Sétif"],"20":["سعيدة","Saïda"],"21":["سكيكدة","Skikda"],"22":["سيدي بلعباس","Sidi Bel Abbès"],"23":["عنابة","Annaba"],"24":["قالمة","Guelma"],"25":["قسنطينة","Constantine"],"26":["المدية","Médéa"],"27":["مستغانم","Mostaganem"],"28":["المسيلة","M'Sila"],"29":["معسكر","Mascara"],"30":["ورقلة","Ouargla"],"31":["وهران","Oran"],"32":["البيض","El Bayadh"],"33":["إليزي","Illizi"],"34":["برج بوعريريج","Bordj Bou Arréridj"],"35":["بومرداس","Boumerdès"],"36":["الطارف","El Tarf"],"37":["تندوف","Tindouf"],"38":["تيسمسيلت","Tissemsilt"],"39":["الوادي","El Oued"],"40":["خنشلة","Khenchela"],"41":["سوق أهراس","Souk Ahras"],"42":["تيبازة","Tipaza"],"43":["ميلة","Mila"],"44":["عين الدفلى","Aïn Defla"],"45":["النعامة","Naâma"],"46":["عين تموشنت","Aïn Témouchent"],"47":["غرداية","Ghardaïa"],"48":["غليزان","Relizane"],"49":["تيميمون","Timimoun"],"50":["برج باجي مختار","Bordj Badji Mokhtar"],"51":["أولاد جلال","Ouled Djellal"],"52":["بني عباس","Béni Abbès"],"53":["عين صالح","In Salah"],"54":["عين قزام","In Guezzam"],"55":["تقرت","Touggourt"],"56":["جانت","Djanet"],"57":["المغير","El M'Ghair"],"58":["المنيعة","El Meniaa"]};
const YAL_FEES = {"1":[1400,1200],"2":[900,400],"3":[1050,600],"4":[900,400],"5":[900,400],"6":[900,400],"7":[1050,600],"8":[1400,800],"9":[750,350],"10":[900,400],"11":[1600,1200],"12":[1050,600],"13":[900,400],"14":[900,400],"15":[900,400],"16":[500,300],"17":[1050,600],"18":[900,400],"19":[900,400],"20":[900,400],"21":[900,400],"22":[900,400],"23":[900,400],"24":[900,400],"25":[900,400],"26":[900,400],"27":[900,400],"28":[900,400],"29":[900,400],"30":[1050,600],"31":[900,400],"32":[1050,600],"33":[1800,1200],"34":[900,400],"35":[750,350],"36":[900,400],"37":[1800,1200],"38":[900,400],"39":[1050,600],"40":[900,400],"41":[900,400],"42":[750,350],"43":[900,400],"44":[900,400],"45":[1050,600],"46":[900,400],"47":[1050,600],"48":[900,400],"49":[1400,800],"50":[1800,1200],"51":[1050,600],"52":[1400,800],"53":[1600,1200],"54":[1800,1200],"55":[1050,600],"56":[1800,1200],"57":[1050,600],"58":[1050,600]};
const NOEST_FEES = {"1":[1500,700],"2":[950,450],"3":[850,400],"4":[850,400],"5":[850,400],"6":[900,400],"7":[950,450],"8":[1300,650],"9":[800,350],"10":[800,350],"11":[2000,1000],"12":[850,400],"13":[950,450],"14":[950,450],"15":[800,350],"16":[800,350],"17":[950,450],"18":[900,400],"19":[850,400],"20":[950,450],"21":[900,400],"22":[950,450],"23":[800,350],"24":[900,400],"25":[900,400],"26":[800,350],"27":[950,450],"28":[850,400],"29":[950,450],"30":[800,350],"31":[800,350],"32":[1000,500],"33":[1950,950],"34":[850,400],"35":[800,350],"36":[950,450],"37":[1750,850],"38":[950,450],"39":[800,350],"40":[850,400],"41":[900,400],"42":[800,350],"43":[900,400],"44":[950,450],"45":[1100,550],"46":[950,450],"47":[950,450],"48":[950,450],"49":[1200,600],"50":[1800,1200],"51":[950,450],"52":[1450,650],"53":[1650,850],"54":[1800,1200],"55":[700,300],"56":[2200,1600],"57":[850,300],"58":[1000,500]};

// Reverse-lookup for site_settings.originWilaya (stored as a French name, e.g.
// "Touggourt") into the numeric wilaya id the Yalidine fees endpoint requires.
function wilayaIdByName(name) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return null;
  for (const id in WILAYA_NAMES) {
    if (WILAYA_NAMES[id][1].toLowerCase() === n) return Number(id);
  }
  return null;
}

async function writeCarrierData(db, name, wilayaIds, communesByW, feeTable, centersByW) {
  const ids = wilayaIds.map(Number).filter((id) => WILAYA_NAMES[id]).sort((a, b) => a - b);
  const wilayas = ids.map((id) => ({ id, ar: WILAYA_NAMES[id][0], fr: WILAYA_NAMES[id][1] }));
  const communes = {};
  Object.keys(communesByW).forEach((wid) => {
    const seen = new Set(); const out = [];
    (communesByW[wid] || []).forEach((n) => { const t = String(n || '').trim(); if (t && !seen.has(t)) { seen.add(t); out.push(t); } });
    out.sort((a, b) => a.localeCompare(b));
    communes[String(wid)] = out;
  });
  const fees = {};
  ids.forEach((id) => { const f = feeTable[id]; if (f) fees[String(id)] = { home: f[0], desk: f[1] }; });
  // Stop desks (agency offices) — same shape as `communes` above (keyed by
  // wilaya id) but each entry is a {id, name, address} object instead of a
  // plain string, since desk names alone aren't guaranteed unique within a
  // wilaya and the checkout dropdown needs a stable value to select by.
  const centers = {};
  let centerCount = 0;
  Object.keys(centersByW || {}).forEach((wid) => {
    const seen = new Set(); const out = [];
    (centersByW[wid] || []).forEach((c) => {
      const id = c && c.id != null ? String(c.id) : '';
      const cname = c && String(c.name || '').trim();
      if (!id || !cname || seen.has(id)) return;
      seen.add(id);
      out.push({ id, name: cname, address: (c.address && String(c.address).trim()) || '' });
    });
    out.sort((a, b) => a.name.localeCompare(b.name));
    if (out.length) { centers[String(wid)] = out; centerCount += out.length; }
  });
  await db.collection('delivery_data').doc(name).set({ wilayas, communes, centers, fees, updatedAt: Date.now() });
  return { wilayas: wilayas.length, communes: Object.values(communes).reduce((a, b) => a + b.length, 0), centers: centerCount };
}

// Noest exposes the partner's real per-wilaya grid at /api/public/fees
// (tarifs.delivery[wilaya] = { tarif: home, tarif_stopdesk: desk }). Use it so
// delivery_data/noest (what the storefront reads) is priced from real fees
// instead of the NOEST_FEES placeholder. Returns {} on failure so the caller
// falls back to NOEST_FEES rather than writing empty fees. `headers` carries the
// Noest bearer token.
async function noestFeeTable(headers) {
  try {
    const res = await noestFetch(NOEST_BASE + '/api/public/fees', { headers });
    if (!res.ok) return {};
    const body = await res.json();
    const delivery = (body && body.tarifs && body.tarifs.delivery) || {};
    const table = {};
    for (const k in delivery) {
      const d = delivery[k] || {};
      const code = Number(d.wilaya_id || k);
      const home = parseInt(d.tarif, 10);
      const desk = parseInt(d.tarif_stopdesk, 10);
      if (code && !isNaN(home) && !isNaN(desk)) table[code] = [home, desk];
    }
    return table;
  } catch (e) {
    return {};
  }
}

// Yalidine's /v1/fees endpoint is per (from_wilaya_id, to_wilaya_id) route —
// unlike Noest/ZR it exposes no single "all routes" call, so build the table
// with one request per destination wilaya, using the account's origin wilaya as
// the fixed `from_wilaya_id`. Each response's per_commune breakdown is collapsed
// to one [home, desk] per wilaya via mode (mirrors zrFeeTable — communes are
// uniform in practice). Kept deliberately gentle (low concurrency + a pause
// between batches) — an earlier version fired 8-at-a-time and appears to have
// tripped Yalidine's abuse protection, which then connect-timed-out every
// request (even the unrelated wilaya/commune list calls) for a while after.
// Returns {} if the origin can't be resolved or every request fails, so the
// caller falls back to the YAL_FEES placeholder; individual wilaya failures are
// skipped rather than aborting the whole sync.
async function yalidineFeeTable(headers, fromWilayaId, wilayaIds) {
  if (!fromWilayaId) return {};
  const mode = (m) => {
    const e = Object.entries(m);
    if (!e.length) return null;
    e.sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]));
    return Number(e[0][0]);
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const table = {};
  const CONCURRENCY = 2;
  const BATCH_DELAY_MS = 400;
  for (let i = 0; i < wilayaIds.length; i += CONCURRENCY) {
    const batch = wilayaIds.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (toId) => {
      try {
        const url = `${API_BASE}/fees/?from_wilaya_id=${fromWilayaId}&to_wilaya_id=${toId}`;
        const res = await fetch(url, { headers });
        if (!res.ok) return;
        const body = await res.json();
        const perCommune = (body && body.per_commune) || {};
        const home = {}, desk = {};
        Object.values(perCommune).forEach((c) => {
          if (typeof c.express_home === 'number') home[c.express_home] = (home[c.express_home] || 0) + 1;
          if (typeof c.express_desk === 'number') desk[c.express_desk] = (desk[c.express_desk] || 0) + 1;
        });
        const h0 = mode(home), d0 = mode(desk);
        const h = h0 != null ? h0 : d0; // if one side is missing, reuse the other
        const d = d0 != null ? d0 : h0; // so no delivery type is ever free
        if (h != null && d != null) table[String(toId)] = [h, d];
      } catch (e) { /* skip this wilaya, keep the rest */ }
    }));
    if (i + CONCURRENCY < wilayaIds.length) await sleep(BATCH_DELAY_MS);
  }
  return table;
}

// Yalidine's stop-desk (center) list. GET /v1/centers returns EVERY center
// nationwide in one paginated call (~99 total, per Yalidine's own docs) — the
// same has_more/page pagination already used for communes above — so this is
// one or two requests, not one per wilaya. (An earlier version called
// `/centers/?wilaya_id=` once per wilaya — 58 extra requests stacked right
// after yalidineFeeTable's own 58 — which is what tripped Yalidine's abuse
// protection and made every one of those calls fail.)
async function yalidineCenters(headers) {
  const byW = {};
  let page = 1, more = true;
  while (more && page <= 4) {
    const res = await fetch(`${API_BASE}/centers/?page_size=1000&page=${page}`, { headers });
    if (!res.ok) break;
    const body = await res.json();
    (body.data || []).forEach((c) => {
      if (c.wilaya_id == null) return;
      const wid = String(c.wilaya_id);
      (byW[wid] = byW[wid] || []).push({
        id: c.center_id,
        name: c.name || c.commune_name || '',
        address: c.address || '',
      });
    });
    more = !!body.has_more;
    page++;
  }
  return byW;
}

// Noest's stop-desk list — a single call returns every desk nationwide (same
// endpoint createNoestParcel already uses per-order); group by the wilaya id
// encoded as the leading digits of each desk's `code`.
async function noestCenters(headers) {
  const byW = {};
  try {
    const res = await noestFetch(NOEST_BASE + '/api/public/desks', { headers });
    if (!res.ok) return byW;
    const raw = await res.json();
    const arr = Array.isArray(raw) ? raw : Object.values(raw);
    arr.forEach((d) => {
      const code = String((d && d.code) || '');
      const m = code.match(/^(\d+)/);
      if (!m || !code) return;
      const wid = String(parseInt(m[1], 10));
      const name = d.name || d.station_name || d.commune_name || d.commune || code;
      const address = d.address || d.adresse || '';
      (byW[wid] = byW[wid] || []).push({ id: code, name, address });
    });
  } catch (e) { /* return whatever was collected before the failure */ }
  return byW;
}

// ZR Express's stop-desk (hub) list — same `/hubs/search` call zrFindHub
// already makes per-order, fetched once here and grouped by wilaya `code`
// via the territory rows already fetched for the commune sync above.
async function zrCenters(headers, rows) {
  const wCodeById = {};
  rows.forEach((t) => { if (t.level === 'wilaya' && Number(t.code)) wCodeById[t.id] = Number(t.code); });

  const byW = {};
  try {
    const { res, body } = await zrFetch(ZR_BASE + '/hubs/search', {
      method: 'POST', headers, body: JSON.stringify({ pageNumber: 1, pageSize: 1000 }),
    });
    if (!res.ok) return byW;
    const hubs = (body && (body.items || body.data || body.results)) || [];
    hubs.forEach((hub) => {
      if (!hub || !hub.isPickupPoint) return;
      const cityId = hub.address && hub.address.cityTerritoryId;
      const code = cityId != null ? wCodeById[cityId] : null;
      if (!code) return;
      const name = hub.name || hub.label || (hub.address && (hub.address.street || hub.address.name)) || 'مكتب';
      const address = (hub.address && hub.address.street) || '';
      (byW[String(code)] = byW[String(code)] || []).push({ id: hub.id, name, address });
    });
  } catch (e) { /* return whatever was collected before the failure */ }
  return byW;
}

exports.syncCarriers = onCall(
  { region: 'us-central1', timeoutSeconds: 480 },
  async () => {
    const db = admin.firestore();
    const yalSnap = await db.collection('private').doc('yalidine').get();
    const noSnap = await db.collection('private').doc('noest').get();
    const setSnap = await db.collection('site_settings').limit(1).get();
    const settings = setSnap.empty ? {} : setSnap.docs[0].data();
    const yal = yalSnap.exists ? yalSnap.data() : {};
    const no = noSnap.exists ? noSnap.data() : {};
    const out = {};

    // Each carrier is an independent, unrelated API — a timeout or outage on
    // one (Yalidine's has intermittently connect-timed-out — see comment on
    // yalidineFeeTable) must not prevent the other two from syncing. Every
    // carrier block is wrapped so a failure is recorded per-carrier and the
    // function still returns partial success instead of erroring out whole.

    // YALIDINE
    if (yal.apiId && yal.apiToken) {
      try {
        const h = { 'X-API-ID': String(yal.apiId), 'X-API-TOKEN': String(yal.apiToken) };
        const wj = await (await fetch('https://api.yalidine.app/v1/wilayas/?page_size=100', { headers: h })).json();
        const wIds = (wj.data || []).map((w) => w.id);
        const byW = {};
        let page = 1, more = true;
        while (more && page <= 4) {
          const cj = await (await fetch('https://api.yalidine.app/v1/communes/?page_size=1000&page=' + page, { headers: h })).json();
          (cj.data || []).forEach((c) => { if (c.is_deliverable) { (byW[c.wilaya_id] = byW[c.wilaya_id] || []).push(c.name); } });
          more = !!cj.has_more; page++;
        }
        const yalCenters = await yalidineCenters(h);
        const fromWilayaId = wilayaIdByName(settings.originWilaya);
        const yalFees = await yalidineFeeTable(h, fromWilayaId, wIds);
        out.yalidine = await writeCarrierData(db, 'yalidine', wIds, byW, Object.keys(yalFees).length ? yalFees : YAL_FEES, yalCenters);
      } catch (e) {
        out.yalidine = { error: (e && e.message) || String(e) };
      }
    }

    // NOEST
    if (no.apiToken) {
      try {
        const h = { Authorization: 'Bearer ' + String(no.apiToken), Accept: 'application/json' };
        const wRaw = await (await noestFetch('https://app.noest-dz.com/api/public/get/wilayas', { headers: h })).json();
        const wArr = (Array.isArray(wRaw) ? wRaw : Object.values(wRaw)).filter((w) => w.is_active != 0);
        const cRaw = await (await noestFetch('https://app.noest-dz.com/api/public/get/communes', { headers: h })).json();
        const cArr = Array.isArray(cRaw) ? cRaw : Object.values(cRaw);
        const byW = {};
        cArr.forEach((c) => { if (c.is_active != 0) { (byW[c.wilaya_id] = byW[c.wilaya_id] || []).push(c.nom); } });
        const noestFees = await noestFeeTable(h);
        const noestCntrs = await noestCenters(h);
        out.noest = await writeCarrierData(db, 'noest', wArr.map((w) => w.code), byW, Object.keys(noestFees).length ? noestFees : NOEST_FEES, noestCntrs);
      } catch (e) {
        out.noest = { error: (e && e.message) || String(e) };
      }
    }

    // ZR EXPRESS — its wilaya/commune list is keyed by UUID territory, not the
    // standard 1-58 numbering. Normalise the list to the same shape as
    // Yalidine/Noest (by wilaya `code`), and price it from ZR's own live rates
    // (zrFeeTable) so the storefront shows ZR's real fees — falling back to the
    // YAL_FEES placeholder only if the rates call fails.
    const zrSnap = await db.collection('private').doc('zrexpress').get();
    const zr = zrSnap.exists ? zrSnap.data() : {};
    if (zr.tenantId && zr.secretKey) {
      try {
        const rows = await zrAllTerritories(zrHeaders(zr));

        const wilayaIds = [];
        const codeById = {}; // wilaya UUID -> numeric wilaya code
        rows.forEach((t) => {
          if (t.level !== 'wilaya') return;
          const del = t.delivery || {};
          if (del.hasHomeDelivery === false && !del.hasPickupPoint) return;
          const code = Number(t.code);
          if (!code) return;
          wilayaIds.push(code); codeById[t.id] = code;
        });
        const byW = {};
        rows.forEach((t) => {
          if (t.level !== 'commune' || !t.parentId || codeById[t.parentId] == null) return;
          const del = t.delivery || {};
          if (del.hasHomeDelivery === false && !del.hasPickupPoint) return;
          (byW[codeById[t.parentId]] = byW[codeById[t.parentId]] || []).push(t.name);
        });
        const zrFees = await zrFeeTable(zrHeaders(zr), rows);
        const zrCntrs = await zrCenters(zrHeaders(zr), rows);
        out.zr = await writeCarrierData(db, 'zr', wilayaIds, byW, Object.keys(zrFees).length ? zrFees : YAL_FEES, zrCntrs);
      } catch (e) {
        out.zr = { error: (e && e.message) || String(e) };
      }
    }
    return { ok: true, result: out };
  }
);

/* ───────────────────────────────────────────────────────────────
   Notifications — email + web push on new orders / messages.

   Email: sent with nodemailer through Gmail SMTP. The Gmail address and
   an App Password are entered in the admin Settings page and stored in
   the server-only doc `private/notify` ({ gmail, appPass }).

   Web push: VAPID keys are auto-generated on first use and kept in
   `private/webpush`. Devices subscribe from the admin panel (getPushKey
   callable → PushManager.subscribe) and store their subscription in the
   `push_subs` collection; dead subscriptions are pruned on send.
   ─────────────────────────────────────────────────────────────── */
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const webpush = require('web-push');
const nodemailer = require('nodemailer');

const ADMIN_URL = 'https://www.desertshop.fit/amelhadj';

async function getVapidKeys(db) {
  const ref = db.collection('private').doc('webpush');
  const snap = await ref.get();
  if (snap.exists && snap.data().publicKey) return snap.data();
  const keys = webpush.generateVAPIDKeys();
  await ref.set(keys);
  return keys;
}

exports.getPushKey = onCall({ region: 'us-central1' }, async () => {
  const keys = await getVapidKeys(admin.firestore());
  return { publicKey: keys.publicKey };
});

async function sendPush(db, payload) {
  const keysSnap = await db.collection('private').doc('webpush').get();
  if (!keysSnap.exists) return; // no device ever subscribed
  const keys = keysSnap.data();
  webpush.setVapidDetails('mailto:tango0es@gmail.com', keys.publicKey, keys.privateKey);
  const subs = await db.collection('push_subs').get();
  const body = JSON.stringify(payload);
  await Promise.all(subs.docs.map(async (d) => {
    try {
      await webpush.sendNotification(JSON.parse(d.data().sub), body);
    } catch (e) {
      // 404/410 = subscription expired or unsubscribed — remove it.
      if (e.statusCode === 404 || e.statusCode === 410) await d.ref.delete().catch(() => {});
      else console.error('push failed', e.statusCode || e.message);
    }
  }));
}

async function sendEmail(db, subject, html) {
  const credSnap = await db.collection('private').doc('notify').get();
  const cred = credSnap.exists ? credSnap.data() : {};
  const gmail = String(cred.gmail || '').trim();
  const appPass = String(cred.appPass || '').replace(/\s/g, '');
  if (!gmail || !appPass) return; // email notifications not configured
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmail, pass: appPass },
  });
  await transporter.sendMail({
    from: `"Desert Shop" <${gmail}>`,
    to: gmail,
    subject,
    html: html + `<p style="margin-top:16px"><a href="${ADMIN_URL}">فتح لوحة التحكم</a></p>`,
  });
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function fmtDA(v) {
  const n = parseInt(String(v == null ? '' : v).replace(/[^0-9]/g, '') || '0', 10) || 0;
  return n.toLocaleString('en-US') + ' د.ج';
}

async function notifyAll(db, { title, text, html }) {
  const results = await Promise.allSettled([
    sendPush(db, { title, body: text, url: ADMIN_URL }),
    sendEmail(db, title, html),
  ]);
  results.forEach((r) => { if (r.status === 'rejected') console.error('notify failed', r.reason); });
}

exports.onNewOrder = onDocumentCreated(
  { document: 'orders/{id}', region: 'us-central1' },
  async (event) => {
    const o = event.data ? event.data.data() : null;
    if (!o) return;
    // Phone orders entered by the store owner herself — no self-notification.
    if (o.source === 'admin_phone') return;
    const db = admin.firestore();
    const items = (o.items || []).map((it) => `${it.title} ×${it.qty || it.quantity || 1}`);
    const title = `🛒 طلب جديد ${o.num || event.params.id} — ${fmtDA(o.total != null ? o.total : o.subtotal)}`;
    const text = `${o.customer || ''} · ${o.wilaya || ''} - ${o.baladiya || ''} · ${items.join('، ')}`;
    const html =
      `<div dir="rtl" style="font-family:sans-serif;line-height:1.8">` +
      `<h2 style="margin:0 0 8px">🛒 طلب جديد ${esc(o.num || event.params.id)}</h2>` +
      `<p style="margin:0"><b>الزبون:</b> ${esc(o.customer)} · <b dir="ltr">${esc(o.phone)}</b><br>` +
      `<b>العنوان:</b> ${esc(o.wilaya)} - ${esc(o.baladiya)} (${o.deliveryType === 'office' ? 'مكتب Stop Desk' : 'توصيل للمنزل'})<br>` +
      `<b>المنتجات:</b> ${items.map(esc).join('، ') || '—'}<br>` +
      `<b>المجموع:</b> ${fmtDA(o.total != null ? o.total : o.subtotal)}` +
      (o.deliveryFee != null ? ` (منتجات ${fmtDA(o.subtotal)} + توصيل ${fmtDA(o.deliveryFee)})` : '') +
      `</p></div>`;
    await notifyAll(db, { title, text, html });
  }
);

exports.onNewMessage = onDocumentCreated(
  { document: 'messages/{id}', region: 'us-central1' },
  async (event) => {
    const m = event.data ? event.data.data() : null;
    if (!m) return;
    const db = admin.firestore();
    const title = `💬 رسالة جديدة من ${m.name || 'زائر'}`;
    const text = String(m.message || '').slice(0, 180);
    const html =
      `<div dir="rtl" style="font-family:sans-serif;line-height:1.8">` +
      `<h2 style="margin:0 0 8px">💬 رسالة جديدة</h2>` +
      `<p style="margin:0"><b>الاسم:</b> ${esc(m.name)} · <b dir="ltr">${esc(m.phone || '—')}</b><br>` +
      `<b>الرسالة:</b> ${esc(m.message)}</p></div>`;
    await notifyAll(db, { title, text, html });
  }
);

// Manual check for the email settings — called from the admin Settings page.
exports.sendTestEmail = onCall({ region: 'us-central1' }, async () => {
  const db = admin.firestore();
  const credSnap = await db.collection('private').doc('notify').get();
  const cred = credSnap.exists ? credSnap.data() : {};
  if (!String(cred.gmail || '').trim() || !String(cred.appPass || '').trim()) {
    throw new HttpsError('failed-precondition', 'أدخلي بريد Gmail و App Password واحفظيهما أولاً');
  }
  try {
    await sendEmail(db, '✅ تجربة إشعارات Desert Shop',
      '<div dir="rtl" style="font-family:sans-serif">إعدادات البريد تعمل بنجاح 🎉 — ستصلكِ رسالة كهذه عند كل طلب أو رسالة جديدة.</div>');
  } catch (e) {
    if (e && (e.code === 'EAUTH' || e.responseCode === 535)) {
      throw new HttpsError('failed-precondition',
        'رفض Gmail تسجيل الدخول: تأكدي أن كلمة المرور هي App Password (وليست كلمة سر الحساب) وأن التحقق بخطوتين مفعّل');
    }
    throw new HttpsError('internal', 'فشل الإرسال: ' + (e && e.message ? e.message : e));
  }
  return { ok: true };
});

/* ───────────────────────────────────────────────────────────────
   Carrier webhooks — parcels push their own status changes instead of
   waiting for a manual 🔄 refresh.

   zrWebhook / yalidineWebhook are public HTTPS endpoints registered with
   the carriers via registerZrWebhook / registerYalidineWebhook (called
   from the admin Settings page, admin-only). Each verifies the request
   signature against a per-carrier secret stored in the server-only
   `private/*` doc, maps the carrier status through the SAME normalizers
   the manual refresh uses, and writes `trackingStatus` onto the matching
   order — the admin panel's live orders listener then moves the tracker
   in real time.
   ─────────────────────────────────────────────────────────────── */
const { onRequest } = require('firebase-functions/v2/https');
const crypto = require('crypto');

// Mirrors firestore.rules isAdmin() — onCall functions are otherwise
// callable by anyone, and the register calls can return webhook secrets.
function requireAdmin(req) {
  const email = req.auth && req.auth.token && req.auth.token.email;
  if (!email || ['tango0es@gmail.com', 'hadjajamel1988@gmail.com'].indexOf(email) === -1) {
    throw new HttpsError('permission-denied', 'هذه العملية للمسؤول فقط — سجّلي الدخول في لوحة التحكم.');
  }
}

async function orderByField(db, field, value) {
  if (!value) return null;
  const q = await db.collection('orders').where(field, '==', value).limit(1).get();
  return q.empty ? null : q.docs[0];
}

function webhookUrlFor(name) {
  return `https://us-central1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/${name}`;
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/* ───────── ZR Express (Svix-signed webhooks) ───────── */

// Standard Svix scheme: secret is base64 after the whsec_ prefix; the
// signature is HMAC-SHA256 over "<svix-id>.<svix-timestamp>.<raw body>",
// base64-encoded, listed space-separated as "v1,<sig>" in svix-signature.
function verifySvix(req, secret) {
  const id = String(req.headers['svix-id'] || '');
  const ts = String(req.headers['svix-timestamp'] || '');
  const sigHeader = String(req.headers['svix-signature'] || '');
  if (!id || !ts || !sigHeader) return false;
  const t = parseInt(ts, 10);
  if (!t || Math.abs(Math.floor(Date.now() / 1000) - t) > 300) return false; // replay guard
  const key = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64');
  const raw = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});
  const expected = crypto.createHmac('sha256', key).update(`${id}.${ts}.${raw}`).digest('base64');
  return sigHeader.split(/\s+/).some((part) => {
    const sig = part.split(',')[1] || '';
    try { return safeEqual(sig, expected); } catch (e) { return false; }
  });
}

// Events: parcel.state.updated / parcel.state.situation.created /
// parcel.isReturn.updated (see ZR's webhook integration guide).
exports.zrWebhook = onRequest({ region: 'us-central1' }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('POST only'); return; }
  try {
    const db = admin.firestore();
    const credSnap = await db.collection('private').doc('zrexpress').get();
    const secret = credSnap.exists ? String(credSnap.data().webhookSecret || '') : '';
    if (!secret || !verifySvix(req, secret)) { res.status(401).json({ error: 'invalid signature' }); return; }

    const ev = req.body || {};
    const type = String(ev.eventType || ev.type || '');
    const data = ev.data || {};
    // Parcels are keyed by their ZR UUID (zr.parcelId); older orders may
    // only carry the tracking number.
    const doc = (await orderByField(db, 'zr.parcelId', data.id)) ||
                (await orderByField(db, 'zr.tracking', data.trackingNumber || data.id));
    if (!doc) { res.status(200).json({ received: true, matched: false }); return; }
    const o = doc.data();

    let rawStatus = (data.state && data.state.name) || '';
    if (/isReturn/i.test(type) && (data.isReturn === true || data.isReturn === 'true') && !rawStatus) rawStatus = 'Retour';
    const content = (data.situation && (data.situation.name || data.situation.reason || data.situation.comment)) || data.reason || null;

    const prev = (o.trackingStatus && o.trackingStatus.carrier === 'zr') ? o.trackingStatus : {};
    const evs = Array.isArray(prev.events) ? prev.events.slice(-49) : [];
    const eid = String(req.headers['svix-id'] || '') || null;
    if (eid && evs.some((e) => e && e.id === eid)) { res.status(200).json({ received: true, duplicate: true }); return; }
    evs.push({
      id: eid, key: type, label: rawStatus || type,
      date: ev.occurredAt || new Date().toISOString(),
      location: null, by: null, content, causer: 'ZR WEBHOOK', badge: null,
    });

    const norm = zrNormalize(rawStatus);
    let stage = norm.stage;
    const alert = norm.alert;
    if (stage === -1) {
      console.log('[zrWebhook] unrecognized ZR status', JSON.stringify(rawStatus), 'tracking:', o.zr && o.zr.tracking);
      stage = (typeof prev.stage === 'number') ? prev.stage : 0;
    }
    const update = {
      trackingStatus: {
        carrier: 'zr', tracking: data.trackingNumber || o.zr.tracking,
        stage, alert, stageLabels: STAGE_LABELS,
        lastLabel: rawStatus || alert || 'بانتظار المعالجة',
        lastLocation: null,
        lastDate: ev.occurredAt || new Date().toISOString(),
        events: evs, updatedAt: Date.now(), viaWebhook: true,
      },
    };
    withOutcome(update, update.trackingStatus, o.outcome);
    // heal a not-yet-resolved tracking number, same as getParcelStatus
    if (data.trackingNumber && o.zr && data.trackingNumber !== o.zr.tracking) update['zr.tracking'] = data.trackingNumber;
    await doc.ref.update(update);
    res.status(200).json({ received: true });
  } catch (e) {
    console.error('zrWebhook', e);
    res.status(500).json({ error: 'internal' });
  }
});

// Registers (or reuses) the endpoint on ZR's side and stores its Svix
// secret in private/zrexpress. Idempotent — safe to click again.
exports.registerZrWebhook = onCall({ region: 'us-central1' }, async (req) => {
  requireAdmin(req);
  const db = admin.firestore();
  const cred = await zrCreds(db);
  const headers = zrHeaders(cred);
  const url = webhookUrlFor('zrWebhook');

  let ep = null;
  const list = await zrFetch(ZR_BASE + '/webhooks/endpoints', { method: 'GET', headers });
  if (list.res.ok) {
    const rows = (list.body && (list.body.items || list.body.data || list.body.results)) ||
      (Array.isArray(list.body) ? list.body : []);
    ep = rows.find((r) => r && r.url === url) || null;
  }
  if (!ep) {
    const { res, body } = await zrFetch(ZR_BASE + '/webhooks/endpoints', {
      method: 'POST', headers,
      body: JSON.stringify({
        url,
        description: 'Desert Shop — تتبع تلقائي',
        eventTypes: ['parcel.state.updated', 'parcel.state.situation.created', 'parcel.isReturn.updated'],
      }),
    });
    if (!(res.ok || res.status === 201) || !body || !body.id) {
      throw new HttpsError('internal', 'رفضت ZR Express تسجيل الـ Webhook: ' + zrErrMsg(body, res.status));
    }
    ep = body;
  }
  const { res: sRes, body: sBody } = await zrFetch(ZR_BASE + '/webhooks/endpoints/' + ep.id + '/secret', { method: 'GET', headers });
  const secret = sBody && (sBody.secret || sBody.key);
  if (!sRes.ok || !secret) throw new HttpsError('internal', 'تعذّر جلب سر التحقق من ZR: ' + zrErrMsg(sBody, sRes.status));
  await db.collection('private').doc('zrexpress').set(
    { webhookSecret: String(secret), webhookEndpointId: ep.id, webhookUrl: url, webhookAt: Date.now() },
    { merge: true }
  );
  return { ok: true, url };
});

/* ───────── Yalidine (crc_token handshake + HMAC signature) ───────── */

exports.yalidineWebhook = onRequest({ region: 'us-central1' }, async (req, res) => {
  // Subscription handshake: Yalidine sends GET ?crc_token=... and expects
  // the token echoed back.
  if (req.method === 'GET') { res.status(200).send(String(req.query.crc_token || 'ok')); return; }
  if (req.method !== 'POST') { res.status(405).send('POST only'); return; }
  try {
    const db = admin.firestore();
    const credSnap = await db.collection('private').doc('yalidine').get();
    const secret = credSnap.exists ? String(credSnap.data().webhookSecret || '') : '';
    if (!secret) { res.status(401).json({ error: 'webhook not configured' }); return; }
    const raw = req.rawBody ? req.rawBody : Buffer.from(JSON.stringify(req.body || {}));
    const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    const sig = String(req.headers['x-yalidine-signature'] || req.headers['x_yalidine_signature'] || '');
    let okSig = false;
    try { okSig = safeEqual(sig, expected); } catch (e) { okSig = false; }
    if (!okSig) { res.status(401).json({ error: 'invalid signature' }); return; }

    const body = req.body || {};
    const events = Array.isArray(body.events) ? body.events : [];
    for (const ev of events) {
      const d = (ev && ev.data) || {};
      const tracking = String(d.tracking || '').trim();
      if (!tracking) continue;
      const doc = await orderByField(db, 'yalidine.tracking', tracking);
      if (!doc) continue;
      const o = doc.data();
      const rawStatus = String(d.status || '');
      const { stage, alert } = yalidineNormalize(rawStatus);
      const prev = (o.trackingStatus && o.trackingStatus.carrier === 'yalidine') ? o.trackingStatus : {};
      const evs = Array.isArray(prev.events) ? prev.events.slice(-49) : [];
      const eid = ev.event_id ? String(ev.event_id) : null;
      if (eid && evs.some((e) => e && e.id === eid)) continue; // duplicate delivery
      evs.push({
        id: eid, key: rawStatus, label: rawStatus,
        date: ev.occurred_at || new Date().toISOString(),
        location: null, by: null, content: d.reason || null, causer: 'YALIDINE WEBHOOK', badge: null,
      });
      const yStatus = {
        carrier: 'yalidine', tracking, stage, alert, stageLabels: STAGE_LABELS,
        lastLabel: rawStatus || alert || 'بانتظار المعالجة',
        lastLocation: prev.lastLocation || null,
        lastDate: ev.occurred_at || new Date().toISOString(),
        events: evs, updatedAt: Date.now(), viaWebhook: true,
      };
      await doc.ref.update(withOutcome({ trackingStatus: yStatus }, yStatus, o.outcome));
    }
    res.status(200).json({ received: true });
  } catch (e) {
    console.error('yalidineWebhook', e);
    res.status(500).json({ error: 'internal' });
  }
});

// Creates the webhook subscription on Yalidine's side. Their webhook API
// isn't publicly documented, so if the API call is refused this returns
// { manual: true } with the endpoint URL + secret for the owner to paste
// into the Yalidine dashboard (admin-gated, so returning the secret to
// the caller is fine).
exports.registerYalidineWebhook = onCall({ region: 'us-central1' }, async (req) => {
  requireAdmin(req);
  const db = admin.firestore();
  const ref = db.collection('private').doc('yalidine');
  const credSnap = await ref.get();
  const cred = credSnap.exists ? credSnap.data() : {};
  if (!cred.apiId || !cred.apiToken) {
    throw new HttpsError('failed-precondition', 'احفظي مفاتيح Yalidine (API ID و Token) أولاً.');
  }
  let secret = String(cred.webhookSecret || '').trim();
  if (!secret) {
    secret = crypto.randomBytes(24).toString('hex');
    await ref.set({ webhookSecret: secret }, { merge: true });
  }
  const url = webhookUrlFor('yalidineWebhook');
  const headers = { 'X-API-ID': String(cred.apiId), 'X-API-TOKEN': String(cred.apiToken), 'Content-Type': 'application/json' };
  try {
    const res = await fetch(API_BASE + '/webhooks/', {
      method: 'POST', headers,
      body: JSON.stringify([{ url, events: ['parcel_status_updated'], secret }]),
    });
    const text = await res.text();
    let body; try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
    if (res.ok) {
      await ref.set({ webhookUrl: url, webhookAt: Date.now() }, { merge: true });
      return { ok: true, url };
    }
    console.log('registerYalidineWebhook API refused', res.status, typeof body === 'string' ? body.slice(0, 300) : JSON.stringify(body || {}).slice(0, 300));
    return { ok: false, manual: true, url, secret };
  } catch (e) {
    console.error('registerYalidineWebhook', e);
    return { ok: false, manual: true, url, secret };
  }
});

/* ───────────────────────────────────────────────────────────────
   Meta (Facebook) Pixel + Conversions API.

   The access token lives only in the server-only doc `private/meta`
   ({ accessToken, testEventCode }), entered on the admin Settings page —
   never sent to the browser (private/** is unreadable by clients, see
   firestore.rules). The public Pixel ID lives in `site_settings`
   (metaPixelId), the same doc the storefront already reads.

   sendMetaEvent() is the shared CAPI utility: it hashes PII with SHA-256
   per Meta's spec and posts to the Conversions API. It never throws — a
   Meta outage or a bad/missing token must never break an order or a page.

   Purchase is NOT sent from the logMetaEvent callable below. It's only
   ever sent by onOrderCreatedMetaPurchase, a Firestore trigger that fires
   after an order document actually exists in Firestore — so a Purchase
   CAPI event can never be sent just because a client called a function.
   ─────────────────────────────────────────────────────────────── */

const META_GRAPH_VERSION = 'v26.0';

function sha256(v) { return crypto.createHash('sha256').update(String(v)).digest('hex'); }
// Meta requires PII match fields lowercased, trimmed, then SHA-256 hashed.
function hashField(v) {
  const s = String(v == null ? '' : v).trim().toLowerCase();
  return s ? sha256(s) : undefined;
}
// Numbers are stored locally as 0X XXXXXXXX; Meta wants E.164 digits, no "+".
function hashPhone(v) {
  let digits = String(v || '').replace(/[^0-9]/g, '');
  if (!digits) return undefined;
  if (digits.charAt(0) === '0') digits = '213' + digits.slice(1);
  else if (digits.slice(0, 3) !== '213') digits = '213' + digits;
  return sha256(digits);
}
function clientIp(rawReq) {
  if (!rawReq) return undefined;
  const fwd = rawReq.headers && rawReq.headers['x-forwarded-for'];
  return fwd ? String(fwd).split(',')[0].trim() : rawReq.ip;
}

async function getMetaCreds(db) {
  const snap = await db.collection('private').doc('meta').get();
  return snap.exists ? snap.data() : {};
}
async function getMetaPixelId(db) {
  const snap = await db.collection('site_settings').get();
  const doc = snap.docs[0];
  return doc ? doc.data().metaPixelId : null;
}

// Shared CAPI sender. Always resolves (never throws) — callers decide what,
// if anything, to persist about the outcome.
async function sendMetaEvent(eventName, { eventId, eventSourceUrl, userData, customData, actionSource }) {
  const db = admin.firestore();
  const [creds, pixelId] = await Promise.all([getMetaCreds(db), getMetaPixelId(db)]);
  const token = creds && creds.accessToken;
  if (!token || !pixelId) return { ok: false, reason: 'not-configured' };

  const payload = {
    data: [{
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      event_source_url: eventSourceUrl,
      action_source: actionSource || 'website',
      user_data: userData || {},
      custom_data: customData || {},
    }],
  };
  if (creds.testEventCode) payload.test_event_code = creds.testEventCode;

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`;
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('[meta] CAPI error', eventName, res.status, body && body.error && body.error.message);
      return { ok: false, reason: 'api-error' };
    }
    return { ok: true };
  } catch (e) {
    console.error('[meta] CAPI request failed', eventName, e && e.message);
    return { ok: false, reason: 'request-failed' };
  }
}

// ViewContent / AddToCart / InitiateCheckout — called from the browser right
// after the matching Pixel event (js/meta.js Meta.track()), passing the same
// event_id both sides so Meta deduplicates them into one event. Purchase is
// refused here on purpose; see the trigger below.
const META_ALLOWED_EVENTS = ['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout'];

exports.logMetaEvent = onCall({ region: 'us-central1' }, async (req) => {
  const d = req.data || {};
  if (!META_ALLOWED_EVENTS.includes(d.eventName)) throw new HttpsError('invalid-argument', 'unsupported event');
  if (!d.eventId) throw new HttpsError('invalid-argument', 'eventId is required');

  const rawReq = req.rawRequest;
  const userData = {
    client_ip_address: clientIp(rawReq),
    client_user_agent: rawReq && rawReq.headers && rawReq.headers['user-agent'],
  };
  if (d.fbp) userData.fbp = d.fbp;
  if (d.fbc) userData.fbc = d.fbc;

  return sendMetaEvent(d.eventName, {
    eventId: d.eventId,
    eventSourceUrl: d.eventSourceUrl,
    userData,
    customData: d.customData || {},
    actionSource: 'website',
  });
});

/* Purchase — fires only from here, after the order document has actually
   been created in Firestore (never from client code / logMetaEvent above).
   Idempotent: writes meta.purchaseSent onto the order so a Firestore retry
   of this trigger can never send the event twice. Reuses the exact event_id
   the browser used for its fbq('track','Purchase', ...) call
   (order.metaEventId, set in checkout.html / collagen.html) so Meta
   deduplicates the two copies into one event. Skips seller-entered phone
   orders (source: admin_phone) — that's the seller's own browser, not a
   customer's web conversion. */
exports.onOrderCreatedMetaPurchase = onDocumentCreated(
  { document: 'orders/{orderId}', region: 'us-central1' },
  async (event) => {
    const snap = event.data;
    const o = snap ? snap.data() : null;
    if (!o) return;
    if (o.source === 'admin_phone') return;
    if (!o.metaEventId) return; // can't dedupe safely without the browser's id
    if (o.meta && o.meta.purchaseSent) return; // already sent (trigger retry)

    const items = o.items || [];
    const customData = {
      currency: 'DZD',
      value: o.total != null ? o.total : o.subtotal,
      content_ids: items.map((it) => String(it.id)),
      content_type: 'product',
      contents: items.map((it) => ({ id: String(it.id), quantity: it.qty || it.quantity || 1 })),
      num_items: items.reduce((n, it) => n + (it.qty || it.quantity || 1), 0),
      order_id: event.params.orderId,
    };
    const nameParts = String(o.customer || '').trim().split(/\s+/).filter(Boolean);
    const userData = {
      ph: hashPhone(o.phone),
      fn: hashField(nameParts[0]),
      ln: nameParts.length > 1 ? hashField(nameParts.slice(1).join(' ')) : undefined,
      ct: hashField(o.communeFr || o.baladiya),
      st: hashField(o.wilayaFr || o.wilaya),
      country: hashField('dz'),
      external_id: hashField(event.params.orderId),
    };
    if (o.fbp) userData.fbp = o.fbp;
    if (o.fbc) userData.fbc = o.fbc;
    Object.keys(userData).forEach((k) => { if (userData[k] === undefined) delete userData[k]; });

    const result = await sendMetaEvent('Purchase', {
      eventId: 'purchase_' + o.metaEventId,
      eventSourceUrl: o.pageUrl,
      userData,
      customData,
      actionSource: 'website',
    });

    await snap.ref.set({
      meta: {
        purchaseEventId: 'purchase_' + o.metaEventId,
        purchaseSent: !!result.ok,
        purchaseSentAt: Date.now(),
        purchaseError: result.ok ? null : (result.reason || 'unknown'),
      },
    }, { merge: true }).catch((e) => console.error('[meta] failed to write order.meta', e.message));
  }
);

/* ═══════════════════════════════════════════════════════════════
   MARKETING — Meta ad spend ingestion
   ═══════════════════════════════════════════════════════════════
   Pulls daily ad-level insights out of the Meta Marketing API into
   `marketing/meta/insights/{YYYY-MM-DD}_{adId}`, so the growth
   dashboard can join real spend against the attributed orders that
   Phase 1 started stamping (lib/attribution.ts in desert-ghost).

   WHY AD LEVEL, NOT CAMPAIGN LEVEL
   --------------------------------
   Campaign totals hide the variance that decides what to scale. In
   this account the Glutathione campaign averages ~€6.34 per purchase,
   but its "Primary" ad alone runs ~€10 — the campaign is being carried
   by its other ads. Campaign and ad-set figures are just sums of these
   rows, so storing the finest level loses nothing.

   WHY THE LAST 14 DAYS, EVERY RUN
   -------------------------------
   Meta keeps revising a day's attributed conversions after the fact as
   its attribution windows close. Writing each day once would freeze the
   first, wrong answer. Re-fetching a rolling window and overwriting is
   what keeps the numbers true, and is why the doc id is deterministic.

   WHY IT NEVER THROWS
   -------------------
   Ad credentials are the owner's to supply and may be missing, expired,
   or lacking `ads_read`. None of that is an error worth failing a
   scheduled job over: the function logs why, writes nothing, and the
   dashboard shows orders and margin with spend simply absent. Same
   fail-safe posture as sendMetaEvent above.

   NO FILTERING HAPPENS HERE. This ad account is shared with an
   unrelated business, but the Desert Shop campaign allowlist is applied
   when the dashboard READS these rows, not when they are written.
   Filtering on write would permanently discard spend that a later
   correction to the allowlist needs, and would make "spend we haven't
   classified yet" impossible to show. Storage is cheap; lost data is not.
   ─────────────────────────────────────────────────────────────── */

const INSIGHTS_WINDOW_DAYS = 14;
const DEFAULT_EUR_TO_DZD = 260;

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

/* Meta returns conversions as an `actions` array of {action_type, value}
   rather than as named fields. Purchases appear under several action
   types depending on how the conversion was reported; take the largest
   rather than summing, since these overlap (an `omni_purchase` generally
   already includes the `offsite_conversion.fb_pixel_purchase` it came
   from, so adding them would double-count). */
function purchasesFromActions(actions) {
  if (!Array.isArray(actions)) return 0;
  const types = ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'];
  let best = 0;
  for (const a of actions) {
    if (a && types.indexOf(a.action_type) !== -1) {
      const v = Number(a.value) || 0;
      if (v > best) best = v;
    }
  }
  return best;
}

async function getAdsCreds(db) {
  const [metaSnap, setSnap] = await Promise.all([
    db.collection('private').doc('meta').get(),
    db.collection('site_settings').limit(1).get(),
  ]);
  const meta = metaSnap.exists ? metaSnap.data() : {};
  const settings = setSnap.empty ? {} : setSnap.docs[0].data();
  return {
    // A token minted specifically for ads reporting wins; the CAPI token is
    // tried as a fallback purely because it sometimes already carries
    // ads_read, which saves the owner a trip to Business Manager.
    token: meta.adsToken || meta.accessToken || null,
    accountId: String(settings.metaAdAccountId || '').replace(/^act_/, '').trim(),
    eurToDzd: Number(settings.eurToDzd) > 0 ? Number(settings.eurToDzd) : DEFAULT_EUR_TO_DZD,
  };
}

async function graphGet(path, params, token) {
  const qs = new URLSearchParams(Object.assign({ access_token: token }, params));
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${path}?${qs}`;
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body && body.error && body.error.message;
    const err = new Error(msg || `graph ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

/* Fetch + store the rolling window. Returns a summary rather than
   throwing, so both the schedule and the manual button can report the
   same outcome to the owner. */
async function runMetaInsightsSync() {
  const db = admin.firestore();
  const { token, accountId, eurToDzd } = await getAdsCreds(db);

  if (!token) return { ok: false, reason: 'no-token', written: 0 };
  if (!accountId) return { ok: false, reason: 'no-ad-account', written: 0 };

  const until = new Date();
  const since = new Date(until.getTime() - INSIGHTS_WINDOW_DAYS * 86400000);

  let rows = [];
  try {
    // Paginate: an account with many ads returns these in pages, and
    // stopping at the first would silently under-report spend.
    let next = null;
    let guard = 0;
    do {
      const body = next
        ? await (await fetch(next)).json()
        : await graphGet(`act_${accountId}/insights`, {
            level: 'ad',
            time_increment: '1',
            time_range: JSON.stringify({ since: ymd(since), until: ymd(until) }),
            fields: [
              'date_start', 'spend', 'impressions', 'clicks', 'actions',
              'campaign_id', 'campaign_name', 'adset_id', 'adset_name',
              'ad_id', 'ad_name',
            ].join(','),
            limit: '500',
          }, token);
      if (body && body.error) throw new Error(body.error.message || 'graph page error');
      rows = rows.concat((body && body.data) || []);
      next = body && body.paging && body.paging.next;
    } while (next && ++guard < 20);
  } catch (e) {
    console.error('[meta] insights fetch failed:', e && e.message);
    return { ok: false, reason: e && e.status === 403 ? 'forbidden' : 'fetch-failed', written: 0 };
  }

  let written = 0;
  // Firestore caps a batch at 500 writes; chunk so a busy account can't
  // exceed it.
  for (let i = 0; i < rows.length; i += 400) {
    const batch = db.batch();
    for (const r of rows.slice(i, i + 400)) {
      const date = r.date_start;
      const adId = r.ad_id;
      if (!date || !adId) continue;
      const spendEur = Number(r.spend) || 0;
      batch.set(
        db.collection('marketing').doc('meta').collection('insights').doc(`${date}_${adId}`),
        {
          date, adId,
          adName: r.ad_name || '',
          adsetId: r.adset_id || '',
          adsetName: r.adset_name || '',
          campaignId: r.campaign_id || '',
          campaignName: r.campaign_name || '',
          spendEur,
          // Converted at write time and stored WITH the rate used. Editing
          // the rate later must not retroactively rewrite past months —
          // last month's profit cannot change because today's rate did.
          spendDzd: Math.round(spendEur * eurToDzd),
          rate: eurToDzd,
          impressions: Number(r.impressions) || 0,
          clicks: Number(r.clicks) || 0,
          purchases: purchasesFromActions(r.actions),
          syncedAt: Date.now(),
        },
        { merge: true }
      );
      written++;
    }
    await batch.commit();
  }

  console.log(`[meta] insights synced ${written} ad-days at ${eurToDzd} DA/EUR`);
  return { ok: true, written, since: ymd(since), until: ymd(until), rate: eurToDzd };
}

// Nightly refresh. 03:00 Africa/Algiers — after the day has closed and
// well outside the hours the owner is working in the panel.
exports.syncMetaInsights = onSchedule(
  { schedule: '0 3 * * *', timeZone: 'Africa/Algiers', region: 'us-central1' },
  async () => {
    const result = await runMetaInsightsSync();
    if (!result.ok) console.warn('[meta] scheduled insights sync skipped:', result.reason);
  }
);

// Manual "sync now" from the admin panel — same code path as the
// schedule, so what the button does and what runs overnight can't drift.
exports.syncMetaInsightsNow = onCall({ region: 'us-central1' }, async (req) => {
  requireAdmin(req);
  return runMetaInsightsSync();
});

/* Campaign list for the dashboard's allowlist picker. Returns every
   campaign in the account — including the unrelated business's — because
   the owner is the one who decides which are Desert Shop's. */
exports.listMetaCampaigns = onCall({ region: 'us-central1' }, async (req) => {
  requireAdmin(req);
  const db = admin.firestore();
  const { token, accountId } = await getAdsCreds(db);
  if (!token) return { ok: false, reason: 'no-token', campaigns: [] };
  if (!accountId) return { ok: false, reason: 'no-ad-account', campaigns: [] };

  try {
    const body = await graphGet(`act_${accountId}/campaigns`, {
      fields: 'id,name,status,effective_status',
      limit: '500',
    }, token);
    const campaigns = ((body && body.data) || []).map((c) => ({
      id: c.id, name: c.name || '', status: c.effective_status || c.status || '',
    }));
    return { ok: true, campaigns };
  } catch (e) {
    console.error('[meta] listMetaCampaigns failed:', e && e.message);
    return { ok: false, reason: e && e.status === 403 ? 'forbidden' : 'fetch-failed', campaigns: [] };
  }
});
