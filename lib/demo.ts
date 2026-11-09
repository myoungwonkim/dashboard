export const apps=[{id:'bazi',firebaseProjectId:'bazi-ea78b',ga4PropertyId:'550050295',name:'읽어주는 만세력',pkg:'com.nolsoopgames.bazi',symbol:'命'},{id:'sudoku',firebaseProjectId:'sudoku-master-8998c',ga4PropertyId:'558243778',name:'스도쿠 마스터',pkg:'com.nolsoopgames.sudoku',symbol:'9'}];
// Demonstration fixtures only; never a fallback for live data.
export const demo=Array.from({length:30},(_,day)=>apps.flatMap((app,ai)=>['KR','JP','US'].map((country,ci)=>{
const date=new Date(Date.UTC(2026,9,8+day)).toISOString().slice(0,10);
const installs=Math.round((ai===0?65:31)*(1+day/60)*[1,.27,.14][ci]+(day*7%13));
const impressions=installs*(ai===0?31:27),revenue=Math.round(impressions*(ai===0?3.2:2.95)/10)/100;
return {date,app:app.id,country,installs,organic:Math.round(installs*.3),impressions,revenue,active:installs*4+day%9,sessions:installs*9,events:installs*14};
}))).flat();
export function aggregate(days:number,country:string,os:string,app?:string){
const cutoff=new Date(Date.UTC(2026,10,6)-(days-1)*86400000).toISOString().slice(0,10);
const rows=demo.filter(r=>r.date>=cutoff&&(!app||r.app===app)&&(country==='all'||country===r.country)&&(os==='all'||os==='android'));
const sum=(key:'installs'|'organic'|'impressions'|'revenue'|'sessions'|'events')=>rows.reduce((a,r)=>a+r[key],0);
const dates=Array.from(new Set(rows.map(r=>r.date))).sort();
const daily=dates.map(date=>({date,revenue:rows.filter(r=>r.date===date).reduce((s,r)=>s+r.revenue,0),active:rows.filter(r=>r.date===date).reduce((s,r)=>s+r.active,0)}));
return {rows,daily,installs:sum('installs'),organic:sum('organic'),impressions:sum('impressions'),revenue:sum('revenue'),sessions:sum('sessions'),events:sum('events'),averageDau:daily.length?Math.round(daily.reduce((s,r)=>s+r.active,0)/daily.length):0,ecpm:sum('impressions')?sum('revenue')/sum('impressions')*1000:0};
}
