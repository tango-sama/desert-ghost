// Web-push service worker for admin notifications (orders / messages).
// Registered from the admin panel only; does not intercept any fetches.
self.addEventListener('push', function (event) {
  var d = {};
  try { d = event.data ? event.data.json() : {}; } catch {}
  event.waitUntil(self.registration.showNotification(d.title || 'Desert Shop', {
    body: d.body || '',
    icon: '/assets/logo.webp',
    badge: '/assets/logo.webp',
    dir: 'rtl',
    lang: 'ar',
    data: { url: d.url || '/amelhadj' }
  }));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/amelhadj';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].url.indexOf('/amelhadj') !== -1 && 'focus' in list[i]) return list[i].focus();
    }
    return clients.openWindow(url);
  }));
});
