export const TZ='America/Argentina/Buenos_Aires';
export const FIELDS=['temperature_2m','apparent_temperature','precipitation_probability','precipitation','wind_speed_10m','wind_gusts_10m','weather_code','is_day'];
export const PROFILES={
  moto:{name:'moto',rainStop:3,probStop:null,windWarn:25,windStop:40,gustWarn:40,gustStop:55,coldWarn:10,coldStop:3,hotWarn:34,hotStop:40},
  bici:{name:'bicicleta',rainStop:2,probStop:null,windWarn:20,windStop:35,gustWarn:35,gustStop:50,coldWarn:8,coldStop:3,hotWarn:32,hotStop:38},
  mono:{name:'monopatín',rainStop:.5,probStop:60,windWarn:20,windStop:30,gustWarn:35,gustStop:45,coldWarn:10,coldStop:3,hotWarn:32,hotStop:38}
};
export const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function localDate(now=new Date()){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
 return `${p.year}-${p.month}-${p.day}`;
}
export const addDays=(d,n)=>new Date(Date.parse(d+'T12:00:00-03:00')+n*86400000).toISOString().slice(0,10);
export const dateLabel=(d,opts={weekday:'short',day:'numeric',month:'short'})=>new Intl.DateTimeFormat('es-AR',{timeZone:TZ,...opts}).format(new Date(d+'T12:00:00-03:00'));
export const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3,5));
export const hourLabel=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
export const validLocation=l=>l&&typeof l.name==='string'&&l.name.trim().length>0&&finite(l.latitude)&&finite(l.longitude)&&l.latitude>=-90&&l.latitude<=90&&l.longitude>=-180&&l.longitude<=180;
export function validateSettings(s){
 if(!validLocation(s.origin)||!validLocation(s.destination))return 'Elegí origen y destino de la lista de sugerencias.';
 if(!PROFILES[s.vehicle])return 'Elegí un vehículo.';
 if(![s.outStart,s.outEnd,s.backStart,s.backEnd].every(t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t||'')))return 'Completá los cuatro horarios.';
 if(minutes(s.outEnd)<=minutes(s.outStart))return 'La llegada de ida debe ser posterior a la salida.';
 if(minutes(s.backEnd)<=minutes(s.backStart))return 'La llegada de vuelta debe ser posterior a la salida, en el mismo día.';
 if(minutes(s.backStart)<minutes(s.outEnd))return 'La vuelta debe empezar después de terminar la ida.';
 return '';
}
export function validDate(d,now=new Date()){return /^\d{4}-\d{2}-\d{2}$/.test(d||'')&&d>=localDate(now)&&d<=addDays(localDate(now),6)}
export function forecastURL(loc){return 'https://api.open-meteo.com/v1/forecast?'+new URLSearchParams({latitude:String(loc.latitude),longitude:String(loc.longitude),hourly:FIELDS.join(','),timezone:TZ,forecast_days:'8',wind_speed_unit:'kmh',temperature_unit:'celsius',precipitation_unit:'mm'})}
export function validPayload(d){return d?.hourly&&Array.isArray(d.hourly.time)&&d.hourly.time.length>24&&FIELDS.every(k=>Array.isArray(d.hourly[k])&&d.hourly[k].length===d.hourly.time.length)}
export const routeKey=s=>[s.origin.latitude,s.origin.longitude,s.destination.latitude,s.destination.longitude].join('|');
export const isStale=(fetchedAt,now=Date.now())=>!finite(fetchedAt)||fetchedAt>now||now-fetchedAt>3600000;
export function slotsFor(data,date,start,end){
 if(!validPayload(data))return null;
 const h=data.hourly, slots=[];
 for(let m=Math.floor(minutes(start)/60)*60;m<minutes(end);m+=60){
  const i=h.time.indexOf(date+'T'+hourLabel(m)),next=h.time.indexOf(m===1380?addDays(date,1)+'T00:00':date+'T'+hourLabel(m+60));
  if(i<0||next<0||!FIELDS.every(k=>finite(h[k][i])&&finite(h[k][next])))return null;
  slots.push({start:hourLabel(m),end:hourLabel(m+60),tempMin:Math.min(h.temperature_2m[i],h.temperature_2m[next]),tempMax:Math.max(h.temperature_2m[i],h.temperature_2m[next]),feelMin:Math.min(h.apparent_temperature[i],h.apparent_temperature[next]),feelMax:Math.max(h.apparent_temperature[i],h.apparent_temperature[next]),prob:h.precipitation_probability[next],rain:h.precipitation[next],wind:Math.max(h.wind_speed_10m[i],h.wind_speed_10m[next]),gust:h.wind_gusts_10m[next],codes:[h.weather_code[i],h.weather_code[next]],day:Boolean(h.is_day[i]||h.is_day[next])});
 }
 return slots;
}
export function assessValues(m,vehicle='mono'){
 const p=PROFILES[vehicle]||PROFILES.mono,factors=[];
 const put=(severity,kind,text)=>factors.push({severity,kind,text});
 if(m.codes.some(c=>c>=95))put(2,'Tormenta','Tormentas previstas');
 if(m.codes.some(c=>[56,57,66,67,71,73,75,77,85,86].includes(c)))put(2,'Hielo o nieve','Riesgo de hielo o nieve');
 const wetCode=m.codes.some(c=>(c>=51&&c<=67)||(c>=80&&c<=82));
 if(m.rainMax>=p.rainStop||(p.probStop!==null&&m.prob>=p.probStop))put(2,'Lluvia',m.rainMax>=p.rainStop?`Lluvia de hasta ${m.rainMax.toLocaleString('es-AR',{maximumFractionDigits:1})} mm/h`:`Lluvia probable (${Math.round(m.prob)}%)`);
 else if(m.prob>=30||m.rainMax>=.1||wetCode)put(1,'Lluvia',`Posible lluvia (${Math.round(m.prob)}%)`);
 if(m.wind>=p.windStop||m.gust>=p.gustStop)put(2,'Viento',`Viento ${Math.round(m.wind)} km/h · ráfagas ${Math.round(m.gust)} km/h`);
 else if(m.wind>=p.windWarn||m.gust>=p.gustWarn)put(1,'Viento',`Ráfagas de hasta ${Math.round(m.gust)} km/h`);
 if(m.tempMin<=p.coldStop||m.tempMax>=p.hotStop)put(2,'Temperatura',m.tempMin<=p.coldStop?'Frío intenso':'Calor intenso');
 else if(m.tempMin<=p.coldWarn||m.tempMax>=p.hotWarn)put(1,'Temperatura',m.tempMin<=p.coldWarn?'Llevá abrigo y guantes':'Temperatura elevada');
 if(m.codes.some(c=>[45,48].includes(c)))put(1,'Niebla','Visibilidad reducida por niebla');
 if(m.recentRain>=.5)put(1,'Piso húmedo','Lluvia previa: posible piso mojado');
 factors.sort((a,b)=>b.severity-a.severity);
 return {severity:factors[0]?.severity??0,factors};
}
export function assessPoint(data,loc,date,start,end,vehicle,now=new Date()){
 const slots=slotsFor(data,date,start,end);
 if(!slots?.length)return {severity:null,slots:[],location:loc,reason:'Faltan datos para esta zona'};
 const max=k=>Math.max(...slots.map(h=>h[k])),min=k=>Math.min(...slots.map(h=>h[k]));
 let recentRain=0;
 for(let m=Math.floor(minutes(start)/60)*60-120;m<Math.floor(minutes(start)/60)*60;m+=60){
  const d=m<0?addDays(date,-1):date,mm=(m+1440)%1440,stamp=mm===1380?addDays(d,1)+'T00:00':d+'T'+hourLabel(mm+60),i=data.hourly.time.indexOf(stamp);
  if(i>=0&&finite(data.hourly.precipitation[i]))recentRain+=data.hourly.precipitation[i];
 }
 const metrics={tempMin:min('tempMin'),tempMax:max('tempMax'),feelMin:min('feelMin'),feelMax:max('feelMax'),prob:max('prob'),rain:slots.reduce((s,h)=>s+h.rain,0),rainMax:max('rain'),wind:max('wind'),gust:max('gust'),recentRain,codes:slots.flatMap(h=>h.codes),day:slots.some(h=>h.day)};
 const assessment=assessValues(metrics,vehicle),past=Date.parse(date+'T'+end+':00-03:00')<=now.getTime();
 return {...metrics,...assessment,slots,location:loc,past,severity:past?null:assessment.severity};
}
export function assessJourney(bundle,settings,date,start,end,returning=false,now=new Date()){
 const order=returning?[1,0]:[0,1],locs=[settings.origin,settings.destination];
 const points=order.map(i=>assessPoint(bundle.points[i],locs[i],date,start,end,settings.vehicle,now));
 if(points.some(p=>p.severity===null))return {severity:null,points,past:points.some(p=>p.past),reason:points.some(p=>p.past)?'Este horario ya pasó':'Pronóstico incompleto en una zona'};
 const severity=Math.max(...points.map(p=>p.severity));
 const priority={'Tormenta':0,'Hielo o nieve':1,'Lluvia':2,'Viento':3,'Temperatura':4,'Niebla':5,'Piso húmedo':6};
 const factors=points.flatMap(point=>point.factors.map(f=>({...f,location:point.location,prob:point.prob,gust:point.gust,rainMax:point.rainMax}))).sort((a,b)=>b.severity-a.severity||(priority[a.kind]-priority[b.kind])||(a.kind==='Lluvia'?b.prob-a.prob||b.rainMax-a.rainMax:a.kind==='Viento'?b.gust-a.gust:0));
 const max=k=>Math.max(...points.map(p=>p[k])),min=k=>Math.min(...points.map(p=>p[k]));
 return {severity,points,factors,reason:factors.length?`${factors[0].text} · ${factors[0].location.name}`:'Condiciones favorables en ambas zonas',prob:max('prob'),rain:max('rain'),rainMax:max('rainMax'),wind:max('wind'),gust:max('gust'),tempMin:min('tempMin'),tempMax:max('tempMax'),feelMin:min('feelMin'),feelMax:max('feelMax'),codes:points.flatMap(p=>p.codes),day:points.some(p=>p.day)};
}
const wetFactor=f=>['Lluvia','Piso húmedo'].includes(f.kind);
const severeOtherFactor=f=>f.severity===2&&!wetFactor(f);
export function tripAdvice(trip,vehicle){
 const factors=trip?.factors||[],severity=trip?.severity??null;
 const rainGear=vehicle==='moto'&&severity!==null&&factors.some(wetFactor)&&!factors.some(severeOtherFactor);
 return {rainGear,label:rainGear?'Equipate':severity===null?'Sin datos':['Favorable','Precaución','Otro transporte'][severity]};
}
export function decide(trips,vehicle,stale=false){
 if(stale)return {severity:null,title:'Actualizá antes de salir',reason:'La consulta tiene más de una hora.'};
 if(trips.some(t=>t.severity===null))return {severity:null,title:trips.some(t=>t.past)?'Elegí un horario futuro':'Faltan datos para decidir',reason:trips.find(t=>t.severity===null).reason};
 const severity=Math.max(...trips.map(t=>t.severity));
 const blocking=vehicle==='moto'?trips.findIndex(t=>(t.factors||[]).some(severeOtherFactor)):-1;
 const i=blocking>=0?blocking:trips[0].severity>=trips[1].severity?0:1;
 const critical=blocking>=0?trips[i].factors.find(severeOtherFactor):null;
 const reason=critical?`${critical.text}${critical.location?' · '+critical.location.name:''}`:trips[i].reason;
 const rainGear=vehicle==='moto'&&blocking<0&&trips.some(t=>tripAdvice(t,vehicle).rainGear);
 return {severity,title:rainGear?'Equipate para lluvia':severity===2?'Conviene otro transporte':severity===1?'Salí con precaución':`Buen día para ir en ${PROFILES[vehicle].name}`,reason:severity?`${i===0?'Ida':'Vuelta'}: ${reason}`:'La ida y la vuelta tienen condiciones favorables.'};
}
const conditions=[{test:c=>c>=95,key:'storm',label:'Tormentas'},{test:c=>[56,57,66,67].includes(c),key:'sleet',label:'Lluvia helada'},{test:c=>[71,73,75,77,85,86].includes(c),key:'snow',label:'Nieve'},{test:c=>[61,63,65,80,81,82].includes(c),key:'rain',label:'Lluvia'},{test:c=>[51,53,55].includes(c),key:'drizzle',label:'Llovizna'},{test:c=>[45,48].includes(c),key:'fog',label:'Niebla'},{test:c=>c===3,key:'cloud',label:'Nublado'},{test:c=>c===2,key:'partly',label:'Parcialmente nublado'},{test:c=>[0,1].includes(c),key:'sun',label:'Despejado'}];
export function sky(codes=[],day=true){const c=conditions.find(c=>codes.some(c.test));return c?{...c,key:!day&&c.key==='sun'?'moon':!day&&c.key==='partly'?'cloudmoon':c.key}:{key:'unknown',label:'Sin datos'}}
export function equipment(trips,vehicle,stale=false){
 if(stale||!trips.length||trips.some(t=>t.severity===null))return 'Revisá el pronóstico antes de salir.';
 const wet=trips.map(t=>(t.factors||[]).some(wetFactor));
 if(vehicle==='moto'&&wet.some(Boolean)&&!trips.some(t=>(t.factors||[]).some(severeOtherFactor)))return `Llevá botas y equipo de lluvia${wet.every(Boolean)?' para ambos tramos':wet[0]?' para la ida':' para la vuelta'}.`;
 if(Math.max(...trips.map(t=>t.severity))===2)return 'La condición más desfavorable define la decisión del día.';
 if(vehicle==='bici'&&wet.some(Boolean))return 'Prepará ropa impermeable y luces para el viaje.';
 if(vehicle==='mono'&&wet.some(Boolean))return 'Revisá el piso y las indicaciones de tu monopatín para el agua.';
 return 'Casco, luces y equipo listo. Volvé a consultar antes de salir.';
}
