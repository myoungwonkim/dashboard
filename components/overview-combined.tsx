import {useEffect,useMemo,useState} from 'react';
import type {AppRecord} from '@/lib/apps';
import {dailyEcpi,sumPointsByDate} from '@/lib/series-sum.mts';
import {cpi} from '@/lib/marketing-format.mts';
import TrendChart from './trend-chart';
import AppToggle,{useAppFilter} from './app-toggle';

type Ga4Daily={date:string;active:number;newUsers?:number};
type MktDaily={date:string;spend:number};
type PartMap=Record<string,{date:string;value:number}[]>;

const COLORS={
 active:'#222222',
 neu:'#3d7ea6',
 spend:'#b85c38',
 ecpi:'#2f6f4e',
 revenue:'#5a5a55',
};

function pickParts(map:PartMap,ids:string[]){
 return ids.map(id=>map[id]||[]).filter(p=>p.length);
}

export default function OverviewCombined({apps,days,startDate,endDate,country,os,onLoadingChange}:{apps:AppRecord[];days:number;startDate:string;endDate:string;country:string;os:string;onLoadingChange?:(loading:boolean)=>void}){
 const [loading,setLoading]=useState(true);
 const [activeByApp,setActiveByApp]=useState<PartMap>({});
 const [newByApp,setNewByApp]=useState<PartMap>({});
 const [spendByApp,setSpendByApp]=useState<PartMap>({});
 const [revenueByApp,setRevenueByApp]=useState<PartMap>({});
 const [periodNewByApp,setPeriodNewByApp]=useState<Record<string,number>>({});
 const [periodSpendByApp,setPeriodSpendByApp]=useState<Record<string,number>>({});
 const appOpts=useMemo(()=>apps.map(a=>({id:a.id,name:a.name})),[apps]);
 const filter=useAppFilter(appOpts);
 useEffect(()=>{onLoadingChange?.(loading);return ()=>onLoadingChange?.(false);},[loading,onLoadingChange]);

 useEffect(()=>{
  const c=new AbortController();let alive=true;setLoading(true);
  setActiveByApp({});setNewByApp({});setSpendByApp({});setRevenueByApp({});
  setPeriodNewByApp({});setPeriodSpendByApp({});
  (async()=>{
   const ga4Apps=apps.filter(a=>a.ga4PropertyId);
   const admobApps=apps.filter(a=>a.admobAndroidAppId||a.admobIosAppId);
   const act:PartMap={};const neu:PartMap={};const spd:PartMap={};const rev:PartMap={};
   const newSum:Record<string,number>={};const spendSum:Record<string,number>={};
   await Promise.all([
    ...ga4Apps.map(async a=>{
     try{
      const r=await fetch('/api/ga4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days,startDate,endDate,country,os}),signal:c.signal});
      const body=await r.json() as {status:string;data?:{newUsers?:number;daily:Ga4Daily[]}};
      if(r.ok&&body.status==='success'&&body.data){
       const daily=body.data.daily||[];
       act[a.id]=daily.map(d=>({date:d.date,value:d.active}));
       neu[a.id]=daily.map(d=>({date:d.date,value:d.newUsers??0}));
       newSum[a.id]=body.data.newUsers??0;
      }
     }catch{}
    }),
    ...apps.map(async a=>{
     try{
      const r=await fetch('/api/marketing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days,startDate,endDate}),signal:c.signal});
      const body=await r.json() as {status:string;data?:{spend:number;daily:MktDaily[]}};
      if(r.ok&&body.status==='success'&&body.data){
       spd[a.id]=(body.data.daily||[]).map(d=>({date:d.date,value:d.spend}));
       spendSum[a.id]=body.data.spend||0;
      }
     }catch{}
    }),
    ...admobApps.map(async a=>{
     try{
      const r=await fetch('/api/admob',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days,startDate,endDate,country,os}),signal:c.signal});
      const body=await r.json() as {status:string;data?:{daily:{date:string;revenue:number}[]}};
      if(r.ok&&body.status==='success'&&body.data?.daily)rev[a.id]=body.data.daily.map(d=>({date:d.date,value:d.revenue}));
     }catch{}
    }),
   ]);
   if(!alive)return;
   setActiveByApp(act);setNewByApp(neu);setSpendByApp(spd);setRevenueByApp(rev);
   setPeriodNewByApp(newSum);setPeriodSpendByApp(spendSum);setLoading(false);
  })();
  return ()=>{alive=false;c.abort();};
 },[apps.map(a=>a.id).join(','),days,startDate,endDate,country,os]);

 const selectedIds=useMemo(()=>apps.filter(a=>filter.includes(a.id)).map(a=>a.id),[apps,filter.selected,filter.allOn]);
 const hero=useMemo(()=>{
  const active=sumPointsByDate(pickParts(activeByApp,selectedIds));
  const neu=sumPointsByDate(pickParts(newByApp,selectedIds));
  const spend=sumPointsByDate(pickParts(spendByApp,selectedIds));
  const ecpi=dailyEcpi(spend,neu);
  return [
   {name:'일별 활성',color:COLORS.active,points:active},
   {name:'신규 사용자',color:COLORS.neu,points:neu,dashed:true},
   {name:'마케팅 비용',color:COLORS.spend,points:spend,format:'usd' as const},
   {name:'eCPI',color:COLORS.ecpi,points:ecpi,format:'usd' as const,aggregate:'avg' as const},
  ].filter(s=>s.points.length);
 },[activeByApp,newByApp,spendByApp,selectedIds]);

 const revenueSeries=useMemo(()=>{
  const points=sumPointsByDate(pickParts(revenueByApp,selectedIds));
  return points.length?[{name:'광고 수익 합',color:COLORS.revenue,points,format:'usd' as const}]:[];
 },[revenueByApp,selectedIds]);

 const periodNewUsers=selectedIds.reduce((s,id)=>s+(periodNewByApp[id]||0),0);
 const periodSpend=selectedIds.reduce((s,id)=>s+(periodSpendByApp[id]||0),0);
 const periodEcpi=cpi(periodSpend,periodNewUsers);
 const multi=selectedIds.length>1;
 const scopeLabel=filter.label;
 const revenueSeriesNamed=useMemo(()=>revenueSeries.map(s=>({...s,name:multi?'광고 수익 합':'광고 수익'})),[revenueSeries,multi]);

 return <section className="overview-combined" id="section-trends">
  <div className="sectiontitle marketing-title">
   <div className="marketing-title-row">
    <h2>{apps.length>1?'합산 추세':'핵심 추세'}</h2>
    <AppToggle apps={appOpts} allOn={filter.allOn} selected={filter.selected} onSelectAll={filter.selectAll} onToggle={filter.toggle} label="추세 앱"/>
   </div>
   <span>{loading?'조회 중…':(multi?'앱 합 · 시리즈 온/오프':'시리즈 온/오프')}</span>
  </div>
  <p className="note">{multi?'앱별 수치를 날짜별로 합칩니다. ':''}eCPI = 마케팅 비용 ÷ 신규 사용자(GA4) · 기간 eCPI {periodEcpi==null?'—':'$'+periodEcpi.toFixed(2)} · {scopeLabel} · 블록을 눌러 그래프를 켜고 끌 수 있습니다.</p>
  {!!hero.length&&!loading&&<div className="panel"><div className="sectiontitle"><h2>일별 활성 · 신규 · 비용 · eCPI</h2><span>{scopeLabel}</span></div><TrendChart series={hero} height={220}/></div>}
  {!!revenueSeriesNamed.length&&!loading&&<div className="panel" style={{marginTop:16}}><div className="sectiontitle"><h2>일별 광고 수익</h2><span>{scopeLabel}</span></div><TrendChart series={revenueSeriesNamed}/></div>}
  {!loading&&!hero.length&&!revenueSeriesNamed.length&&<p className="note">표시할 일별 데이터가 없습니다. 연결 상태를 확인해 주세요.</p>}
 </section>;
}
