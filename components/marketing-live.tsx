import {useEffect,useMemo,useState} from 'react';
import type {AppRecord} from '@/lib/apps';
import {appColor} from '@/lib/app-colors';
import {cpi,rollupMarketing,type MarketingDay,type MarketingSource} from '@/lib/marketing-format.mts';
import TrendChart from './trend-chart';

type Day={date:string;spend:number};
type Data={spend:number;bySource:Record<string,number>;daily:Day[];rows?:MarketingDay[];roas:number|null;fetchedAt:string};
type Result={status:'success';data:Data}|{status:'error',message:string};

function fmtSpend(v:number|null|undefined){return v==null||!Number.isFinite(v)?'—':'$'+v.toFixed(2);}
function fmtCpi(v:number|null|undefined){return v==null||!Number.isFinite(v)?'—':'$'+v.toFixed(2);}
function roas(revenue:number|null|undefined,spend:number|null|undefined){if(revenue==null||spend==null||!(spend>0))return null;return revenue/spend;}

const SOURCE_CHANNELS: {id:MarketingSource;label:string}[]=[
 {id:'google_ads',label:'Google Ads'},
 {id:'meta',label:'Meta'},
 {id:'manual',label:'수동'},
 {id:'other',label:'기타'},
];
const ALL_SOURCES=SOURCE_CHANNELS.map(c=>c.id);

function AppMark({id,name}:{id:string;name:string}){
 return <span className="apptitle"><span className="appdot" style={{background:appColor(id)}} aria-hidden/>{name}</span>;
}

function filterRows(rows:MarketingDay[]|undefined,selected:Set<MarketingSource>):MarketingDay[]{
 if(!rows?.length)return [];
 if(selected.size===0||selected.size===ALL_SOURCES.length)return rows;
 return rows.filter(r=>selected.has(r.source));
}

function spendFromData(data:Data,selected:Set<MarketingSource>){
 const rows=filterRows(data.rows,selected);
 if(data.rows?.length)return rollupMarketing(rows);
 if(selected.size===0||selected.size===ALL_SOURCES.length)return {spend:data.spend,bySource:data.bySource,daily:data.daily};
 let spend=0;
 const bySource:Record<string,number>={};
 for(const id of selected){
  const v=data.bySource?.[id]||0;
  bySource[id]=v;spend+=v;
 }
 return {spend,bySource,daily:[] as Day[]};
}

function channelLabel(selected:Set<MarketingSource>){
 if(selected.size===0||selected.size===ALL_SOURCES.length)return '전체';
 return SOURCE_CHANNELS.filter(c=>selected.has(c.id)).map(c=>c.label).join(' · ');
}

export default function MarketingLive({apps,app,days,startDate,endDate,revenueByApp,newUsersByApp,showCharts=true}:{apps:AppRecord[];app?:string;days:number;startDate:string;endDate:string;revenueByApp?:Record<string,number|undefined>;newUsersByApp?:Record<string,number|undefined>;showCharts?:boolean}){
 const [results,setResults]=useState<Record<string,Result>>({});
 const [fetchedNewUsers,setFetchedNewUsers]=useState<Record<string,number>>({});
 const [loading,setLoading]=useState(true);
 const [selected,setSelected]=useState<Set<MarketingSource>>(()=>new Set(ALL_SOURCES));
 const targets=apps.filter(a=>!app||a.id===app);
 useEffect(()=>{
  const controller=new AbortController();let active=true;setLoading(true);setResults({});setFetchedNewUsers({});
  if(!targets.length){setLoading(false);return ()=>{active=false;controller.abort();};}
  Promise.all(targets.map(async a=>{
   let result:Result;
   try{
    const res=await fetch('/api/marketing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days,startDate,endDate,revenue:revenueByApp?.[a.id]}),signal:controller.signal});
    const body=await res.json() as Result;
    result=res.ok&&body.status==='success'?body:{status:'error',message:body.status==='error'?body.message:'조회 실패'};
   }catch{result={status:'error',message:'서버에 연결할 수 없습니다.'};}
   let neu:number|undefined=newUsersByApp?.[a.id];
   if(neu==null&&a.ga4PropertyId){
    try{
     const gr=await fetch('/api/ga4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days,startDate,endDate}),signal:controller.signal});
     const gb=await gr.json() as {status:string;data?:{newUsers?:number}};
     if(gr.ok&&gb.status==='success')neu=gb.data?.newUsers??0;
    }catch{}
   }
   if(active){
    setResults(prev=>({...prev,[a.id]:result}));
    if(neu!=null)setFetchedNewUsers(prev=>({...prev,[a.id]:neu!}));
   }
  })).finally(()=>{if(active)setLoading(false);});
  return ()=>{active=false;controller.abort();};
 },[app,days,startDate,endDate,targets.map(t=>t.id).join(','),JSON.stringify(revenueByApp||{}),JSON.stringify(newUsersByApp||{})]);

 const resolvedNew=(id:string)=>newUsersByApp?.[id]??fetchedNewUsers[id];
 const allOn=selected.size===ALL_SOURCES.length;
 const label=channelLabel(selected);

 const totals=useMemo(()=>{
  const ok=targets.map(a=>{const r=results[a.id];return r?.status==='success'?{id:a.id,data:r.data}:null;}).filter(Boolean) as {id:string;data:Data}[];
  if(ok.length<1)return null;
  let spend=0;
  const dailyMap=new Map<string,number>();
  for(const o of ok){
   const roll=spendFromData(o.data,selected);
   spend+=roll.spend;
   for(const d of roll.daily)dailyMap.set(d.date,(dailyMap.get(d.date)||0)+d.spend);
  }
  const rev=targets.reduce((s,a)=>s+(revenueByApp?.[a.id]||0),0);
  const newUsers=targets.reduce((s,a)=>s+(resolvedNew(a.id)||0),0);
  return {
   spend,
   daily:[...dailyMap.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,spend])=>({date,spend})),
   roas:roas(rev||null,spend),
   ecpi:cpi(spend,newUsers),
   newUsers,
   n:ok.length,
  };
 },[targets,results,revenueByApp,newUsersByApp,fetchedNewUsers,selected]);

 const chartSeries=targets.flatMap(a=>{
  const r=results[a.id];if(!r||r.status!=='success')return [];
  const roll=spendFromData(r.data,selected);
  if(!roll.daily.length)return [];
  return [{name:a.name+' 비용',color:appColor(a.id),points:roll.daily.map(d=>({date:d.date,value:d.spend})),format:'usd' as const}];
 });

 function selectAll(){setSelected(new Set(ALL_SOURCES));}
 function toggleChannel(id:MarketingSource){
  setSelected(prev=>{
   const next=new Set(prev);
   if(next.has(id)){
    next.delete(id);
    if(!next.size)return new Set(ALL_SOURCES);
   }else next.add(id);
   return next;
  });
 }

 return <section className="ga4live">
  <div className="sectiontitle marketing-title">
   <div className="marketing-title-row">
    <h2>마케팅 비용</h2>
    <div className="channel-window" role="group" aria-label="마케팅 채널(복수 선택)">
     <button type="button" className={'channel-seg'+(allOn?' on':'')} aria-pressed={allOn} onClick={selectAll}>전체</button>
     {SOURCE_CHANNELS.map(c=>{
      const on=selected.has(c.id);
      return <button type="button" key={c.id} className={'channel-seg'+(on?' on':'')} aria-pressed={on} onClick={()=>toggleChannel(c.id)}>{c.label}</button>;
     })}
    </div>
   </div>
   <span>{loading?'조회 중…':label}</span>
  </div>
  <p className="note">{startDate} ~ {endDate} ({days}일) · 채널: {label} · CPI = 비용 ÷ GA4 신규 · ROAS = AdMob 수익 ÷ 비용 · <a href="/connections#marketing">비용 입력</a></p>
  <div className="livegrid" aria-live="polite">
   {totals&&!loading&&targets.length>1&&<article className="livecard aggregate"><h3>전체 합산 <small>{totals.n}개 앱 · {label}</small></h3><dl>{[
    ['마케팅 비용',fmtSpend(totals.spend)],
    [allOn?'eCPI':'CPI',fmtCpi(totals.ecpi)],
    ['신규(GA4)',totals.newUsers?totals.newUsers.toLocaleString():'—'],
    ['ROAS',totals.roas==null?'—':totals.roas.toFixed(2)+'x'],
   ].map(([n,v])=><div key={n}><dt>{n}</dt><dd>{v}</dd></div>)}</dl><small>선택한 채널 비용만 합산합니다. CPI = 비용 ÷ 신규 사용자.</small></article>}
   {targets.map(a=>{
    const r=results[a.id];
    const neu=resolvedNew(a.id);
    if(!r)return <article className="livecard" key={a.id}><h3><AppMark id={a.id} name={a.name}/></h3><p>비용 조회 중…</p></article>;
    if(r.status==='error')return <article className="livecard" key={a.id}><h3><AppMark id={a.id} name={a.name}/></h3><p>{r.message}</p><a href="/connections#marketing">마케팅 연결 →</a></article>;
    const roll=spendFromData(r.data,selected);
    const spend=roll.spend;
    return <article className="livecard" key={a.id}><h3><AppMark id={a.id} name={a.name}/></h3>
     <dl>{[
      ['마케팅 비용',fmtSpend(spend)],
      [allOn?'eCPI':'CPI',fmtCpi(cpi(spend,neu))],
      ['신규(GA4)',neu!=null?neu.toLocaleString():'—'],
      ['ROAS',roas(revenueByApp?.[a.id],spend)==null?'—':roas(revenueByApp?.[a.id],spend)!.toFixed(2)+'x'],
     ].map(([n,v])=><div key={n}><dt>{n}</dt><dd>{v}</dd></div>)}</dl>
     <small>조회 {new Date(r.data.fetchedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} KST · {label}</small>
    </article>;
   })}
  </div>
  {showCharts&&!!chartSeries.length&&!loading&&<div className="panel" style={{marginTop:20}}><div className="sectiontitle"><h2>일별 마케팅 비용</h2><span>{label}</span></div><TrendChart series={chartSeries}/></div>}
 </section>;
}
