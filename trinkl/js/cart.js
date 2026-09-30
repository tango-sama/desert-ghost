/* ═══════════════════════════════════════════════════════════════
   Desert Shop — cart (localStorage) + slide-in drawer + nav badge
   Works across every static page. Exposes window.Cart.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  var KEY = 'ds_cart';
  var pn = function (v) { return (window.DS && DS.priceNum) ? DS.priceNum(v) : (parseInt(String(v).replace(/[^0-9]/g, '') || '0', 10) || 0); };

  function load() {
    try { var a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a.filter(Boolean) : []; }
    catch (e) { return []; }
  }
  function save(items) { localStorage.setItem(KEY, JSON.stringify(items)); }

  var items = load();

  function count() { return items.reduce(function (n, i) { return n + (i.quantity || 1); }, 0); }
  function total() { return items.reduce(function (n, i) { return n + pn(i.price) * (i.quantity || 1); }, 0); }

  function add(product, opts) {
    opts = opts || {};
    var ex = items.find(function (i) { return String(i.id) === String(product.id); });
    if (ex) { ex.quantity = (ex.quantity || 1) + 1; }
    else {
      items.push({ id: product.id, title: product.title || product.name || '', price: product.price || 0,
        image: product.image || (Array.isArray(product.images) ? product.images[0] : '') || '', quantity: 1 });
    }
    save(items); sync();
    if (window.Meta) {
      var price = pn(product.price);
      Meta.track('AddToCart', {
        content_ids: [String(product.id)], content_type: 'product',
        contents: [{ id: String(product.id), quantity: 1, item_price: price }],
        value: price, currency: 'DZD'
      });
    }
    if (opts.silent !== true) { toast('أُضيف إلى السلة'); openDrawer(); }
  }
  function setQty(id, q) {
    var it = items.find(function (i) { return String(i.id) === String(id); });
    if (!it) return;
    it.quantity = Math.max(1, q);
    save(items); sync(); renderDrawer();
  }
  function remove(id) { items = items.filter(function (i) { return String(i.id) !== String(id); }); save(items); sync(); renderDrawer(); }
  function clear() { items = []; save(items); sync(); renderDrawer(); }

  // ───────── badge ─────────
  function sync() {
    var c = count();
    document.querySelectorAll('.nav-cart .badge').forEach(function (b) {
      b.textContent = c; b.classList.toggle('show', c > 0);
    });
  }

  // ───────── toast ─────────
  var toastEl;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div'); toastEl.className = 'toast';
      toastEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg><span></span>';
      document.body.appendChild(toastEl);
    }
    toastEl.querySelector('span').textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t); toastEl._t = setTimeout(function () { toastEl.classList.remove('show'); }, 1900);
  }

  // ───────── drawer ─────────
  var overlay, drawer, body;
  function buildDrawer() {
    overlay = document.createElement('div'); overlay.className = 'cart-overlay';
    drawer = document.createElement('aside'); drawer.className = 'cart-drawer'; drawer.setAttribute('aria-label', 'سلة المشتريات');
    drawer.innerHTML =
      '<div class="cart-head"><h3>' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>' +
        ' سلة المشتريات</h3>' +
        '<button class="cart-close" aria-label="إغلاق"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>' +
      '</div>' +
      '<div class="cart-items"></div>' +
      '<div class="cart-foot">' +
        '<div class="cart-total"><span>المجموع</span><span><span class="num cart-total-v">0</span> د.ج</span></div>' +
        '<a class="btn-primary btn-block cart-checkout" href="checkout.html">إتمام الطلب</a>' +
      '</div>';
    document.body.appendChild(overlay); document.body.appendChild(drawer);
    body = drawer.querySelector('.cart-items');
    overlay.addEventListener('click', closeDrawer);
    drawer.querySelector('.cart-close').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });
  }
  function renderDrawer() {
    if (!body) return;
    if (!items.length) {
      body.innerHTML = '<div class="cart-empty"><div class="ce-ic">🛍️</div>سلتك فارغة<br><span style="font-size:.8rem;font-weight:500">أضيفي منتجاتك المفضلة</span></div>';
    } else {
      body.innerHTML = items.map(function (i) {
        var img = i.image ? '<img src="' + i.image + '" alt="">' : '';
        return '<div class="cart-item" data-id="' + i.id + '">' +
          '<div class="ci-img">' + img + '</div>' +
          '<div class="ci-info"><div class="ci-name">' + esc(i.title) + '</div>' +
            '<div class="ci-price">' + (window.DS ? DS.priceFmt(i.price) : i.price) + '</div>' +
            '<div class="ci-qty"><button class="qty-btn ci-dec">−</button><span class="ci-qv">' + (i.quantity || 1) + '</span><button class="qty-btn ci-inc">+</button></div>' +
          '</div>' +
          '<button class="ci-remove" aria-label="حذف"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>' +
        '</div>';
      }).join('');
    }
    var tv = drawer.querySelector('.cart-total-v'); if (tv) tv.textContent = total().toLocaleString('en-US');
    var ck = drawer.querySelector('.cart-checkout'); if (ck) ck.style.display = items.length ? '' : 'none';
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  function openDrawer() { if (!drawer) return; renderDrawer(); overlay.classList.add('open'); drawer.classList.add('open'); document.body.style.overflow = 'hidden'; }
  function closeDrawer() { if (!drawer) return; overlay.classList.remove('open'); drawer.classList.remove('open'); document.body.style.overflow = ''; }

  // delegated qty/remove inside drawer
  function wireDrawer() {
    drawer.addEventListener('click', function (e) {
      var row = e.target.closest('.cart-item'); if (!row) return;
      var id = row.getAttribute('data-id');
      var it = items.find(function (i) { return String(i.id) === String(id); }); if (!it) return;
      if (e.target.closest('.ci-inc')) setQty(id, (it.quantity || 1) + 1);
      else if (e.target.closest('.ci-dec')) setQty(id, (it.quantity || 1) - 1);
      else if (e.target.closest('.ci-remove')) remove(id);
    });
  }

  function init() {
    buildDrawer(); wireDrawer(); sync();
    // any element with [data-cart-open] toggles the drawer
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-cart-open]')) { e.preventDefault(); openDrawer(); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.Cart = {
    add: add, remove: remove, setQty: setQty, clear: clear,
    get: function () { return items.slice(); }, count: count, total: total,
    open: openDrawer, close: closeDrawer, toast: toast
  };
})();
