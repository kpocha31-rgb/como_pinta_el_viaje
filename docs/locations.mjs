import {BARRIOS} from './assets/barrios.mjs';
export {BARRIOS};
export const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export const locationLabel=l=>`${l.name}${l.region?' · '+l.region:''}`;
export function localMatches(query){
 let q=normalize(query);
 if(['caba','capital federal','ciudad de buenos aires','barrios'].includes(q))q='';
 if(q==='once')q='balvanera';if(q==='microcentro')q='san nicolas';
 return BARRIOS.filter(l=>!q||normalize(l.name).includes(q));
}
export function normalizeResult(l){
 if(!l||l.country_code!=='AR'||!Number.isFinite(l.latitude)||!Number.isFinite(l.longitude)||typeof l.name!=='string')return null;
 const region=l.admin1||'Argentina';
 return {id:'geo-'+l.id,name:l.name,region:region==='Buenos Aires F.D.'?'CABA':region,description:l.admin2||'Localidad de Argentina',latitude:l.latitude,longitude:l.longitude};
}
export async function searchLocations(query,{signal}={}){
 const local=localMatches(query),q=query.trim();
 if(q.length<3||['caba','capital federal','ciudad de buenos aires','barrios'].includes(normalize(q)))return {results:local,error:false};
 try{
  const response=await fetch('https://geocoding-api.open-meteo.com/v1/search?'+new URLSearchParams({name:q,count:'40',language:'es',countryCode:'AR'}),{signal});
  if(!response.ok)throw new Error('geocoding');const data=await response.json();
  if(data.results!==undefined&&!Array.isArray(data.results))throw new Error('invalid');
  const remote=(data.results||[]).map(normalizeResult).filter(Boolean);
  const unique=[...local];for(const l of remote){if(!unique.some(x=>normalize(x.name)===normalize(l.name)&&Math.abs(x.latitude-l.latitude)<.08&&Math.abs(x.longitude-l.longitude)<.08))unique.push(l)}
  return {results:unique,error:false};
 }catch(e){if(e.name==='AbortError')throw e;return {results:local,error:true}}
}
