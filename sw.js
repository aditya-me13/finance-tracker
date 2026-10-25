const CACHE_NAME='finance-tracker-v1';
const APP_SHELL=[
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './js/state.js',
  './js/helpers.js',
  './js/ui-common.js',
  './js/balances.js',
  './js/sidebar.js',
  './js/investments.js',
  './js/transactions.js',
  './js/views.js',
  './js/budget.js',
  './js/calculator.js',
  './js/charts-analytics.js',
  './js/app.js',
  './js/tags.js',
  './js/recurring.js',
  './js/loans.js',
  './js/bulk-actions.js',
  './js/shortcuts.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache=>cache.addAll(APP_SHELL))
      .then(()=>self.skipWaiting())
      .catch(()=>{}) // don't block install if one asset fails (e.g. offline first install)
  );
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

/* Stale-while-revalidate for same-origin GET requests only.
   Firebase/Firestore/Chart.js CDN calls pass straight through to the network
   (the app already has its own localStorage fallback for offline data). */
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(e.request.method!=='GET'||url.origin!==self.location.origin)return;
  e.respondWith(
    caches.match(e.request).then(cached=>{
      const network=fetch(e.request).then(resp=>{
        if(resp&&resp.status===200){
          const copy=resp.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(e.request,copy));
        }
        return resp;
      }).catch(()=>cached);
      return cached||network;
    })
  );
});
