import {normalizeChartDate,type Point} from './chart-aggregate.mts';

/** Sum point values across series by calendar day (YYYY-MM-DD). */
export function sumPointsByDate(seriesList:Point[][]):Point[]{
 const map=new Map<string,number>();
 for(const points of seriesList){
  for(const p of points){
   if(!Number.isFinite(p.value))continue;
   let key:string;
   try{key=normalizeChartDate(p.date);}catch{continue;}
   map.set(key,(map.get(key)||0)+p.value);
  }
 }
 return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,value])=>({date,value}));
}

/** Daily eCPI from aligned spend / newUsers (or installs) maps. */
export function dailyEcpi(spend:Point[],acquisitions:Point[]):Point[]{
 const acq=new Map(acquisitions.map(p=>{
  try{return [normalizeChartDate(p.date),p.value] as const;}catch{return null;}
 }).filter(Boolean) as [string,number][]);
 const out:Point[]=[];
 for(const p of spend){
  let date:string;
  try{date=normalizeChartDate(p.date);}catch{continue;}
  const n=acq.get(date)||0;
  if(!(n>0)||!Number.isFinite(p.value))continue;
  out.push({date,value:p.value/n});
 }
 return out;
}
