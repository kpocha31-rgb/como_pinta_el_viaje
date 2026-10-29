import {TZ,PROFILES,localDate,addDays,dateLabel,validDate,validLocation,validateSettings,forecastURL,validPayload,routeKey,isStale,assessJourney,decide,equipment,sky,tripAdvice} from './weather.mjs';
import {icon,weatherIcon} from './icons.mjs';
import {searchLocations,localMatches,locationLabel} from './locations.mjs';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=0)=>Number.isFinite(n)?n.toLocaleString('es-AR',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const range=(a,b)=>Number.isFinite(a)?Math.round(a)===Math.round(b)?`${fmt(a)}°`:`${fmt(a)}–${fmt(b)}°`:'—';
const severityTone=s=>s===null?'neutral':['good','caution','bad'][s];
const vehicleNames={moto:'Moto',bici:'Bicicleta',mono:'Monopatín'},vehicleIcons={moto:'motorbike',bici:'bike',mono:'scooter'};
const PREF='pinta-viaje-settings-v2',CACHE='pinta-viaje-forecast-v2';
const read=k=>{try{return JSON.parse(localStorage.getItem(k))}catch{return null}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
const initial={origin:null,destination:null,vehicle:'mono',outStart:'06:00',outEnd:'07:00',backStart:'16:00',backEnd:'17:00',theme:'auto'};
let settings={...initial},draft={...initial},bundle=null,trips=[],selectedDate=localDate(),busy=false,fetchIssue='',detailsTab='out',requestNumber=0,requestController=null,toastTimer;
const stored=read(PREF);if(stored&&!validateSettings(stored))settings={...initial,...stored,theme:['light','dark','auto'].includes(stored.theme)?stored.theme:'auto'};
selectedDate=Date.now()>=Date.parse(localDate()+'T'+settings.outEnd+':00-03:00')?addDays(localDate(),1):localDate();
let draftDate=selectedDate;
const media=matchMedia('(prefers-color-scheme: dark)');
function applyTheme(){const actual=settings.theme==='auto'?(media.matches?'dark':'light'):settings.theme;document.documentElement.dataset.theme=actual;document.querySelector('meta[name="theme-color"]').content=actual==='dark'?'#111a15':'#f4f6f0';$('#theme-toggle').innerHTML=icon(settings.theme==='auto'?'monitor':actual==='dark'?'moon':'sun');$('#theme-toggle').setAttribute('aria-label',`Apariencia ${settings.theme==='auto'?'automática':actual==='dark'?'oscura':'clara'}. Cambiar apariencia`);$$('[data-theme-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.themeChoice===settings.theme)))}
media.addEventListener('change',()=>{if(settings.theme==='auto')applyTheme()});
function savePrefs(){if(!validateSettings(settings)&&!write(PREF,settings))toast('No se pudo guardar la configuración en este navegador.')}
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,5500)}
document.addEventListener('pinta-status',event=>{if(typeof event.detail==='string')toast(event.detail)});
$$('[data-icon]').forEach(e=>e.innerHTML=icon(e.dataset.icon));$('#settings-open').innerHTML=icon('sliders-horizontal');applyTheme();
function dateControls(){const today=localDate(),max=addDays(today,6);for(const id of ['travel-date','settings-date']){$('#'+id).min=today;$('#'+id).max=max;}$('#travel-date').value=selectedDate;const prefix=selectedDate===today?'Hoy':selectedDate===addDays(today,1)?'Mañana':dateLabel(selectedDate,{weekday:'long'});$('#date-label').textContent=`${prefix} · ${dateLabel(selectedDate,{day:'numeric',month:'short'})}`;}
function baseRender(){dateControls();$('#origin-name').textContent=settings.origin?.name||'Elegí tu origen';$('#destination-name').textContent=settings.destination?.name||'Elegí tu destino';$('#route-edit').setAttribute('aria-label',settings.origin&&settings.destination?`Editar viaje: ${locationLabel(settings.origin)} hacia ${locationLabel(settings.destination)}`:'Elegir origen y destino');$('#vehicle-edit').innerHTML=icon(vehicleIcons[settings.vehicle])+`<span>${vehicleNames[settings.vehicle]}</span>`;$('#refresh').disabled=busy||Boolean(validateSettings(settings));$('#refresh').classList.toggle('busy',busy);$('#refresh-label').textContent=busy?'Consultando…':'Actualizar';}
function setDecision(v){$('#decision').className='decision '+severityTone(v.severity);$('#decision').innerHTML=`<span class="eyebrow">TU JORNADA</span><h1>${esc(v.title)}</h1><p>${esc(v.reason)}</p>`}
function tripCard(t,index,stale=false){
 const out=index===0,start=out?settings.outStart:settings.backStart,end=out?settings.outEnd:settings.backEnd;
 const severity=stale?null:t?.severity??null,label=stale?'Actualizar':t?.past?'Ya pasó':tripAdvice(t,settings.vehicle).label;
 let condition=sky(t?.codes,t?.day??true);if(t?.prob>=30&&['sun','moon','partly','cloudmoon','cloud'].includes(condition.key))condition={key:'showers',label:'Posible lluvia'};
 const reason=stale?'Necesitamos una consulta actualizada':t?.reason||(busy?'Consultando ambas zonas…':'Sin pronóstico completo');
 return `<article class="trip-card"><div class="trip-header"><button class="trip-time" type="button" data-edit-time="${out?'out':'back'}" aria-label="Editar horarios de ${out?'ida':'vuelta'}">${out?'IDA':'VUELTA'} · ${start}–${end} ${icon('pencil')}</button><span class="badge ${severityTone(severity)}">${label}</span></div><div class="weather-row"><div class="weather-icon">${weatherIcon(condition.key)}</div><div class="weather-copy"><h2>${esc(t?.codes?condition.label:busy?'Consultando el clima':'Sin datos todavía')}</h2><p class="trip-reason">${esc(reason)}</p><div class="weather-numbers"><span aria-label="Probabilidad máxima de lluvia ${fmt(t?.prob)} por ciento">${icon('droplets')}${fmt(t?.prob)}%</span><span aria-label="Viento máximo ${fmt(t?.wind)} kilómetros por hora">${icon('wind')}${fmt(t?.wind)} km/h</span><span aria-label="Temperatura">${icon('thermometer')}${range(t?.tempMin,t?.tempMax)} C</span></div></div></div></article>`;
}
function render(){
 baseRender();
 if(validateSettings(settings)){setDecision({severity:null,title:'Armá tu próximo viaje',reason:'Elegí tus zonas, vehículo y horarios. Quedan guardados para la próxima.'});$('#trips').innerHTML=[0,1].map(i=>tripCard(null,i)).join('');$('#equipment p').textContent='Elegí tus zonas para consultar el pronóstico.';$('#updated').textContent='Pronóstico por zonas';return}
 const validBundle=bundle&&bundle.key===routeKey(settings),stale=validBundle&&isStale(bundle.fetchedAt);
 trips=validBundle?[assessJourney(bundle,settings,selectedDate,settings.outStart,settings.outEnd),assessJourney(bundle,settings,selectedDate,settings.backStart,settings.backEnd,true)]:[];
 const decision=trips.length?decide(trips,settings.vehicle,stale):{severity:null,title:busy?'Consultando tu viaje…':'Falta el pronóstico',reason:busy?'Miramos origen y destino para tus dos trayectos.':'No pudimos consultar ambas zonas. Tocá Actualizar para reintentar.'};
 setDecision(decision);$('#trips').innerHTML=[0,1].map(i=>tripCard(trips[i],i,stale)).join('');$('#equipment p').textContent=equipment(trips,settings.vehicle,stale);
 if(busy)$('#updated').textContent='Consultando ambas zonas';
 else if(validBundle){const time=new Intl.DateTimeFormat('es-AR',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(bundle.fetchedAt));const day=localDate(new Date(bundle.fetchedAt))===localDate()?'':dateLabel(localDate(new Date(bundle.fetchedAt)),{day:'numeric',month:'short'})+' ';$('#updated').textContent=`${stale?'Datos viejos':!navigator.onLine?'Sin conexión':fetchIssue?'Guardado':'Consultado'} ${day}${time}`;}
 else $('#updated').textContent=fetchIssue?'Sin conexión al pronóstico':'Sin datos';
 if($('#details-dialog').open)renderDetails();
}
async function refresh({silent=false}={}){
 if(validateSettings(settings))return;
 requestController?.abort();requestController=new AbortController();const controller=requestController,id=++requestNumber,key=routeKey(settings);
 busy=true;fetchIssue='';render();const timeout=setTimeout(()=>controller.abort(),18000);
 try{
  const locs=[settings.origin,settings.destination],get=async l=>{const r=await fetch(forecastURL(l),{signal:controller.signal,cache:'no-store'});if(!r.ok)throw new Error('forecast');const d=await r.json();if(!validPayload(d))throw new Error('invalid');return d};
  const same=locs[0].latitude===locs[1].latitude&&locs[0].longitude===locs[1].longitude;
  const points=same?await get(locs[0]).then(d=>[d,d]):await Promise.all(locs.map(get));
  if(id!==requestNumber||key!==routeKey(settings))return;
  bundle={key,points,fetchedAt:Date.now()};write(CACHE,bundle);
 }catch(e){
  if(id!==requestNumber)return;
  fetchIssue=bundle?.key===key?'No pudimos actualizar. Se conserva la última consulta con su fecha y hora.':'No pudimos consultar ambas zonas. Revisá tu conexión y tocá Actualizar.';
  if(!silent)toast(fetchIssue);
 }finally{clearTimeout(timeout);if(id===requestNumber){busy=false;render()}}
}
const searchState={};
function selectionNote(which){const l=draft[which];$('#'+which+'-selection').textContent=l?`${l.region} · ${l.description||'Zona seleccionada'}`:'Seleccioná una zona de las sugerencias.';}
function closeResults(which){$('#'+which+'-results').hidden=true;$('#'+which+'-search').setAttribute('aria-expanded','false')}
function renderResults(which,results,note=''){
 const list=$('#'+which+'-results'),input=$('#'+which+'-search');searchState[which].results=results;
 list.innerHTML=(note?`<p class="search-note">${esc(note)}</p>`:'')+results.map((l,i)=>`<button type="button" role="option" aria-selected="false" data-location-index="${i}"><strong>${esc(l.name)}</strong><small>${esc([l.region,l.description].filter(Boolean).join(' · '))}</small></button>`).join('');
 if(!results.length&&!note)list.innerHTML='<p class="search-note">No encontramos esa zona. Probá con la localidad y provincia.</p>';
 list.hidden=false;input.setAttribute('aria-expanded','true');
}
function choose(which,l){const ss=searchState[which];clearTimeout(ss.timer);ss.controller?.abort();ss.seq++;draft[which]=l;$('#'+which+'-search').value=l.name;selectionNote(which);closeResults(which);$('#form-error').hidden=true}
for(const which of ['origin','destination']){
 const input=$('#'+which+'-search'),list=$('#'+which+'-results');searchState[which]={timer:null,controller:null,seq:0,results:[]};
 input.addEventListener('focus',()=>{const q=input.value,local=localMatches(q);renderResults(which,local,q?'Barrios de CABA y búsqueda de localidades':'Barrios de CABA · escribí para buscar en Argentina')});
 input.addEventListener('input',()=>{
  const ss=searchState[which];clearTimeout(ss.timer);ss.controller?.abort();const seq=++ss.seq;draft[which]=null;selectionNote(which);const q=input.value;
  renderResults(which,localMatches(q),q.length>=3?'Buscando localidades…':'Escribí al menos 3 letras para buscar localidades');
  ss.timer=setTimeout(async()=>{ss.controller=new AbortController();const controller=ss.controller;const timer=setTimeout(()=>controller.abort(),10000);try{const r=await searchLocations(q,{signal:controller.signal});if(seq!==ss.seq)return;renderResults(which,r.results,r.error?'No pudimos buscar localidades. Se muestran las coincidencias disponibles de CABA.':'')}catch(e){if(seq===ss.seq)renderResults(which,localMatches(q),'La búsqueda tardó demasiado. Volvé a intentar.')}finally{clearTimeout(timer)}},320);
 });
 list.addEventListener('click',e=>{const b=e.target.closest('[data-location-index]');if(b)choose(which,searchState[which].results[Number(b.dataset.locationIndex)])});
 input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();list.querySelector('[role=option]')?.focus()}if(e.key==='Escape')closeResults(which);if(e.key==='Enter'){e.preventDefault();if(!list.hidden&&searchState[which].results.length===1)choose(which,searchState[which].results[0])}});
 list.addEventListener('keydown',e=>{const options=[...list.querySelectorAll('[role=option]')],i=options.indexOf(document.activeElement);if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();options[(i+(e.key==='ArrowDown'?1:-1)+options.length)%options.length]?.focus()}if(e.key==='Escape'){closeResults(which);input.focus()}});
}
document.addEventListener('pointerdown',e=>{for(const w of ['origin','destination'])if(!$('#'+w+'-search').closest('.place-field').contains(e.target))closeResults(w)});
function updateDraftVehicle(){for(const b of $$('[data-vehicle]'))b.setAttribute('aria-pressed',String(b.dataset.vehicle===draft.vehicle))}
function openSettings(focus){
 draft=structuredClone(settings);draftDate=selectedDate;$('#form-error').hidden=true;
 for(const w of ['origin','destination']){clearTimeout(searchState[w].timer);searchState[w].controller?.abort();searchState[w].seq++;$('#'+w+'-search').value=draft[w]?.name||'';selectionNote(w);closeResults(w)}
 for(const [key,id]of Object.entries({outStart:'out-start',outEnd:'out-end',backStart:'back-start',backEnd:'back-end'}))$('#'+id).value=draft[key];
 $('#settings-date').value=draftDate;updateDraftVehicle();applyTheme();$('#settings-dialog').showModal();if(focus)$('#'+focus)?.focus();
}
for(const id of ['settings-open','route-edit','vehicle-edit'])$('#'+id).addEventListener('click',()=>openSettings(id==='route-edit'?'origin-search':id==='vehicle-edit'?null:null));
$('#trips').addEventListener('click',e=>{const b=e.target.closest('[data-edit-time]');if(b)openSettings(b.dataset.editTime==='out'?'out-start':'back-start')});
$$('.close-dialog').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}}));
$$('[data-vehicle]').forEach(b=>b.addEventListener('click',()=>{draft.vehicle=b.dataset.vehicle;updateDraftVehicle()}));
$('#swap-locations').addEventListener('click',()=>{[draft.origin,draft.destination]=[draft.destination,draft.origin];for(const w of ['origin','destination']){$('#'+w+'-search').value=draft[w]?.name||'';selectionNote(w);closeResults(w)}});
$('#settings-form').addEventListener('submit',e=>{
 e.preventDefault();for(const[key,id]of Object.entries({outStart:'out-start',outEnd:'out-end',backStart:'back-start',backEnd:'back-end'}))draft[key]=$('#'+id).value;
 draftDate=$('#settings-date').value;const error=validateSettings(draft)||(!validDate(draftDate)?'Elegí una fecha entre hoy y los próximos 6 días.':'');
 $('#form-error').hidden=!error;$('#form-error').textContent=error;if(error){$('#form-error').scrollIntoView({block:'nearest',behavior:'smooth'});return}
 const oldKey=validLocation(settings.origin)&&validLocation(settings.destination)?routeKey(settings):'';settings={...draft,theme:settings.theme};selectedDate=draftDate;savePrefs();$('#settings-dialog').close();
 if(oldKey!==routeKey(settings)){bundle=null;const cached=read(CACHE);if(usableCache(cached))bundle=cached;refresh()}else{render();if(!bundle||isStale(bundle.fetchedAt))refresh()}
 toast('Tu viaje quedó guardado en este navegador.');
});
$('#travel-date').addEventListener('change',()=>{const d=$('#travel-date').value;if(!validDate(d)){dateControls();toast('Elegí una fecha disponible en el pronóstico.');return}selectedDate=d;render();if(!bundle||isStale(bundle.fetchedAt))refresh()});
$('#theme-toggle').addEventListener('click',()=>{settings.theme=settings.theme==='auto'?'dark':settings.theme==='dark'?'light':'auto';applyTheme();savePrefs()});
$$('[data-theme-choice]').forEach(b=>b.addEventListener('click',()=>{settings.theme=b.dataset.themeChoice;applyTheme();savePrefs()}));
$('#refresh').addEventListener('click',()=>refresh());
$('#details-open').addEventListener('click',()=>{renderDetails();$('#details-dialog').showModal()});
$$('[data-detail-tab]').forEach(b=>b.addEventListener('click',()=>{detailsTab=b.dataset.detailTab;renderDetails()}));
function renderDetails(){
 $('#details-date').textContent=dateLabel(selectedDate,{weekday:'long',day:'numeric',month:'long'});$$('[data-detail-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.detailTab===detailsTab)));
 const t=trips[detailsTab==='out'?0:1];
 $('#detail-content').innerHTML=t?.points?t.points.map(p=>`<section class="detail-location"><h3>${esc(locationLabel(p.location))}</h3>${p.slots?.length?`<p>Probabilidad máx. ${fmt(p.prob)}% · acumulado ${fmt(p.rain,1)} mm en las horas cubiertas · sensación ${range(p.feelMin,p.feelMax)} C</p><table class="hour-table"><thead><tr><th scope="col">Intervalo</th><th scope="col">Lluvia</th><th scope="col">Viento</th><th scope="col">Temp.</th></tr></thead><tbody>${p.slots.map(h=>`<tr><td>${h.start}–${h.end}</td><td>${fmt(h.prob)}%<small>${fmt(h.rain,1)} mm</small></td><td>${fmt(h.wind)} km/h<small>Ráf. ${fmt(h.gust)} km/h</small></td><td>${range(h.tempMin,h.tempMax)} C</td></tr>`).join('')}</tbody></table>`:'<p>Sin datos completos para esta zona y horario.</p>'}</section>`).join(''):'<p class="sheet-busy">Consultá el pronóstico para ver el detalle por zona.</p>';
 const p=PROFILES[settings.vehicle];
 const moto=settings.vehicle==='moto';
 const rainCriteria=moto?`<li><strong>Equipate para lluvia:</strong> lluvia desde 30% o 0,1 mm/h, llovizna o posible piso mojado por lluvia previa. Se recomiendan botas y equipo de lluvia. Desde ${fmt(p.rainStop,1)} mm/h se destaca la intensidad, manteniendo esta recomendación de equipo.</li>`:'';
 const rainStop=moto?'':`lluvia desde ${fmt(p.rainStop,1)} mm/h${p.probStop!==null?' o probabilidad desde '+p.probStop+'%':''}; `;
 $('#criteria-content').innerHTML=`<p>Perfil: <strong>${vehicleNames[settings.vehicle]}</strong>. Se usa el peor valor de origen y destino durante el tramo, y el peor tramo para la decisión general.</p><ul>${rainCriteria}<li><strong>Precaución:</strong> ${moto?'':'lluvia desde 30% o 0,1 mm/h, llovizna, '}viento desde ${p.windWarn} km/h o ráfagas desde ${p.gustWarn} km/h; temperatura ≤${p.coldWarn} o ≥${p.hotWarn} °C. También niebla${moto?'':' o 0,5 mm de lluvia en las dos horas previas'}.</li><li><strong>Otro transporte:</strong> ${rainStop}viento desde ${p.windStop} km/h o ráfagas desde ${p.gustStop} km/h; temperatura ≤${p.coldStop} o ≥${p.hotStop} °C. Tormentas, hielo y nieve también activan esta recomendación.</li><li><strong>Sin decisión:</strong> datos incompletos, consulta de más de una hora o un horario que ya pasó.</li></ul><p>La temperatura real define el criterio; la sensación térmica se muestra como referencia. Las lluvias y ráfagas se asignan a la hora anterior a cada registro del proveedor.</p>`;
}
function usableCache(c){return c&&!validateSettings(settings)&&c.key===routeKey(settings)&&Number.isFinite(c.fetchedAt)&&c.fetchedAt<=Date.now()&&Array.isArray(c.points)&&c.points.length===2&&c.points.every(validPayload)}
const cache=read(CACHE);if(usableCache(cache))bundle=cache;render();
if(validateSettings(settings))openSettings('origin-search');else refresh({silent:true});
setInterval(()=>{if(!busy){dateControls();render()}},60000);
setInterval(()=>{if(!document.hidden&&!validateSettings(settings))refresh({silent:true})},15*60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!validateSettings(settings)&&(!bundle||Date.now()-bundle.fetchedAt>15*60000))refresh({silent:true})});
