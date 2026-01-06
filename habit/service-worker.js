// Service Worker for Habit Tracker PWA
// Provides offline functionality and caching

const CACHE_NAME = 'habit-tracker-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './css/styles.css',
    './js/app.js',
    './js/habit.js',
    './js/storage.js',
    './js/ui.js',
    './js/notifications.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching app assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                console.log('[Service Worker] Installation complete');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[Service Worker] Installation failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[Service Worker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[Service Worker] Activation complete');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached version or fetch from network
                if (response) {
                    console.log('[Service Worker] Serving from cache:', event.request.url);
                    return response;
                }
                
                console.log('[Service Worker] Fetching from network:', event.request.url);
                return fetch(event.request)
                    .then((response) => {
                        // Don't cache non-successful responses
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Clone the response
                        const responseToCache = response.clone();
                        
                        // Add to cache for future use
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    })
                    .catch((error) => {
                        console.error('[Service Worker] Fetch failed:', error);
                        // Could return an offline fallback page here
                        throw error;
                    });
            })
    );
});

// Message event - handle messages from the app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[Service Worker] Received SKIP_WAITING message');
        self.skipWaiting();
    }
});

// Notification click event - open the app when notification is clicked
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification clicked:', event.notification.tag);
    event.notification.close();
    
    // Open or focus the app
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // If app is already open, focus it
                for (const client of clientList) {
                    if (client.url === '/' && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Otherwise, open a new window
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
    );
});

// Background sync event - for future use
self.addEventListener('sync', (event) => {
    console.log('[Service Worker] Background sync:', event.tag);
    // Could sync data here in the future
});
