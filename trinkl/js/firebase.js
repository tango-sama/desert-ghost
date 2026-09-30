/* ═══════════════════════════════════════════════════════════════
   Desert Shop — Firebase data layer (compat SDK)
   Project: desert-shop-24af9 · exposes window.DS with all helpers.
   Reads/writes the EXISTING Firestore schema (no migration).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  var firebaseConfig = {
    apiKey: "AIzaSyAP_qj-4hpHN6Vjn8ZbcnqRfzB5SvOmgmM",
    authDomain: "desert-shop-24af9.firebaseapp.com",
    projectId: "desert-shop-24af9",
    storageBucket: "desert-shop-24af9.firebasestorage.app",
    messagingSenderId: "791427566190",
    appId: "1:791427566190:web:9b6f2a8f90dbb8f8b6f47f",
    measurementId: "G-LYPS3KBY0W"
  };

  if (typeof firebase === 'undefined') {
    console.error('[DS] Firebase SDK not loaded');
    window.DS = { ready: false };
    return;
  }
  try { firebase.initializeApp(firebaseConfig); } catch (e) { /* already initialized */ }
  var db = firebase.firestore();

  // ───────── helpers ─────────
  function mapDocs(snap) { return snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }); }

  // Parse "2500 DA" / 2500 → integer dinars
  function priceNum(v) {
    if (typeof v === 'number') return v;
    return parseInt(String(v == null ? '' : v).replace(/[^0-9]/g, '') || '0', 10) || 0;
  }
  // Format an integer back to a display string "2500 د.ج"
  function priceFmt(v) {
    var n = priceNum(v);
    return n.toLocaleString('en-US') + ' د.ج';
  }
  // description (string with newlines, or array) → array of benefit lines
  function benefits(desc) {
    if (Array.isArray(desc)) return desc.filter(Boolean);
    return String(desc || '').split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  // every image for a product: images[] if present, else [image]
  function productImages(p) {
    var arr = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
    if (!arr.length && p.image) arr = [p.image];
    return arr;
  }

  // ───────── reads ─────────
  function getProducts() {
    return db.collection('products').get().then(mapDocs).catch(function (e) {
      console.error('[DS] getProducts', e); return [];
    });
  }
  function getProduct(id) {
    return db.collection('products').doc(String(id)).get().then(function (d) {
      return d.exists ? Object.assign({ id: d.id }, d.data()) : null;
    }).catch(function (e) { console.error('[DS] getProduct', e); return null; });
  }
  function getCategories() {
    return db.collection('categories').get().then(function (snap) {
      return mapDocs(snap).sort(function (a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });
    }).catch(function (e) { console.error('[DS] getCategories', e); return []; });
  }
  function getFeatured() {
    return db.collection('featured_products').get().then(function (snap) {
      return mapDocs(snap).sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    }).catch(function (e) { console.error('[DS] getFeatured', e); return []; });
  }
  function getSettings() {
    return db.collection('site_settings').get().then(function (snap) {
      var list = mapDocs(snap); return list.length ? list[0] : {};
    }).catch(function (e) { console.error('[DS] getSettings', e); return {}; });
  }
  function getOrders() {
    return db.collection('orders').get().then(function (snap) {
      return mapDocs(snap).sort(function (a, b) {
        var ta = a.placedAt && a.placedAt.seconds ? a.placedAt.seconds * 1000 : (a.createdAt || 0);
        var tb = b.placedAt && b.placedAt.seconds ? b.placedAt.seconds * 1000 : (b.createdAt || 0);
        return tb - ta;
      });
    }).catch(function (e) { console.error('[DS] getOrders', e); return []; });
  }
  function getMessages() {
    return db.collection('messages').get().then(function (snap) {
      return mapDocs(snap).sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
    }).catch(function (e) { console.error('[DS] getMessages', e); return []; });
  }
  // Admin expense entries (stock purchases etc.), newest first
  function getExpenses() {
    return db.collection('expenses').get().then(function (snap) {
      return mapDocs(snap).sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    }).catch(function (e) { console.error('[DS] getExpenses', e); return []; });
  }
  // Synced carrier fee grid (e.g. Noest) → { "16": {home, desk}, ... } or null
  function getDeliveryFees(company) {
    return db.collection('delivery_fees').doc(company || 'noest').get()
      .then(function (d) { return d.exists ? (d.data().fees || null) : null; })
      .catch(function (e) { console.error('[DS] getDeliveryFees', e); return null; });
  }
  // Per-carrier wilaya/commune/fee lists → { wilayas, communes, fees } or null
  function getDeliveryData(carrier) {
    return db.collection('delivery_data').doc(carrier).get()
      .then(function (d) { return d.exists ? d.data() : null; })
      .catch(function (e) { console.error('[DS] getDeliveryData', e); return null; });
  }

  // ───────── writes (storefront) ─────────
  function saveOrder(order) {
    var data = Object.assign({
      status: 'New', fulfilled: false,
      placedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: Date.now()
    }, order);
    return db.collection('orders').add(data);
  }
  function saveMessage(msg) {
    return db.collection('messages').add(Object.assign({ timestamp: Date.now() }, msg));
  }

  // ───────── writes (admin) ─────────
  // products/categories/featured use numeric string ids (Date.now()) like the old admin
  function addDoc(coll, data) {
    if (data.id) return db.collection(coll).doc(String(data.id)).set(data).then(function () { return data; });
    return db.collection(coll).add(data).then(function (ref) { return Object.assign({ id: ref.id }, data); });
  }
  function updateDoc(coll, id, data) { return db.collection(coll).doc(String(id)).update(data); }
  function deleteDoc(coll, id) { return db.collection(coll).doc(String(id)).delete(); }
  function setDoc(coll, id, data) { return db.collection(coll).doc(String(id)).set(data); }

  // ───────── image upload (WebP convert → Storage) ─────────
  function convertToWebP(file) {
    return new Promise(function (resolve, reject) {
      if (!/^image\//.test(file.type) || /gif$/i.test(file.type)) return resolve(file);
      var reader = new FileReader();
      reader.onload = function (ev) {
        var img = new Image();
        img.onload = function () {
          var max = 1400, w = img.width, h = img.height;
          if (w > max || h > max) { var r = Math.min(max / w, max / h); w = Math.round(w * r); h = Math.round(h * r); }
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          canvas.toBlob(function (blob) {
            if (!blob) return reject(new Error('WebP conversion failed'));
            resolve(new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.webp', { type: 'image/webp' }));
          }, 'image/webp', 0.85);
        };
        img.onerror = reject; img.src = ev.target.result;
      };
      reader.onerror = reject; reader.readAsDataURL(file);
    });
  }
  function uploadImage(file, folder) {
    folder = folder || 'uploads';
    return convertToWebP(file).then(function (webp) {
      var ref = firebase.storage().ref().child(folder + '/' + Date.now() + '_' + webp.name);
      return ref.put(webp).then(function (snap) { return snap.ref.getDownloadURL(); });
    });
  }

  window.DS = {
    ready: true, db: db,
    // utils
    priceNum: priceNum, priceFmt: priceFmt, benefits: benefits, productImages: productImages,
    // reads
    getProducts: getProducts, getProduct: getProduct, getCategories: getCategories,
    getFeatured: getFeatured, getSettings: getSettings, getOrders: getOrders, getMessages: getMessages, getExpenses: getExpenses,
    getDeliveryFees: getDeliveryFees, getDeliveryData: getDeliveryData,
    // storefront writes
    saveOrder: saveOrder, saveMessage: saveMessage,
    // admin writes
    addDoc: addDoc, updateDoc: updateDoc, deleteDoc: deleteDoc, setDoc: setDoc, uploadImage: uploadImage,
    serverTimestamp: function () { return firebase.firestore.FieldValue.serverTimestamp(); }
  };
})();
