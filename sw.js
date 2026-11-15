// Clean-up only: the offline app has been withdrawn. This removes its saved copies once,
// unregisters itself and reloads open pages so they show the current site.
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil((async()=>{
  for(const k of await caches.keys())await caches.delete(k);
  await self.registration.unregister();
  for(const c of await self.clients.matchAll({type:"window"}))c.navigate(c.url);
})()));
