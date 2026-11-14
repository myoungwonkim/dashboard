import {useEffect,useMemo,useState} from 'react';
import type {AppRecord} from '@/lib/apps';
import {appColor} from '@/lib/app-colors';
import TrendChart from './trend-chart';

type Day={date:string;spend:number};
type Data={spend:number;bySource:Record<string,number>;daily:Day[];roas:number|null;fetchedAt:string};
type Result={status:'success';data:Data}|{status:'error';message:string};
function fmtSpend(v:number|null|undefined){return v==null||!Number.isFinite(v)?'—':'$'+v.toFixed(2);}
function roas(revenue:number|null|undefined,spend:number|null|undefined){if(revenue==null||spend==null||!(spend>0))return null;return revenue/spend;}

function AppMark({id,name}:{id:string;name:string}){
 return <span className="apptitle"><span className="appdot" style={{background:appColor(id)}} aria-hidden/>{name}</span>;
}

export default function MarketingLive({apps,app,days,startDate,endDate,revenueByApp}:{apps:AppRecord[];app?:string;days:number;startDate:string;endDate:string;revenueByApp?:Record<string,number|undefined>}){
 const [results,setResults]=useState<Record<string,Result>>({});
 const [loading,setLoading]=useState(true);
 const targets=apps.filter(a=>!app||a.id===app);
 useEffect(()=>{
  const controller=new AbortController();let active=true;setLoading(true);setResults({});
  if(!targets.length){setLoading(false);return ()=>{active=false;controller.abort();};}
  Promise.all(targets.map(async a=>{
   let result:Result;
   try{
    const res=await fetch('/api/marketing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days,startDate,endDate,revenue:revenueByApp?.[a.id]}),signal:controller.signal});
    const body=await res.json() as Result;
    result=res.ok&&body.status==='success'?body:{status:'error',message:body.status==='error'?body.message:'조회 실패'};
   }catch{result={status:'error',message:'서버에 연결할 수 없습니다.'};}
   if(active)setResults(prev=>({...prev,[a.id]:result}));
  })).finally(()=>{if(active)setLoading(false);});
  return ()=>{active=false;controller.abort();};
 },[app,days,startDate,endDate,targets.map(t=>t.id).join(','),JSON.stringify(revenueByApp||{})]);

 const totals=useMemo(()=>{
  const ok=targets.map(a=>results[a.id]).filter((r):r is Extract<Result,{status:'success'}>=>r?.status==='success');
  if(ok.length<1)return null;
  const spend=ok.reduce((s,r)=>s+r.data.spend,0);
  const rev=targets.reduce((s,a)=>s+(revenueByApp?.[a.id]||0),0);
  const bySource:Record<string,number>={};
  for(const r of ok)for(const [k,v] of Object.entries(r.data.bySource||{}))bySource[k]=(bySource[k]||0)+v;
  return {spend,roas:roas(rev||null,spend),bySource,n:ok.length};
 },[targets,results,revenueByApp]);

 const chartSeries=targets.flatMap(a=>{
  const r=results[a.id];if(!r||r.status!=='success'||!r.data.daily.length)return [];
  return [{name:a.name+' 비용',color:appColor(a.id),points:r.data.daily.map(d=>({date:d.date,value:d.spend}))}];
 });

 return <section className="ga4live">
  <div className="sectiontitle"><h2>마케팅 비용</h2><span>{loading?'조회 중…':'Google Ads · Meta · 수동'}</span></div>
  <p className="note">{startDate} ~ {endDate} ({days}일) · ROAS = AdMob 수익 ÷ 마케팅 비용 · 미등록 시 0</p>
  <div className="livegrid" aria-live="polite">
   {totals&&!loading&&targets.length>1&&<article className="livecard aggregate"><h3>전체 합산 <small>{totals.n}개 앱</small></h3><dl>{[
    ['마케팅 비용 합',fmtSpend(totals.spend)],
    ['ROAS',totals.roas==null?'—':totals.roas.toFixed(2)+'x'],
    ['Google Ads',fmtSpend(totals.bySource.google_ads||0)],
    ['Meta',fmtSpend(totals.bySource.meta||0)],
    ['수동·기타',fmtSpend((totals.bySource.manual||0)+(totals.bySource.other||0))],
   ].map(([n,v])=><div key={n}><dt>{n}</dt><dd>{v}</dd></div>)}</dl></article>}
   {targets.map(a=>{
    const r=results[a.id];
    return <article className="livecard" key={a.id}><h3><AppMark id={a.id} name={a.name}/></h3>
     {!r?<p>비용 조회 중…</p>:r.status==='error'?<><p>{r.message}</p><a href="/connections#marketing">마케팅 연결 →</a></>:<><dl>{[
      ['마케팅 비용',fmtSpend(r.data.spend)],
      ['ROAS',r.data.roas==null?'—':r.data.roas.toFixed(2)+'x'],
      ['Google Ads',fmtSpend(r.data.bySource.google_ads||0)],
      ['Meta',fmtSpend(r.data.bySource.meta||0)],
      ['수동',fmtSpend(r.data.bySource.manual||0)],
      ['기타',fmtSpend(r.data.bySource.other||0)],
     ].map(([n,v])=><div key={n}><dt>{n}</dt><dd>{v}</dd></div>)}</dl>
     <small>조회 {new Date(r.data.fetchedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} KST</small></>}
    </article>;
   })}
  </div>
  {!!chartSeries.length&&!loading&&<div className="panel" style={{marginTop:20}}><div className="sectiontitle"><h2>일별 마케팅 비용</h2><span>앱별</span></div><TrendChart series={chartSeries}/></div>}
 </section>;
}
