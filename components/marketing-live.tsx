import {useEffect,useMemo,useState} from 'react';
import type {AppRecord} from '@/lib/apps';
import {appColor} from '@/lib/app-colors';
import {cpi} from '@/lib/marketing-format.mts';
import TrendChart from './trend-chart';

type Day={date:string;spend:number};
type Data={spend:number;bySource:Record<string,number>;daily:Day[];roas:number|null;fetchedAt:string};
type Result={status:'success';data:Data}|{status:'error';message:string};
function fmtSpend(v:number|null|undefined){return v==null||!Number.isFinite(v)?'—':'$'+v.toFixed(2);}
function fmtCpi(v:number|null|undefined){return v==null||!Number.isFinite(v)?'—':'$'+v.toFixed(2);}
function roas(revenue:number|null|undefined,spend:number|null|undefined){if(revenue==null||spend==null||!(spend>0))return null;return revenue/spend;}

const SOURCE_ORDER=[{id:'google_ads',label:'Google Ads'},{id:'meta',label:'Meta'},{id:'manual',label:'수동'},{id:'other',label:'기타'}] as const;

function AppMark({id,name}:{id:string;name:string}){
 return <span className="apptitle"><span className="appdot" style={{background:appColor(id)}} aria-hidden/>{name}</span>;
}

export default function MarketingLive({apps,app,days,startDate,endDate,revenueByApp,newUsersByApp,showCharts=true}:{apps:AppRecord[];app?:string;days:number;startDate:string;endDate:string;revenueByApp?:Record<string,number|undefined>;newUsersByApp?:Record<string,number|undefined>;showCharts?:boolean}){
 const [results,setResults]=useState<Record<string,Result>>({});
 const [fetchedNewUsers,setFetchedNewUsers]=useState<Record<string,number>>({});
 const [loading,setLoading]=useState(true);
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

 const totals=useMemo(()=>{
  const ok=targets.map(a=>results[a.id]).filter((r):r is Extract<Result,{status:'success'}>=>r?.status==='success');
  if(ok.length<1)return null;
  const spend=ok.reduce((s,r)=>s+r.data.spend,0);
  const rev=targets.reduce((s,a)=>s+(revenueByApp?.[a.id]||0),0);
  const newUsers=targets.reduce((s,a)=>s+(resolvedNew(a.id)||0),0);
  const bySource:Record<string,number>={};
  for(const r of ok)for(const [k,v] of Object.entries(r.data.bySource||{}))bySource[k]=(bySource[k]||0)+v;
  const byCpi:Record<string,number|null>={};
  for(const s of SOURCE_ORDER)byCpi[s.id]=cpi(bySource[s.id]||0,newUsers);
  return {spend,roas:roas(rev||null,spend),bySource,byCpi,ecpi:cpi(spend,newUsers),newUsers,n:ok.length};
 },[targets,results,revenueByApp,newUsersByApp,fetchedNewUsers]);

 const chartSeries=targets.flatMap(a=>{
  const r=results[a.id];if(!r||r.status!=='success'||!r.data.daily.length)return [];
  return [{name:a.name+' 비용',color:appColor(a.id),points:r.data.daily.map(d=>({date:d.date,value:d.spend})),format:'usd' as const}];
 });

 return <section className="ga4live">
  <div className="sectiontitle"><h2>마케팅 비용</h2><span>{loading?'조회 중…':'비용 · CPI · ROAS'}</span></div>
  <p className="note">{startDate} ~ {endDate} ({days}일) · CPI/eCPI = 채널(또는 전체) 비용 ÷ GA4 신규 사용자 · ROAS = AdMob 수익 ÷ 비용 · <a href="/connections#marketing">비용 입력</a></p>
  <div className="livegrid" aria-live="polite">
   {totals&&!loading&&targets.length>1&&<article className="livecard aggregate"><h3>전체 합산 <small>{totals.n}개 앱</small></h3><dl>{[
    ['마케팅 비용 합',fmtSpend(totals.spend)],
    ['eCPI',fmtCpi(totals.ecpi)],
    ['신규(GA4) 합',totals.newUsers?totals.newUsers.toLocaleString():'—'],
    ['ROAS',totals.roas==null?'—':totals.roas.toFixed(2)+'x'],
    ...SOURCE_ORDER.flatMap(s=>[
     [s.label,fmtSpend(totals.bySource[s.id]||0)] as [string,string],
     [`${s.label} CPI`,fmtCpi(totals.byCpi[s.id])] as [string,string],
    ]),
   ].map(([n,v])=><div key={n}><dt>{n}</dt><dd>{v}</dd></div>)}</dl><small>채널 CPI = 해당 채널 비용 ÷ 전체 신규 사용자(앱 합). 유입 채널 귀속이 없을 때의 eCPI 분해입니다.</small></article>}
   {targets.map(a=>{
    const r=results[a.id];
    const neu=resolvedNew(a.id);
    const by=r?.status==='success'?r.data.bySource:{};
    return <article className="livecard" key={a.id}><h3><AppMark id={a.id} name={a.name}/></h3>
     {!r?<p>비용 조회 중…</p>:r.status==='error'?<><p>{r.message}</p><a href="/connections#marketing">마케팅 연결 →</a></>:<><dl>{[
      ['마케팅 비용',fmtSpend(r.data.spend)],
      ['eCPI',fmtCpi(cpi(r.data.spend,neu))],
      ['신규(GA4)',neu!=null?neu.toLocaleString():'—'],
      ['ROAS',r.data.roas==null?'—':r.data.roas.toFixed(2)+'x'],
      ...SOURCE_ORDER.flatMap(s=>[
       [s.label,fmtSpend(by[s.id]||0)] as [string,string],
       [`${s.label} CPI`,fmtCpi(cpi(by[s.id]||0,neu))] as [string,string],
      ]),
     ].map(([n,v])=><div key={n}><dt>{n}</dt><dd>{v}</dd></div>)}</dl>
     <small>조회 {new Date(r.data.fetchedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} KST · CPI=비용÷신규</small></>}
    </article>;
   })}
  </div>
  {showCharts&&!!chartSeries.length&&!loading&&<div className="panel" style={{marginTop:20}}><div className="sectiontitle"><h2>일별 마케팅 비용</h2><span>앱별</span></div><TrendChart series={chartSeries}/></div>}
 </section>;
}
