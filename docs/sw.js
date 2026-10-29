/* Generic app shell only. Forecasts, preferences, sign-in pages and external requests are never cached here. */
const VERSION='pwa-v1';
const BASE=new URL(self.registration.scope);
const PREFIX='pinta-shell:'+BASE.pathname+':';
const CACHE_NAME=PREFIX+VERSION;
const SHELL=[
 './','./index.html','./style.css','./app.mjs','./weather.mjs','./locations.mjs','./icons.mjs','./pwa.mjs',
 './assets/icons-data.mjs','./assets/barrios.mjs','./manifest.webmanifest','./assets/app-icon.svg',
 './assets/app-icon-180.png','./assets/app-icon-192.png','./assets/app-icon-512.png','./assets/app-icon-maskable-512.png'
];
const URLS=new Set(SHELL.map(path=>new URL(path,BASE).href));
const ROOT=new URL('./',BASE).href, INDEX=new URL('./index.html',BASE).href;
async function isAppResponse(response,url){
 if(!response||!response.ok||response.type==='opaque')return false;
 if(response.url&&new URL(response.url).origin!==BASE.origin)return false;
 const type=(response.headers.get('content-type')||'').toLowerCase();
 if(url===ROOT||url===INDEX){
  if(!type.includes('text/html'))return false;
  const html=await response.clone().text();
  return /<meta\s[^>]*name=["']pinta-app-shell["']/i.test(html);
 }
 if(type.includes('text/html'))return false;
 if(url.endsWith('.mjs'))return /javascript|ecmascript/.test(type);
 if(url.endsWith('.css'))return type.includes('text/css');
 if(url.endsWith('.png'))return type.includes('image/png');
 if(url.endsWith('.svg'))return type.includes('image/svg+xml');
 if(url.endsWith('.webmanifest')){try{return (await response.clone().json()).short_name==='Pinta el viaje'}catch{return false}}
 return false;
}
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_NAME);
  await Promise.all([...URLS].map(async url=>{
   const response=await fetch(new Request(url,{credentials:'same-origin',cache:'reload'}));
   if(!await isAppResponse(response,url))throw new Error('App shell unavailable');
   await cache.put(url,response);
  }));
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE_NAME).map(k=>caches.delete(k)));
  await self.clients.claim();
 })());
});
self.addEventListener('message',event=>{if(event.data?.type==='APPLY_UPDATE')self.skipWaiting()});
async function serve(request,key,navigation){
 const cache=await caches.open(CACHE_NAME);
 try{
  const response=await fetch(request);
  if(await isAppResponse(response,key)){await cache.put(key,response.clone());return response}
  // Auth redirects/errors must reach the browser, never become an offline login page.
  if(!navigation||response.status<500)return response;
  const cached=await cache.match(key)||await cache.match(ROOT)||await cache.match(INDEX);
  return cached||response;
 }catch{
  const cached=await cache.match(key)||(navigation?(await cache.match(ROOT)||await cache.match(INDEX)):null);
  if(cached)return cached;
  if(navigation)return new Response('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pinta el viaje · sin conexión</title><body><h1>Falta conexión</h1><p>Abrí Pinta el viaje con Internet una vez para dejarla disponible sin conexión.</p><p><a href="./">Volver a intentar</a></p></body></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});
  return new Response('',{status:503});
 }
}
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==BASE.origin)return;
 url.search='';url.hash='';const key=url.href;
 if(!URLS.has(key))return;
 const navigation=request.mode==='navigate';
 if(navigation&&key!==ROOT&&key!==INDEX)return;
 event.respondWith(serve(request,key,navigation));
});
