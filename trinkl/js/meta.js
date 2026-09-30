/* ═══════════════════════════════════════════════════════════════
   Desert Shop — Meta Pixel + Conversions API (browser side)
   Exposes window.Meta. Loaded on every storefront page that also
   loads firebase-functions-compat.js.

   Meta.init(pixelId) is called from SiteUI.applySettings() (site.js)
   once site_settings loads, so the Pixel ID lives in Firestore
   (site_settings.metaPixelId / metaEnabled) instead of being
   hardcoded — same "public config, no secret in it" idea as the
   Firebase web config in js/firebase.js.

   The CAPI access token NEVER touches the browser: Meta.track()
   sends the server-side copy of an event through the `logMetaEvent`
   Cloud Function, which reads the token from the private/meta
   Firestore doc via the Admin SDK. Purchase is the one exception —
   its server-side leg is fired by a Firestore trigger on order
   creation (functions/index.js), never from this file, so a
   Purchase CAPI event can never be sent just because a button was
   clicked client-side.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  var ready = false, queue = [];

  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  function setCookie(name, value, days) {
    var d = new Date(); d.setTime(d.getTime() + days * 86400000);
    try { document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + d.toUTCString() + ';path=/'; } catch (e) {}
  }
  // Meta's documented _fbc format when only the click id is known:
  // fb.1.<ts_ms>.<fbclid>. Never overwrite an existing _fbc — fbevents.js
  // (once loaded) and this both only ever set it if it's missing.
  function ensureFbc() {
    var fbc = getCookie('_fbc');
    if (fbc) return fbc;
    var fbclid = '';
    try { fbclid = new URLSearchParams(window.location.search).get('fbclid') || ''; } catch (e) {}
    if (!fbclid) return '';
    fbc = 'fb.1.' + Date.now() + '.' + fbclid;
    setCookie('_fbc', fbc, 90);
    return fbc;
  }
  function newEventId(prefix) {
    var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    return prefix ? prefix + '_' + id : id;
  }

  // ───────── Pixel base code (standard snippet, loads fbevents.js) ─────────
  function loadPixelScript() {
    if (window.fbq) return;
    var n = window.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!window._fbq) window._fbq = n;
    n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
    var t = document.createElement('script'); t.async = true; t.src = 'https://connect.facebook.net/en_US/fbevents.js';
    var s = document.getElementsByTagName('script')[0];
    s && s.parentNode ? s.parentNode.insertBefore(t, s) : document.head.appendChild(t);
  }

  function init(pixelId) {
    if (!pixelId || ready) return;
    ready = true;
    loadPixelScript();
    ensureFbc();
    fbq('init', pixelId);
    fbq('track', 'PageView');
    queue.forEach(function (args) { fbq.apply(null, args); });
    queue = [];
  }

  // Fire an event through the browser Pixel and, unless opts.skipCapi, the
  // server CAPI copy — same event_id both sides so Meta deduplicates them.
  // Returns the event_id used, so callers (e.g. checkout Purchase) can
  // reuse it when writing the order to Firestore.
  function track(eventName, customData, opts) {
    opts = opts || {};
    var eventId = opts.eventId || newEventId(eventName.toLowerCase());
    var args = ['track', eventName, customData || {}, { eventID: eventId }];
    if (ready) fbq.apply(null, args); else queue.push(args);

    if (!opts.skipCapi) {
      try {
        if (window.firebase && firebase.functions) {
          firebase.functions().httpsCallable('logMetaEvent')({
            eventName: eventName,
            eventId: eventId,
            eventSourceUrl: window.location.href,
            customData: customData || {},
            fbp: getCookie('_fbp'),
            fbc: getCookie('_fbc')
          }).catch(function (e) { console.error('[Meta] logMetaEvent', e); });
        }
      } catch (e) { console.error('[Meta] logMetaEvent', e); }
    }
    return eventId;
  }

  window.Meta = {
    init: init,
    track: track,
    newEventId: newEventId,
    getFbp: function () { return getCookie('_fbp'); },
    getFbc: function () { return ensureFbc(); }
  };
})();
