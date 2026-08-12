const CACHE='plan-casa-v1';
const ASSETS=['./','index.html','styles.css','app.js','data/dashboard.json','manifest.webmanifest','assets/icon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('fetch',e=>{
  if(e.request.url.includes('data/dashboard.json')){e.respondWith(fetch(e.request).then(r=>{const clone=r.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));return r}).catch(()=>caches.match(e.request)));return;}
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
