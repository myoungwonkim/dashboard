import {useEffect,useMemo,useState} from 'react';
import type {AppRecord} from '@/lib/apps';
import {appColor} from '@/lib/app-colors';
import {adArpu,adArpdau,fmtUsd} from '@/lib/arpu.mts';
import {formatLabel} from '@/lib/admob-core.mts';
import {sumNums} from '@/lib/metric-rollups.mts';
import TrendChart from './trend-chart';
import MetricTable from './metric-table';
import AppToggle,{useAppFilter} from './app-toggle';
type AdUnitRow={adUnitId:string;name:string;format:string;formatLabel?:string;revenue:number;impressions:number;clicks:number;ecpm:number;ctr:number;adRequests:number;matchedRequests:number};
type Data={
 revenue:number;impressions:number;clicks:number;ecpm:number;ctr?:number;currency:string;timeZone:string;fetchedAt:string;limited:boolean;
 adRequests?:number;matchedRequests?:number;matchRate?:number;showRate?:number;
 daily:{date:string;revenue:number}[];
 countries?:{country:string;revenue:number;impressions:number;clicks:number;ecpm:number;ctr:number;adRequests:number;matchedRequests:number}[];
 formats?:{format:string;revenue:number;impressions:number;clicks:number;ecpm:number;ctr:number;adRequests:number;matchedRequests:number}[];
 adUnits?:AdUnitRow[];
};
type Ga4Users={activeUsers:number;averageDau:number;daily:{date:string;active:number}[]};
type Result={status:'success',data:Data}|{status:'error',message:string};
function AppMark({id,name}:{id:string;name:string}){
 return <span className="apptitle"><span className="appdot" style={{background:appColor(id)}} aria-hidden/>{name}</span>;
}
export default function AdmobLive({apps,app,days,startDate,endDate,country,os,showCharts=true,onLoadingChange}:{apps:AppRecord[];app?:string;days:number;startDate:string;endDate:string;country:string;os:string;showCharts?:boolean;onLoadingChange?:(loading:boolean)=>void}){
 const [results,setResults]=useState<Record<string,Result>>({}),[users,setUsers]=useState<Record<string,Ga4Users|null>>({}),[loading,setLoading]=useState(true);
 const targets=apps.filter(a=>(a.admobAndroidAppId||a.admobIosAppId)&&(!app||a.id===app));
 useEffect(()=>{onLoadingChange?.(loading);return ()=>onLoadingChange?.(false);},[loading,onLoadingChange]);
 useEffect(()=>{const c=new AbortController();let active=true;setLoading(true);setResults({});setUsers({});
 if(!targets.length){setLoading(false);return ()=>{active=false;c.abort();};}
 Promise.all(targets.map(async a=>{
  let result:Result;try{const r=await fetch('/api/admob',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days,startDate,endDate,country,os}),signal:c.signal});result=await r.json() as Result;}catch{result={status:'error',message:'AdMob 서버에 연결하지 못했습니다.'};}
  let ga4:Ga4Users|null=null;
  if(a.ga4PropertyId){
   try{
    const gr=await fetch('/api/ga4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days,startDate,endDate,country,os}),signal:c.signal});
    const body=await gr.json() as {status:string;data?:{activeUsers:number;averageDau:number;daily:{date:string;active:number}[]}};
    if(gr.ok&&body.status==='success'&&body.data)ga4={activeUsers:body.data.activeUsers,averageDau:body.data.averageDau,daily:body.data.daily||[]};
   }catch{ga4=null;}
  }
  if(active){setResults(p=>({...p,[a.id]:result}));setUsers(p=>({...p,[a.id]:ga4}));}
 })).finally(()=>{if(active)setLoading(false);});return ()=>{active=false;c.abort();};},[app,days,startDate,endDate,country,os,targets.map(t=>t.id).join(',')]);
 const ok=useMemo(()=>targets.map(a=>{const r=results[a.id];return r?.status==='success'?{app:a,data:r.data,users:users[a.id]||null}:null;}).filter(Boolean) as {app:AppRecord;data:Data;users:Ga4Users|null}[],[targets,results,users]);
 const appOpts=useMemo(()=>targets.map(a=>({id:a.id,name:a.name})),[targets]);
 const filter=useAppFilter(appOpts);
 const viewTargets=useMemo(()=>targets.filter(a=>filter.includes(a.id)),[targets,filter.selected,filter.allOn]);
 const viewOk=useMemo(()=>ok.filter(o=>filter.includes(o.app.id)),[ok,filter.selected,filter.allOn]);
 const overview=!app;
 const focus=viewOk.length===1?viewOk[0]:null;
 const totals=useMemo(()=>{
  if(!viewOk.length)return null;
  const revenue=sumNums(viewOk.map(o=>o.data.revenue))!;
  const impressions=sumNums(viewOk.map(o=>o.data.impressions))!;
  const clicks=sumNums(viewOk.map(o=>o.data.clicks))!;
  const adRequests=sumNums(viewOk.map(o=>o.data.adRequests??0))!;
  const matched=sumNums(viewOk.map(o=>o.data.matchedRequests??0))!;
  const activeUsers=sumNums(viewOk.map(o=>o.users?.activeUsers??null));
  const averageDau=sumNums(viewOk.map(o=>o.users?.averageDau??null));
  return {
   revenue,impressions,clicks,adRequests,matchedRequests:matched,n:viewOk.length,
   matchRate:adRequests?matched/adRequests:0,
   showRate:matched?impressions/matched:0,
   ecpm:impressions?revenue/impressions*1000:0,
   ctr:impressions?clicks/impressions:0,
   arpu:adArpu(revenue,activeUsers),
   arpdau:adArpdau(revenue,averageDau,days),
  };
 },[viewOk,days]);
 const chartSeries=viewTargets.flatMap(a=>{const r=results[a.id];if(!r||r.status!=='success')return [];return [{name:a.name+' 수익',color:appColor(a.id),points:r.data.daily.map(d=>({date:d.date,value:d.revenue}))}];});
 const arpdauSeries=viewTargets.flatMap(a=>{
  const r=results[a.id];const g=users[a.id];if(!r||r.status!=='success'||!g)return [];
  const byDate=new Map(g.daily.map(d=>[d.date,d.active]));
  return [{name:a.name+' ARPDAU',color:appColor(a.id),dashed:true as const,points:r.data.daily.map(d=>{const dau=byDate.get(d.date)||0;return {date:d.date,value:dau>0?d.revenue/dau:0};})}];
 });
 const breakApps=overview?(focus?[focus.app]:[]):viewTargets;
 return <section className="ga4live" id="section-admob"><div className="sectiontitle marketing-title"><div className="marketing-title-row"><h2>AdMob 광고 수익</h2><AppToggle apps={appOpts} allOn={filter.allOn} selected={filter.selected} onSelectAll={filter.selectAll} onToggle={filter.toggle} label="AdMob 앱"/></div><span>{loading?'조회 중…':filter.label}</span></div><p className="note">AdMob 네트워크 보고서 · USD · {startDate} ~ {endDate} ({days}일) · 합산=수익·노출 합 · eCPM/CTR/ARPU=합산 후 재계산 · {filter.label}</p>
 {!targets.length?<p className="note">AdMob 앱 ID가 등록된 앱이 없습니다.</p>:<div className="livegrid" aria-live="polite">
  {!loading&&overview&&focus&&(()=>{const r=focus.data;const g=focus.users;const ctr=r.ctr??(r.impressions?r.clicks/r.impressions:0);return <article className="livecard aggregate"><h3><AppMark id={focus.app.id} name={focus.app.name}/></h3><dl>{[
   ['예상 광고 수익','$'+r.revenue.toFixed(2)],
   ['유저당 수익(ARPU)',fmtUsd(adArpu(r.revenue,g?.activeUsers))],
   ['일평균 ARPDAU',fmtUsd(adArpdau(r.revenue,g?.averageDau,days))],
   ['광고 요청',(r.adRequests??0).toLocaleString()],
   ['매칭',(r.matchedRequests??0).toLocaleString()],
   ['매칭률',((r.matchRate??0)*100).toFixed(1)+'%'],
   ['노출률',((r.showRate??0)*100).toFixed(1)+'%'],
   ['광고 노출',r.impressions.toLocaleString()],
   ['클릭',r.clicks.toLocaleString()],
   ['eCPM','$'+r.ecpm.toFixed(2)],
   ['CTR',(ctr*100).toFixed(2)+'%'],
  ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><small>시간대 {r.timeZone} · ARPU=수익/기간활성{g?`(${g.activeUsers.toLocaleString()})`:''}</small></article>;})()}
  {!loading&&overview&&!focus&&totals&&<article className="livecard aggregate"><h3>앱 합산 · 재계산 <small>{totals.n}개 앱</small></h3><dl>{[
   ['예상 광고 수익 합','$'+totals.revenue.toFixed(2)],
   ['유저당 수익(ARPU)',fmtUsd(totals.arpu)],
   ['일평균 ARPDAU',fmtUsd(totals.arpdau)],
   ['광고 요청 합',totals.adRequests.toLocaleString()],
   ['매칭 합',totals.matchedRequests.toLocaleString()],
   ['매칭률',(totals.matchRate*100).toFixed(1)+'%'],
   ['노출률',(totals.showRate*100).toFixed(1)+'%'],
   ['광고 노출 합',totals.impressions.toLocaleString()],
   ['클릭 합',totals.clicks.toLocaleString()],
   ['eCPM','$'+totals.ecpm.toFixed(2)],
   ['CTR',(totals.ctr*100).toFixed(2)+'%'],
  ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><small>수익·노출·클릭은 합산, eCPM/CTR/ARPU는 합산값으로 다시 계산합니다.</small></article>}
  {!overview&&viewTargets.map(a=>{const r=results[a.id];const g=users[a.id];const ctr=r&&r.status==='success'?(r.data.ctr??(r.data.impressions?r.data.clicks/r.data.impressions:0)):0;const arpu=r&&r.status==='success'?adArpu(r.data.revenue,g?.activeUsers):null;const arpdau=r&&r.status==='success'?adArpdau(r.data.revenue,g?.averageDau,days):null;return <article className="livecard" key={a.id}><h3><AppMark id={a.id} name={a.name}/></h3>{!r?<p>수익 조회 중…</p>:r.status==='error'?<><p>{r.message}</p><a href="/connections">데이터 연결 확인 →</a></>:<><dl>{[
  ['예상 광고 수익','$'+r.data.revenue.toFixed(2)],
  ['유저당 수익(ARPU)',fmtUsd(arpu)],
  ['일평균 ARPDAU',fmtUsd(arpdau)],
  ['광고 요청',(r.data.adRequests??0).toLocaleString()],
  ['매칭',(r.data.matchedRequests??0).toLocaleString()],
  ['매칭률',((r.data.matchRate??0)*100).toFixed(1)+'%'],
  ['노출률',((r.data.showRate??0)*100).toFixed(1)+'%'],
  ['광고 노출',r.data.impressions.toLocaleString()],
  ['클릭',r.data.clicks.toLocaleString()],
  ['eCPM','$'+r.data.ecpm.toFixed(2)],
  ['CTR',(ctr*100).toFixed(2)+'%'],
 ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><small>시간대 {r.data.timeZone} · 조회 {new Date(r.data.fetchedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} KST · ARPU=수익/기간활성{g?`(${g.activeUsers.toLocaleString()})`:''}</small>{r.data.limited&&<p>보고서에 제한 또는 누락 경고가 있습니다.</p>}</>}</article>;})}
 </div>}
 {showCharts&&!!chartSeries.length&&!loading&&<div className="panel" style={{marginTop:20}}><div className="sectiontitle"><h2>일별 예상 수익 · ARPDAU</h2><span>AdMob · 앱별</span></div><TrendChart series={[...chartSeries,...arpdauSeries]}/></div>}
 {!loading&&breakApps.map(a=>{
  const r=results[a.id];if(!r||r.status!=='success')return null;
  const g=users[a.id];const active=g?.activeUsers;
  const units=r.data.adUnits||[];
  const formats=r.data.formats||[];
  if(!units.length&&!formats.length&&!(app&&r.data.countries?.length))return null;
  const showFormats=!!formats.length&&(app||!!filter.soleId||targets.length===1);
  const showCountries=!!((app||filter.soleId)&&r.data.countries?.length);
  return <div key={a.id+'-break'} style={{marginTop:20}}>
   {!!units.length&&<div className="panel"><div className="sectiontitle"><h2><AppMark id={a.id} name={a.name}/> · 광고 유닛별 수익</h2><span>핵심 지표</span></div>
    <p className="note">유저당 = 유닛 수익 ÷ GA4 기간 활성({active!=null?active.toLocaleString():'—'}명). 노출·CTR은 행에 마우스를 올리면 보입니다.</p>
    <MetricTable rows={units} rowKey={u=>u.adUnitId+'/'+u.format} defaultSort={{key:'revenue',dir:'desc'}} rowTitle={u=>`${u.adUnitId} · 노출 ${u.impressions.toLocaleString()} · CTR ${(u.ctr*100).toFixed(2)}%`} columns={[
     {key:'name',label:'이름',className:'cell-text',get:u=>u.name,render:u=>u.name===u.adUnitId?<span style={{color:'#888'}}>이름 없음</span>:<strong>{u.name}</strong>},
     {key:'format',label:'타입',get:u=>u.formatLabel||u.format,render:u=>u.formatLabel||u.format},
     {key:'revenue',label:'수익',get:u=>u.revenue,render:u=>`$${u.revenue.toFixed(2)}`},
     {key:'arpu',label:'유저당',get:u=>adArpu(u.revenue,active),render:u=>fmtUsd(adArpu(u.revenue,active))},
     {key:'ecpm',label:'eCPM',get:u=>u.ecpm,render:u=>`$${u.ecpm.toFixed(2)}`},
    ]}/>
   </div>}
   {(showFormats||showCountries)&&<div className="detail-grid" style={{marginTop:units.length?16:0}}>
    {showFormats&&<div className="panel"><div className="sectiontitle"><h2>광고 타입</h2><span>수익 · 유저당</span></div><MetricTable rows={formats} rowKey={f=>f.format} defaultSort={{key:'revenue',dir:'desc'}} rowTitle={f=>`노출 ${f.impressions.toLocaleString()} · 요청 ${f.adRequests.toLocaleString()} · 매칭 ${f.matchedRequests.toLocaleString()}`} columns={[
     {key:'format',label:'타입',get:f=>formatLabel(f.format),render:f=>formatLabel(f.format)},
     {key:'revenue',label:'수익',get:f=>f.revenue,render:f=>`$${f.revenue.toFixed(2)}`},
     {key:'arpu',label:'유저당',get:f=>adArpu(f.revenue,active),render:f=>fmtUsd(adArpu(f.revenue,active))},
     {key:'ecpm',label:'eCPM',get:f=>f.ecpm,render:f=>`$${f.ecpm.toFixed(2)}`},
     {key:'ctr',label:'CTR',get:f=>f.ctr,render:f=>`${(f.ctr*100).toFixed(2)}%`},
    ]}/></div>}
    {showCountries&&<div className="panel"><div className="sectiontitle"><h2>국가별 수익</h2><span>Top</span></div><MetricTable rows={r.data.countries!.slice(0,12)} rowKey={c=>c.country} defaultSort={{key:'revenue',dir:'desc'}} rowTitle={c=>`노출 ${c.impressions.toLocaleString()} · CTR ${(c.ctr*100).toFixed(2)}%`} columns={[
     {key:'country',label:'국가',className:'cell-text',get:c=>c.country,render:c=>c.country},
     {key:'revenue',label:'수익',get:c=>c.revenue,render:c=>`$${c.revenue.toFixed(2)}`},
     {key:'arpu',label:'유저당',get:c=>adArpu(c.revenue,active),render:c=>fmtUsd(adArpu(c.revenue,active))},
     {key:'ecpm',label:'eCPM',get:c=>c.ecpm,render:c=>`$${c.ecpm.toFixed(2)}`},
    ]}/></div>}
   </div>}
  </div>;
 })}
 </section>;
}
