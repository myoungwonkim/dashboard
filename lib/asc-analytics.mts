import {AscError} from './asc-core.mts';

export type AscAnalyticsDay={
 date:string;
 downloads?:number;
 firstTimeDownloads?:number;
 redownloads?:number;
 installations?:number;
 deletions?:number;
 sessions?:number;
 activeDevices?:number;
 crashes?:number;
 impressions?:number;
 pageViews?:number;
};

async function gunzipText(buf:ArrayBuffer){
 const stream=new Response(buf).body?.pipeThrough(new DecompressionStream('gzip'));
 if(!stream)throw new AscError('invalid_response');
 return await new Response(stream).text();
}

export async function ensureAnalyticsRequest(appleAppId:string,token:string,existingRequestId:string|null,fetcher:typeof fetch=fetch){
 if(existingRequestId)return {requestId:existingRequestId,created:false};
 const res=await fetcher('https://api.appstoreconnect.apple.com/v1/analyticsReportRequests',{
  method:'POST',
  headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
  body:JSON.stringify({data:{type:'analyticsReportRequests',attributes:{accessType:'ONGOING'},relationships:{app:{data:{type:'apps',id:appleAppId}}}}}),
  signal:AbortSignal.timeout(20000),
 });
 if(!res.ok){
  // Already exists / conflict — try list
  if(res.status===409||res.status===400){
   const listed=await listAnalyticsRequests(appleAppId,token,fetcher);
   if(listed[0])return {requestId:listed[0],created:false};
  }
  throw new AscError(res.status===401?'authentication_failed':res.status===403?'permission_denied':'provider_error',res.status===429?429:502);
 }
 const body=await res.json() as {data?:{id?:string}};
 if(!body.data?.id)throw new AscError('invalid_response');
 return {requestId:body.data.id,created:true};
}

export async function listAnalyticsRequests(appleAppId:string,token:string,fetcher:typeof fetch=fetch){
 const res=await fetcher(`https://api.appstoreconnect.apple.com/v1/apps/${appleAppId}/analyticsReportRequests`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});
 if(!res.ok)return [] as string[];
 const body=await res.json() as {data?:{id?:string}[]};
 return (body.data||[]).map(d=>d.id!).filter(Boolean);
}

export async function listReports(requestId:string,token:string,fetcher:typeof fetch=fetch){
 const res=await fetcher(`https://api.appstoreconnect.apple.com/v1/analyticsReportRequests/${requestId}/reports`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000)});
 if(!res.ok)return [] as {id:string;name:string;category:string}[];
 const body=await res.json() as {data?:{id?:string;attributes?:{name?:string;category?:string}}[]};
 return (body.data||[]).map(r=>({id:String(r.id),name:String(r.attributes?.name||''),category:String(r.attributes?.category||'')})).filter(r=>r.id);
}

export async function listReportInstances(reportId:string,token:string,fetcher:typeof fetch=fetch){
 const res=await fetcher(`https://api.appstoreconnect.apple.com/v1/analyticsReports/${reportId}/instances?limit=5`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000)});
 if(!res.ok)return [] as {id:string;processingDate:string}[];
 const body=await res.json() as {data?:{id?:string;attributes?:{processingDate?:string}}[]};
 return (body.data||[]).map(r=>({id:String(r.id),processingDate:String(r.attributes?.processingDate||'')})).filter(r=>r.id);
}

export async function listSegments(instanceId:string,token:string,fetcher:typeof fetch=fetch){
 const res=await fetcher(`https://api.appstoreconnect.apple.com/v1/analyticsReportInstances/${instanceId}/segments?limit=20`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000)});
 if(!res.ok)return [] as {id:string;url:string}[];
 const body=await res.json() as {data?:{id?:string;attributes?:{url?:string}}[]};
 return (body.data||[]).map(r=>({id:String(r.id),url:String(r.attributes?.url||'')})).filter(r=>r.id&&r.url);
}

/** Parse ASC Analytics TSV segment into daily totals. Column names vary by report. */
export function parseAnalyticsSegment(text:string):AscAnalyticsDay[]{
 const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
 if(lines.length<2)return [];
 const sep=lines[0].includes('\t')?'\t':',';
 const header=lines[0].split(sep).map(h=>h.trim().toLowerCase());
 const dateIdx=header.findIndex(h=>h==='date'||h==='begin date');
 if(dateIdx<0)return [];
 const idx=(...names:string[])=>header.findIndex(h=>names.includes(h));
 const map:Record<string,number>={
  downloads:idx('total downloads','downloads'),
  firstTimeDownloads:idx('first-time downloads','first time downloads'),
  redownloads:idx('redownloads'),
  installations:idx('installations','total installations'),
  deletions:idx('deletions'),
  sessions:idx('sessions'),
  activeDevices:idx('active devices'),
  crashes:idx('crashes','total crashes'),
  impressions:idx('impressions','unique device impressions','page views unique'),
  pageViews:idx('product page views','page views'),
 };
 const byDate=new Map<string,AscAnalyticsDay>();
 for(const line of lines.slice(1)){
  if(!line.trim())continue;
  const cols=line.split(sep);
  const raw=cols[dateIdx];if(!raw)continue;
  const date=raw.replaceAll('/','').replaceAll('-','').slice(0,8);
  if(!/^\d{8}$/.test(date))continue;
  const row=byDate.get(date)||{date};
  for(const [field,i] of Object.entries(map)){
   if(i<0)continue;
   const n=Number(cols[i]||0);
   if(!Number.isFinite(n))continue;
   (row as Record<string,unknown>)[field]=(((row as unknown as Record<string,number>)[field])||0)+n;
  }
  byDate.set(date,row);
 }
 return [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
}

export async function fetchAnalyticsForApp(appleAppId:string,token:string,existingRequestId:string|null,fetcher:typeof fetch=fetch){
 const {requestId,created}=await ensureAnalyticsRequest(appleAppId,token,existingRequestId,fetcher);
 const reports=await listReports(requestId,token,fetcher);
 const wanted=/download|install|usage|crash|impression|page view|conversion/i;
 const days=new Map<string,AscAnalyticsDay>();
 let segmentsRead=0;
 for(const report of reports.filter(r=>wanted.test(r.name)||wanted.test(r.category)).slice(0,8)){
  const instances=await listReportInstances(report.id,token,fetcher);
  const instance=instances[0];if(!instance)continue;
  const segments=await listSegments(instance.id,token,fetcher);
  for(const seg of segments.slice(0,3)){
   try{
    const res=await fetcher(seg.url,{signal:AbortSignal.timeout(45000)});
    if(!res.ok)continue;
    const buf=await res.arrayBuffer();
    let text:string;
    try{text=await gunzipText(buf);}catch{text=new TextDecoder().decode(buf);}
    for(const row of parseAnalyticsSegment(text)){
     const cur=days.get(row.date)||{date:row.date};
     for(const [k,v] of Object.entries(row)){
      if(k==='date'||v==null)continue;
      (cur as Record<string,unknown>)[k]=(((cur as unknown as Record<string,number>)[k])||0)+Number(v);
     }
     days.set(row.date,cur);
    }
    segmentsRead++;
   }catch{/* skip segment */}
  }
 }
 return {requestId,created,segmentsRead,daily:[...days.values()].sort((a,b)=>a.date.localeCompare(b.date)),reportCount:reports.length};
}
