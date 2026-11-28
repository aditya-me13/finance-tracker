const CACHE_NAME='finance-tracker-v24';
const APP_SHELL=[
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './js/state.js',
  './js/helpers.js',
  './js/market-days.js',
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
  './js/swipe.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
];

/* Versioned third-party libraries the page needs to start. Their URLs are pinned to a
   version, so cache-first is safe. Firestore/Auth API traffic is never cached. */
const CDN_HOSTS=['cdn.jsdelivr.net','www.gstatic.com','fonts.googleapis.com','fonts.gstatic.com'];
const CDN_ASSETS=[
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore-compat.js',
];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache=>Promise.all([
        cache.addAll(APP_SHELL),
        // no-cors: these are loaded by plain <script> tags, so the page accepts opaque copies
        ...CDN_ASSETS.map(u=>fetch(new Request(u,{mode:'no-cors'})).then(r=>cache.put(u,r)).catch(()=>{}))
      ]))
      .then(()=>self.skipWaiting())
      .catch(err=>console.warn('SW precache failed',err)) // don't block install if one asset fails
  );
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

/* Same-origin GETs: stale-while-revalidate.
   CDN libraries and fonts: cache-first (versioned URLs), so the installed app starts offline.
   Everything else (Firestore, Auth, stock-price proxy) passes straight through to the network
   (the app already has its own localStorage fallback for offline data). */
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(e.request.method!=='GET')return;
  if(CDN_HOSTS.includes(url.hostname)&&(url.hostname!=='www.gstatic.com'||url.pathname.startsWith('/firebasejs/'))){
    e.respondWith(caches.match(e.request,{ignoreVary:true}).then(hit=>hit||fetch(e.request).then(resp=>{
      if(resp&&(resp.ok||resp.type==='opaque')){const copy=resp.clone();caches.open(CACHE_NAME).then(c=>c.put(e.request,copy));}
      return resp;
    })));
    return;
  }
  if(url.origin!==self.location.origin)return;
  e.respondWith(
    caches.match(e.request).then(cached=>{
      const network=fetch(e.request).then(resp=>{
        if(resp&&resp.status===200){
          const copy=resp.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(e.request,copy));
        }
        return resp;
      }).catch(()=>cached||(e.request.mode==='navigate'?caches.match('./index.html'):Response.error()));
      return cached||network;
    })
  );
});
