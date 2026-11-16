export type Granularity='day'|'week'|'month';
export type Point={date:string;value:number};

/** Accept YYYYMMDD or YYYY-MM-DD → YYYY-MM-DD. */
export function normalizeChartDate(raw:string):string{
 if(/^\d{8}$/.test(raw))return `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;
 if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;
 if(/^\d{6}$/.test(raw))return `${raw.slice(0,4)}-${raw.slice(4,6)}-01`;
 throw Error('invalid_date');
}

/** Bucket key stored as compact YYYYMMDD (day/week) or YYYYMM (month). */
export function bucketKey(raw:string,granularity:Granularity):string{
 const iso=normalizeChartDate(raw);
 const [y,m,d]=iso.split('-').map(Number);
 if(granularity==='month')return `${y}${String(m).padStart(2,'0')}`;
 if(granularity==='day')return `${y}${String(m).padStart(2,'0')}${String(d).padStart(2,'0')}`;
 const dt=new Date(Date.UTC(y,m-1,d));
 const dow=(dt.getUTCDay()+6)%7;// Monday=0
 dt.setUTCDate(dt.getUTCDate()-dow);
 return dt.toISOString().slice(0,10).replaceAll('-','');
}

export function aggregatePoints(points:Point[],granularity:Granularity,mode:'sum'|'avg'='sum'):Point[]{
 const map=new Map<string,{sum:number;n:number}>();
 for(const p of points){
  if(!Number.isFinite(p.value))continue;
  const key=bucketKey(p.date,granularity);
  const cur=map.get(key)||{sum:0,n:0};
  cur.sum+=p.value;cur.n+=1;
  map.set(key,cur);
 }
 return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,v])=>({
  date,
  value:mode==='avg'?(v.n?v.sum/v.n:0):v.sum,
 }));
}

export function formatBucketLabel(key:string):string{
 if(/^\d{6}$/.test(key))return `${key.slice(0,4)}.${key.slice(4,6)}`;
 if(/^\d{8}$/.test(key))return `${key.slice(4,6)}/${key.slice(6,8)}`;
 return key;
}
