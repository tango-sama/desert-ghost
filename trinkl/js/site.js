/* ═══════════════════════════════════════════════════════════════
   Desert Shop — shared site behavior
   nav scroll · mobile menu · reveal-on-scroll · product-card markup
   ═══════════════════════════════════════════════════════════════ */
(function () {
  var SITE = window.SITE = {
    WA: '213662705830',                 // default WhatsApp (overridden by settings.waNumber)
    name: 'Desert Shop',
    instagram: '', facebook: '', tiktok: ''
  };

  function num(n) { return Number(n || 0).toLocaleString('en-US'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  var PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#FBEEEA"/><text x="50%" y="50%" font-size="120" text-anchor="middle" dominant-baseline="central">🌸</text></svg>');

  // ───────── per-category color (admin-set, with a stable fallback palette) ─────────
  var CAT_PALETTE = ['#F2A65A', '#7FB77E', '#5AA9E6', '#E07A9E', '#C792EA', '#5FC9A8', '#E6B655', '#EF9C8B'];
  function catColor(c) {
    if (c && c.color) return c.color;
    var key = String((c && (c.id || c.name)) || '');
    var h = 0; for (var i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return CAT_PALETTE[h % CAT_PALETTE.length];
  }
  function hexRgb(hex) {
    var c = String(hex || '').replace('#', '');
    if (c.length === 3) c = c.split('').map(function (x) { return x + x; }).join('');
    var n = parseInt(c, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function hexToRgba(hex, alpha) { var rgb = hexRgb(hex); return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha + ')'; }
  function contrastText(hex) {
    var rgb = hexRgb(hex);
    var yiq = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
    return yiq >= 150 ? '#3A2A30' : '#FFFFFF';
  }

  // ───────── product card (shared by home + products pages) ─────────
  function productCardHTML(p, catName) {
    var imgs = (window.DS && DS.productImages) ? DS.productImages(p) : (p.image ? [p.image] : []);
    var img = imgs[0] || PLACEHOLDER;
    var price = (window.DS && DS.priceFmt) ? DS.priceFmt(p.price) : (p.price || '');
    var cat = catName || '';
    var sub = p.subtitle || '';
    return '' +
      '<article class="pcard" data-id="' + esc(p.id) + '">' +
        '<a class="pcard-img" href="product.html?id=' + encodeURIComponent(p.id) + '">' +
          (p.badge ? '<span class="pcard-badge">' + esc(p.badge) + '</span>' : '') +
          '<img src="' + esc(img) + '" alt="' + esc(p.title || p.name) + '" loading="lazy" onerror="this.src=\'' + PLACEHOLDER + '\'">' +
        '</a>' +
        '<div class="pcard-body">' +
          (cat ? '<div class="pcard-cat">' + esc(cat) + '</div>' : '') +
          '<a class="pcard-name" href="product.html?id=' + encodeURIComponent(p.id) + '">' + esc(p.title || p.name) + '</a>' +
          (sub ? '<div class="pcard-sub">' + esc(sub) + '</div>' : '') +
          '<div class="pcard-foot">' +
            '<span class="pcard-price">' + esc(price) + '</span>' +
            '<button class="pcard-add" data-add="' + esc(p.id) + '" aria-label="أضف للسلة" title="أضف للسلة">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  // delegated "add to cart" for any [data-add] button (needs the product list in window._DS_PRODUCTS)
  function wireAddButtons() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-add]'); if (!btn) return;
      e.preventDefault();
      var id = btn.getAttribute('data-add');
      var list = window._DS_PRODUCTS || [];
      var p = list.find(function (x) { return String(x.id) === String(id); });
      if (p && window.Cart) Cart.add(p);
    });
  }

  // ───────── nav scroll + mobile burger ─────────
  function wireNav() {
    var nav = document.querySelector('nav.site-nav');
    if (nav) {
      var onScroll = function () { nav.classList.toggle('scrolled', window.scrollY > 30); };
      window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    }
    var burger = document.querySelector('.burger');
    var menu = document.querySelector('.nav-menu');
    if (burger && menu) burger.addEventListener('click', function () { menu.classList.toggle('open'); });
  }

  // ───────── reveal on scroll ─────────
  var io;
  function observeReveals(root) {
    if (!io) io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    (root || document).querySelectorAll('.reveal:not(.in)').forEach(function (el) { io.observe(el); });
  }

  // ───────── apply settings (WA number, social, store name) ─────────
  function applySettings(s) {
    if (!s) return;
    if (s.waNumber) SITE.WA = String(s.waNumber).replace(/[^0-9]/g, '');
    // WhatsApp kill-switch (admin setting) — hide every WA button/link when off
    SITE.waEnabled = s.waEnabled !== false;
    document.querySelectorAll('[data-wa], .wa-float, .btn-whatsapp').forEach(function (el) {
      el.style.display = SITE.waEnabled ? '' : 'none';
    });
    if (s.storeName) SITE.name = s.storeName;
    if (s.instagram) SITE.instagram = s.instagram;
    if (s.facebook) SITE.facebook = s.facebook;
    if (s.tiktok) SITE.tiktok = s.tiktok;
    // Meta Pixel: id + on/off live in site_settings (admin Settings page);
    // Meta.init() is idempotent and only starts the pixel once.
    if (s.metaPixelId && s.metaEnabled !== false && window.Meta) Meta.init(s.metaPixelId);
    // wire WA links that opted in
    document.querySelectorAll('[data-wa]').forEach(function (a) {
      var txt = a.getAttribute('data-wa') || '';
      a.href = 'https://wa.me/' + SITE.WA + (txt ? '?text=' + encodeURIComponent(txt) : '');
    });
    // wire social links from settings — show only the ones that are configured
    var social = { instagram: SITE.instagram, facebook: SITE.facebook, tiktok: SITE.tiktok };
    Object.keys(social).forEach(function (k) {
      var url = normalizeUrl(social[k]);
      document.querySelectorAll('[data-social="' + k + '"]').forEach(function (a) {
        if (url) { a.href = url; a.style.display = ''; } else { a.style.display = 'none'; }
      });
    });
    // TikTok live floating button — shown when "live now" is on AND not expired
    var liveUrl = '';
    if (s.tiktokLiveUrl) liveUrl = normalizeUrl(s.tiktokLiveUrl);
    else if (SITE.tiktok) liveUrl = normalizeUrl(SITE.tiktok).replace(/\/+$/, '') + '/live';
    var liveHours = Number(s.tiktokLiveHours) || 2;
    var endsAt = (Number(s.tiktokLiveAt) || 0) + liveHours * 3600000;
    var remaining = s.tiktokLiveAt ? (endsAt - Date.now()) : (s.tiktokLive ? 86400000 : 0);
    var liveActive = !!s.tiktokLive && remaining > 0;
    document.querySelectorAll('.tiktok-live').forEach(function (a) {
      if (liveActive && liveUrl) {
        a.href = liveUrl; a.classList.add('on');
        // auto-hide for visitors still on the page when the live window ends
        if (remaining > 0 && remaining < 86400000) setTimeout(function () { a.classList.remove('on'); }, remaining);
      } else { a.classList.remove('on'); }
    });
  }

  // accept full URLs or bare handles/links; ensure an absolute https:// URL
  function normalizeUrl(v) {
    v = String(v == null ? '' : v).trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) return v;
    return 'https://' + v.replace(/^\/+/, '');
  }

  function init() { wireNav(); wireAddButtons(); observeReveals(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.SiteUI = {
    productCardHTML: productCardHTML, observeReveals: observeReveals,
    applySettings: applySettings, num: num, esc: esc, PLACEHOLDER: PLACEHOLDER,
    catColor: catColor, hexToRgba: hexToRgba, contrastText: contrastText,
    waLink: function (text) { return 'https://wa.me/' + SITE.WA + (text ? '?text=' + encodeURIComponent(text) : ''); }
  };
})();
