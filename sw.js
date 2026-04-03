/**
 * ChequeShield Service Worker
 * Offline-First Caching Strategy
 * 
 * Caches:
 * - App shell (HTML, CSS, JS)
 * - Tailwind CSS CDN
 * - Lucide Icons CDN
 * - jsPDF CDN
 * - Cheque background images
 */

const CACHE_NAME = 'chequeshield-v1';
const OFFLINE_PAGE = '/offline.html';

// Resources to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index-pwa.html',
  '/offline.html',
  '/manifest.json',
  '/chequeshield-app.css'
];

// CDN resources to cache
const CDN_RESOURCES = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// Cheque background images
const CHEQUE_IMAGES = [
  '/hdfc-real-cheque-bg.svg',
  '/icici-real-cheque-bg.svg',
  '/axis-real-cheque-bg.svg',
  '/sbi-real-cheque-bg.svg',
  '/canon-m240-cheque-bg.svg'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[ServiceWorker] Caching CDN resources');
        return Promise.all(
          CDN_RESOURCES.map(url => {
            return fetch(url, { mode: 'cors' })
              .then(response => {
                if (response.ok) {
                  return caches.open(CACHE_NAME).then(cache => {
                    return cache.put(url, response);
                  });
                }
              })
              .catch(err => {
                console.log('[ServiceWorker] CDN resource not available:', url);
              });
          })
        );
      })
      .then(() => {
        console.log('[ServiceWorker] Caching cheque images');
        return caches.open(CACHE_NAME).then(cache => {
          return Promise.all(
            CHEQUE_IMAGES.map(url => {
              return fetch(url)
                .then(response => {
                  if (response.ok) {
                    return cache.put(url, response);
                  }
                })
                .catch(err => {
                  console.log('[ServiceWorker] Image not available:', url);
                });
            })
          );
        });
      })
      .then(() => {
        console.log('[ServiceWorker] Installation complete, skipping waiting');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName !== CACHE_NAME;
            })
            .map((cacheName) => {
              console.log('[ServiceWorker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[ServiceWorker] Activation complete, claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // For CDN resources, use cache-first strategy
        if (CDN_RESOURCES.some(cdn => event.request.url.includes(cdn))) {
          if (cachedResponse) {
            console.log('[ServiceWorker] Serving CDN from cache:', event.request.url);
            return cachedResponse;
          }
        }

        // For app assets, use network-first with cache fallback
        return fetch(event.request)
          .then((networkResponse) => {
            // Update cache with fresh content
            if (networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch((error) => {
            console.log('[ServiceWorker] Fetch failed, serving from cache:', event.request.url);
            
            // If it's a navigation request, serve offline page
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_PAGE);
            }
            
            // Return cached response or error
            return cachedResponse || error;
          });
      })
  );
});

// Message event - handle cache updates from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[ServiceWorker] Skip waiting triggered');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_IMAGE') {
    // Cache a dynamically loaded image
    const imageUrl = event.data.url;
    const imageId = event.data.id;
    
    caches.open(CACHE_NAME).then((cache) => {
      return fetch(imageUrl)
        .then(response => {
          if (response.ok) {
            return cache.put(imageUrl, response);
          }
        })
        .catch(err => {
          console.log('[ServiceWorker] Failed to cache image:', imageUrl);
        });
    });
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    // Clear specific cached items
    caches.open(CACHE_NAME).then((cache) => {
      if (event.data.urls) {
        event.data.urls.forEach(url => {
          cache.delete(url);
        });
      }
    });
  }
});

// Background sync for future features (e.g., syncing cheque records)
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Sync event:', event.tag);
  
  if (event.tag === 'sync-cheque-data') {
    event.waitUntil(
      // Future: Sync cheque data when online
      Promise.resolve()
    );
  }
});

// Push notifications for future features
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push received');
  
  const options = {
    body: event.data ? event.data.text() : 'ChequeShield Notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };
  
  event.waitUntil(
    self.registration.showNotification('ChequeShield', options)
  );
});
