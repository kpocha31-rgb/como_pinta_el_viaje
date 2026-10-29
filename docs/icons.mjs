import {ICONS} from './assets/icons-data.mjs';
export function icon(name,cls=''){return `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon ${cls}" focusable="false">${ICONS[name]||ICONS['map-pin']}</svg>`}
const cloud='<path d="M7 17h10a4.5 4.5 0 0 0 .8-8.9A6 6 0 0 0 6.6 6a5.5 5.5 0 0 0 .4 11Z"/>';
const sun='<g class="sun"><circle cx="12" cy="12" r="4"/><g class="sun-rays"><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.5 1.5m11.2 11.2 1.5 1.5m-14.2 0 1.5-1.5M17.6 6.4l1.5-1.5"/></g></g>';
const moon='<path class="moon" d="M20.6 14.2A8.5 8.5 0 0 1 9.8 3.4 8.5 8.5 0 1 0 20.6 14.2Z"/>';
export function weatherIcon(type='unknown'){
 let drawing='';
 if(type==='sun')drawing=sun;
 else if(type==='moon')drawing=moon;
 else if(type==='partly'||type==='cloudmoon')drawing=`<g transform="translate(8 -1) scale(.65)">${type==='partly'?sun:moon}</g><g class="cloud" transform="translate(-1 5) scale(.9)">${cloud}</g>`;
 else if(type==='showers')drawing=`<g transform="translate(7 -1) scale(.62)">${sun}</g><g class="cloud" transform="translate(-1 1) scale(.9)">${cloud}</g><g class="rain"><path d="m8 18-1 4m6-4-1 4m6-4-1 4"/></g>`;
 else if(type==='rain'||type==='drizzle'||type==='sleet')drawing=`<g class="cloud" transform="translate(0 -2)">${cloud}</g><g class="rain"><path d="m8 17-1 4m6-4-1 4m6-4-1 4"/></g>`;
 else if(type==='storm')drawing=`<g class="cloud" transform="translate(0 -3)">${cloud}</g><path class="lightning" d="m13 13-4 6h4l-1 4 5-7h-4l1-3Z" fill="currentColor" stroke-width=".7"/><path class="rain" d="m5 16-1 4m16-4-1 4"/>`;
 else if(type==='snow')drawing=`<g class="cloud" transform="translate(0 -3)">${cloud}</g><g class="snow"><path d="M7 18v4m-2-2h4m7-2v4m-2-2h4m-6-1v4m-2-2h4"/></g>`;
 else if(type==='fog')drawing=`<g class="cloud" transform="translate(0 -4)">${cloud}</g><g class="fog"><path d="M3 16h18M5 19h14M3 22h18"/></g>`;
 else drawing=`<g class="cloud">${cloud}</g>${type==='unknown'?'<path class="cloud" d="M11 9a1.8 1.8 0 1 1 2 2c-1 0-1 1-1 1m0 2v.1"/>':''}`;
 return `<svg class="wx" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${drawing}</svg>`;
}
