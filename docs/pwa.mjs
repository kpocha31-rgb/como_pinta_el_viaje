const installButton=document.getElementById('install-app');
const installStatus=document.getElementById('install-status');
const installDialog=document.getElementById('install-dialog');
const updateButton=document.getElementById('update-app');
const displayMode=matchMedia('(display-mode: standalone)');
let installPrompt=null,registration=null,reloadOnUpdate=false,installedThisSession=false;
const standalone=()=>displayMode.matches||navigator.standalone===true;
function offlineUnavailable(){document.documentElement.dataset.pwaWorker='unavailable';installStatus.textContent='Instalala desde el menú de tu navegador.';document.querySelector('.install-offline-note').textContent='El modo sin conexión no pudo prepararse en este navegador. La app puede seguir usándose con Internet.';}
function syncInstall(){
 const installed=standalone()||installedThisSession;
 installButton.disabled=installed;
 installButton.textContent=installed?'App instalada':'Instalar app';
 installStatus.textContent=installed?'Abrila desde su ícono en el celular.':installPrompt?'Lista para instalar con su propio ícono.':'Ícono propio y una ventana de app.';
 document.documentElement.dataset.pwaMode=standalone()?'standalone':'browser';
}
function showInstructions(){
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 document.getElementById('install-instructions').innerHTML=ios?
  '<ol><li>Abrí este enlace en <strong>Safari</strong>.</li><li>Tocá <strong>Compartir</strong> y <strong>Agregar a Inicio</strong>.</li><li>Confirmá con <strong>Agregar</strong>.</li></ol>':
  '<ol><li>Abrí este enlace en <strong>Chrome</strong> en tu celular.</li><li>Tocá el menú <strong>⋮</strong> y buscá <strong>Instalar y crear acceso directo → Instalar</strong>.</li><li>En algunas versiones figura como <strong>Agregar a la pantalla principal → Instalar</strong>.</li></ol>';
 installDialog.showModal();
}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;syncInstall()});
window.addEventListener('appinstalled',()=>{installPrompt=null;installedThisSession=true;syncInstall();if(installDialog.open)installDialog.close()});
displayMode.addEventListener('change',syncInstall);
installButton.addEventListener('click',async()=>{
 if(standalone()||installedThisSession)return;
 if(!installPrompt){showInstructions();return}
 const prompt=installPrompt;installPrompt=null;
 try{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')installedThisSession=true;}catch{showInstructions()}
 syncInstall();
});
document.getElementById('install-close').addEventListener('click',()=>installDialog.close());
document.getElementById('install-done').addEventListener('click',()=>installDialog.close());
installDialog.addEventListener('click',event=>{if(event.target===installDialog){const r=installDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)installDialog.close()}});
updateButton.addEventListener('click',()=>{if(registration?.waiting){reloadOnUpdate=true;updateButton.disabled=true;registration.waiting.postMessage({type:'APPLY_UPDATE'})}});
function offerUpdate(){if(registration?.waiting&&navigator.serviceWorker.controller){updateButton.hidden=false;updateButton.disabled=false;}}
function notify(message){document.dispatchEvent(new CustomEvent('pinta-status',{detail:message}))}
syncInstall();
window.addEventListener('offline',()=>notify('Sin conexión: se muestra la última consulta guardada.'));
window.addEventListener('online',()=>notify('Volvió la conexión. Podés actualizar el pronóstico.'));
if('serviceWorker' in navigator&&window.isSecureContext){
 window.addEventListener('load',async()=>{
  try{
   registration=await navigator.serviceWorker.register(new URL('./sw.js',import.meta.url),{scope:new URL('./',import.meta.url).pathname,updateViaCache:'none'});
   document.documentElement.dataset.pwaWorker='registered';offerUpdate();
   const watchWorker=worker=>worker?.addEventListener('statechange',()=>{if(worker.state==='installed')offerUpdate();if(worker.state==='redundant'&&!registration.active)offlineUnavailable()});
   watchWorker(registration.installing);registration.addEventListener('updatefound',()=>watchWorker(registration.installing));
   navigator.serviceWorker.addEventListener('controllerchange',()=>{document.documentElement.dataset.pwaWorker='ready';if(reloadOnUpdate)location.reload()});
   await navigator.serviceWorker.ready;document.documentElement.dataset.pwaWorker='ready';
  }catch{offlineUnavailable();}
 });
}else document.documentElement.dataset.pwaWorker='unsupported';
