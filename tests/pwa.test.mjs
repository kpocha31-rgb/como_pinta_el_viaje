import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import vm from 'node:vm';
const ROOT=new URL('../docs/',import.meta.url);
const source=await readFile(new URL('sw.js',ROOT),'utf8');
const manifest=JSON.parse(await readFile(new URL('manifest.webmanifest',ROOT),'utf8'));
const html=await readFile(new URL('index.html',ROOT),'utf8');
function worker(scope='https://example.test/como_pinta_el_viaje/'){
 const listeners={},stores=new Map();let mode='online',badPath='',claimed=false,skipped=false;
 const key=r=>typeof r==='string'?r:r.url;
 const caches={async open(name){if(!stores.has(name))stores.set(name,new Map());const data=stores.get(name);return {async put(r,res){data.set(key(r),res.clone())},async match(r){return data.get(key(r))?.clone()}}},async keys(){return [...stores.keys()]},async delete(name){return stores.delete(name)}};
 const fetch=async request=>{
  const url=new URL(key(request));
  if(mode==='offline')throw new TypeError('Offline');
  if(mode==='auth'&&(url.pathname===new URL(scope).pathname||url.pathname.endsWith('/index.html')))return new Response('<html>Iniciá sesión</html>',{headers:{'Content-Type':'text/html'}});
  if(url.pathname.endsWith(badPath)&&badPath)return new Response('Missing',{status:404});
  if(url.pathname.endsWith('/')||url.pathname.endsWith('/index.html'))return new Response(html,{headers:{'Content-Type':'text/html'}});
  if(url.pathname.endsWith('.webmanifest'))return new Response(JSON.stringify(manifest),{headers:{'Content-Type':'application/manifest+json'}});
  const type=url.pathname.endsWith('.css')?'text/css':url.pathname.endsWith('.png')?'image/png':url.pathname.endsWith('.svg')?'image/svg+xml':'text/javascript';
  return new Response('asset',{headers:{'Content-Type':type}});
 };
 const self={registration:{scope},clients:{async claim(){claimed=true}},addEventListener(name,handler){listeners[name]=handler},skipWaiting(){skipped=true}};
 vm.runInNewContext(source,{self,caches,fetch,URL,Request,Response,Set,Promise,Error});
 return {stores,setMode(m){mode=m},failPath(p){badPath=p},get claimed(){return claimed},get skipped(){return skipped},
  async lifecycle(name){let wait;listeners[name]({waitUntil(p){wait=p}});await wait},
  async request(url,{method='GET',mode='navigate'}={}){let response;listeners.fetch({request:{url,method,mode},respondWith(p){response=Promise.resolve(p)}});return response?{handled:true,response:await response}:{handled:false}},
  message(data){listeners.message({data})}};
}
test('El manifiesto identifica una app vertical con ventana propia en raíz y subcarpetas',()=>{
 assert.equal(manifest.display,'standalone');assert.equal(manifest.orientation,'portrait');assert.equal(manifest.prefer_related_applications,false);
 for(const base of ['https://example.test/','https://example.test/como_pinta_el_viaje/']){
  const scope=new URL(manifest.scope,base),start=new URL(manifest.start_url,base),id=new URL(manifest.id,base);
  assert.equal(start.origin,scope.origin);assert.ok(start.pathname.startsWith(scope.pathname));assert.equal(id.href,scope.href);
 }
 assert.match(html,/rel="manifest"/);assert.match(html,/pinta-app-shell/);assert.match(html,/apple-touch-icon/);
 assert.match(html,/<link[^>]*rel="manifest"[^>]*crossorigin="use-credentials"/);
});
test('Los íconos declarados existen y tienen los tamaños PNG correctos',async()=>{
 for(const size of [192,512])assert.ok(manifest.icons.some(i=>i.sizes===`${size}x${size}`&&i.purpose==='any'));
 assert.ok(manifest.icons.some(i=>i.purpose==='maskable'));
 for(const icon of manifest.icons){const png=await readFile(new URL(icon.src,ROOT));const [w,h]=icon.sizes.split('x').map(Number);assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),w);assert.equal(png.readUInt32BE(20),h)}
 const touch=await readFile(new URL('assets/app-icon-180.png',ROOT));assert.equal(touch.readUInt32BE(16),180);
});
test('La instalación prepara todos los archivos de la app y la activación toma control',async()=>{
 const w=worker();await w.lifecycle('install');await w.lifecycle('activate');assert.ok(w.claimed);const entries=[...w.stores.values()][0];
 for(const path of ['index.html','app.mjs','weather.mjs','pwa.mjs','assets/barrios.mjs','manifest.webmanifest'])assert.ok([...entries.keys()].some(k=>k.endsWith('/'+path)),path);
 for(const key of entries.keys()){const u=new URL(key);assert.ok(u.pathname.startsWith('/como_pinta_el_viaje/'));const relative=u.pathname.replace('/como_pinta_el_viaje/','');if(relative)await readFile(new URL(relative,ROOT))}
});
test('Sin Internet se abre la app instalada aunque el inicio lleve un parámetro PWA',async()=>{
 const w=worker();await w.lifecycle('install');w.setMode('offline');const r=await w.request('https://example.test/como_pinta_el_viaje/?source=pwa');assert.ok(r.handled);assert.match(await r.response.text(),/pinta-app-shell/);
 const js=await w.request('https://example.test/como_pinta_el_viaje/app.mjs',{mode:'cors'});assert.equal(js.response.status,200);
});
test('Sin una primera carga completa se explica que hace falta conexión',async()=>{
 const w=worker();w.setMode('offline');const r=await w.request('https://example.test/como_pinta_el_viaje/');assert.equal(r.response.status,503);assert.match(await r.response.text(),/Falta conexión/);
});
test('Las páginas de inicio de sesión no reemplazan la copia de la app',async()=>{
 const w=worker();await w.lifecycle('install');w.setMode('auth');const r=await w.request('https://example.test/como_pinta_el_viaje/');assert.match(await r.response.text(),/Iniciá sesión/);
 w.setMode('offline');const offline=await w.request('https://example.test/como_pinta_el_viaje/');assert.match(await offline.response.text(),/pinta-app-shell/);
});
test('La instalación falla antes de activar una copia incompleta',async()=>{
 const w=worker();w.failPath('app.mjs');await assert.rejects(w.lifecycle('install'),/App shell unavailable/);assert.equal(w.claimed,false);
});
test('No se interceptan pronósticos, geocodificación, login ni otras apps del mismo dominio',async()=>{
 const w=worker();for(const url of ['https://api.open-meteo.com/v1/forecast','https://geocoding-api.open-meteo.com/v1/search','https://example.test/como_pinta_el_viaje/signin-with-chatgpt','https://example.test/otra-app/','https://example.test/signout'])assert.equal((await w.request(url)).handled,false,url);
 assert.equal((await w.request('https://example.test/como_pinta_el_viaje/',{method:'POST'})).handled,false);
});
test('Una actualización elimina solamente cachés antiguas de esta misma app',async()=>{
 const w=worker();w.stores.set('pinta-shell:/como_pinta_el_viaje/:anterior',new Map());w.stores.set('pinta-shell:/otra-app/:anterior',new Map());w.stores.set('cache-ajena',new Map());await w.lifecycle('install');await w.lifecycle('activate');assert.equal(w.stores.has('pinta-shell:/como_pinta_el_viaje/:anterior'),false);assert.ok(w.stores.has('pinta-shell:/otra-app/:anterior'));assert.ok(w.stores.has('cache-ajena'));
});
test('La actualización activa la versión nueva solamente por una acción explícita',()=>{
 const w=worker();assert.equal(w.skipped,false);w.message({type:'OTHER'});assert.equal(w.skipped,false);w.message({type:'APPLY_UPDATE'});assert.equal(w.skipped,true);
});
