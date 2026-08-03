// ==================== NetShield Pro Service Worker ====================
const CACHE_NAME = 'netshield-pro-v5';
const STATIC_CACHE = 'netshield-static-v5';
const DYNAMIC_CACHE = 'netshield-dynamic-v5';

// ==================== INSTALL ====================
self.addEventListener('install', function(event) {
  console.log('[SW] Installing...');
  
  // تخطي الانتظار وتفعيل السيرفس ووركر فوراً
  event.waitUntil(self.skipWaiting());
  
  // تخزين الملفات الأساسية مؤقتاً
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function(cache) {
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.json',
        'https://cdn-icons-png.flaticon.com/512/564/564619.png'
      ]);
    })
  );
});

// ==================== ACTIVATE ====================
self.addEventListener('activate', function(event) {
  console.log('[SW] Activating...');
  
  // التحكم في كل الكلاينتس فوراً
  event.waitUntil(self.clients.claim());
  
  // تنظيف الكاش القديم
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// ==================== FETCH (Offline Support) ====================
self.addEventListener('fetch', function(event) {
  // تجاهل طلبات API (زي تيليجرام)
  if (event.request.url.includes('api.telegram.org')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then(function(cachedResponse) {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(event.request).then(function(response) {
        return caches.open(DYNAMIC_CACHE).then(function(cache) {
          cache.put(event.request.url, response.clone());
          return response;
        });
      }).catch(function() {
        return new Response('غير متصل بالإنترنت', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      });
    })
  );
});

// ==================== PUSH NOTIFICATIONS ====================
self.addEventListener('push', function(event) {
  console.log('[SW] Push received');
  
  let data = {
    title: 'NetShield Pro',
    body: 'تم استلام إشعار جديد',
    icon: 'https://cdn-icons-png.flaticon.com/512/564/564619.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/564/564619.png',
    vibrate: [200, 100, 200, 100, 200],
    sound: 'default',
    tag: 'netshield-notification',
    requireInteraction: true,
    actions: [
      { action: 'open', title: 'فتح التطبيق' },
      { action: 'close', title: 'إغلاق' }
    ],
    data: {
      url: '/',
      timestamp: Date.now()
    }
  };
  
  // لو فيه بيانات من السيرفر
  if (event.data) {
    try {
      const jsonData = event.data.json();
      data.title = jsonData.title || data.title;
      data.body = jsonData.body || data.body;
      data.data.url = jsonData.url || data.data.url;
    } catch(e) {
      data.body = event.data.text() || data.body;
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, data)
  );
});

// ==================== NOTIFICATION CLICK ====================
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked');
  
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  const urlToOpen = event.notification.data && event.notification.data.url 
    ? event.notification.data.url 
    : '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // لو فيه تبويبة مفتوحة بالفعل، ركز عليها
      for (let client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // غير كده، افتح تبويبة جديدة
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// ==================== MESSAGES FROM PAGE ====================
self.addEventListener('message', function(event) {
  console.log('[SW] Message received from page:', event.data);
  
  if (event.data && event.data.action === 'showNotification') {
    self.registration.showNotification(event.data.title || 'NetShield Pro', {
      body: event.data.body || '',
      icon: 'https://cdn-icons-png.flaticon.com/512/564/564619.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      data: { url: event.data.url || '/' }
    });
  }
  
  if (event.data && event.data.action === 'checkStatus') {
    // الرد على الصفحة بحالة السيرفس ووركر
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({
        status: 'active',
        timestamp: Date.now(),
        registration: self.registration.scope
      });
    }
  }
});

// ==================== SYNC (Background Sync) ====================
self.addEventListener('sync', function(event) {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'check-commands') {
    event.waitUntil(
      // محاولة إعادة الاتصال بالسيرفر
      fetch('/').then(function(response) {
        return response.ok;
      }).catch(function() {
        return false;
      })
    );
  }
});

// ==================== PERIODIC SYNC ====================
self.addEventListener('periodicsync', function(event) {
  console.log('[SW] Periodic sync:', event.tag);
  
  if (event.tag === 'health-check') {
    event.waitUntil(
      // فحص صحة السيرفس ووركر
      self.clients.matchAll().then(function(clients) {
        return clients.length > 0;
      })
    );
  }
});

// ==================== ERROR HANDLING ====================
self.addEventListener('error', function(event) {
  console.error('[SW] Error:', event.error);
});

console.log('[SW] Service Worker Loaded and Ready!');
