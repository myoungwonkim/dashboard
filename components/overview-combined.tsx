import {useEffect,useMemo,useState} from 'react';
import type {AppRecord} from '@/lib/apps';
import {dailyEcpi,sumPointsByDate} from '@/lib/series-sum.mts';
import {cpi} from '@/lib/marketing-format.mts';
import TrendChart from './trend-chart';

type Ga4Daily={date:string;active:number;newUsers?:number};
type MktDaily={date:string;spend:number};

const COLORS={
 active:'#222222',
 neu:'#3d7ea6',
 spend:'#b85c38',
 ecpi:'#2f6f4e',
 revenue:'#5a5a55',
 play:'#444444',
 asc:'#888888',
};

export default function OverviewCombined({apps,days,startDate,endDate,country,os}:{apps:AppRecord[];days:number;startDate:string;endDate:string;country:string;os:string}){
 const [loading,setLoading]=useState(true);
 const [activeParts,setActiveParts]=useState<{date:string;value:number}[][]>([]);
 const [newParts,setNewParts]=useState<{date:string;value:number}[][]>([]);
 const [spendParts,setSpendParts]=useState<{date:string;value:number}[][]>([]);
 const [revenueParts,setRevenueParts]=useState<{date:string;value:number}[][]>([]);
 const [playParts,setPlayParts]=useState<{date:string;value:number}[][]>([]);
 const [ascParts,setAscParts]=useState<{date:string;value:number}[][]>([]);
 const [periodNewUsers,setPeriodNewUsers]=useState(0);
 const [periodSpend,setPeriodSpend]=useState(0);

 useEffect(()=>{
  const c=new AbortController();let alive=true;setLoading(true);
  setActiveParts([]);setNewParts([]);setSpendParts([]);setRevenueParts([]);setPlayParts([]);setAscParts([]);
  setPeriodNewUsers(0);setPeriodSpend(0);
  (async()=>{
   const ga4Apps=apps.filter(a=>a.ga4PropertyId);
   const admobApps=apps.filter(a=>a.admobAndroidAppId||a.admobIosAppId);
   const playApps=apps.filter(a=>a.androidPkg);
   const ascApps=apps.filter(a=>a.appleAppId);
   const act:{date:string;value:number}[][]=[];const neu:{date:string;value:number}[][]=[];
   const spd:{date:string;value:number}[][]=[];const rev:{date:string;value:number}[][]=[];
   const play:{date:string;value:number}[][]=[];const asc:{date:string;value:number}[][]=[];
   let newSum=0;let spendSum=0;
   await Promise.all([
    ...ga4Apps.map(async a=>{
     try{
      const r=await fetch('/api/ga4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days,startDate,endDate,country,os}),signal:c.signal});
      const body=await r.json() as {status:string;data?:{newUsers?:number;daily:Ga4Daily[]}};
      if(r.ok&&body.status==='success'&&body.data){
       const daily=body.data.daily||[];
       act.push(daily.map(d=>({date:d.date,value:d.active})));
       neu.push(daily.map(d=>({date:d.date,value:d.newUsers??0})));
       newSum+=body.data.newUsers??0;
      }
     }catch{}
    }),
    ...apps.map(async a=>{
     try{
      const r=await fetch('/api/marketing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days,startDate,endDate}),signal:c.signal});
      const body=await r.json() as {status:string;data?:{spend:number;daily:MktDaily[]}};
      if(r.ok&&body.status==='success'&&body.data){
       spd.push((body.data.daily||[]).map(d=>({date:d.date,value:d.spend})));
       spendSum+=body.data.spend||0;
      }
     }catch{}
    }),
    ...admobApps.map(async a=>{
     try{
      const r=await fetch('/api/admob',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days,startDate,endDate,country,os}),signal:c.signal});
      const body=await r.json() as {status:string;data?:{daily:{date:string;revenue:number}[]}};
      if(r.ok&&body.status==='success'&&body.data?.daily)rev.push(body.data.daily.map(d=>({date:d.date,value:d.revenue})));
     }catch{}
    }),
    ...playApps.map(async a=>{
     try{
      const r=await fetch('/api/play',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days,startDate,endDate}),signal:c.signal});
      const body=await r.json() as {status:string;data?:{daily?:{date:string;installs:number}[]}};
      if(r.ok&&body.status==='success'&&body.data?.daily)play.push(body.data.daily.map(d=>({date:d.date,value:d.installs})));
     }catch{}
    }),
    ...ascApps.map(async a=>{
     try{
      const r=await fetch('/api/asc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days}),signal:c.signal});
      const body=await r.json() as {status:string;data?:{daily?:{date:string;downloads:number}[]}};
      if(r.ok&&body.status==='success'&&body.data?.daily)asc.push(body.data.daily.map(d=>({date:d.date,value:d.downloads})));
     }catch{}
    }),
   ]);
   if(!alive)return;
   setActiveParts(act);setNewParts(neu);setSpendParts(spd);setRevenueParts(rev);setPlayParts(play);setAscParts(asc);
   setPeriodNewUsers(newSum);setPeriodSpend(spendSum);setLoading(false);
  })();
  return ()=>{alive=false;c.abort();};
 },[apps.map(a=>a.id).join(','),days,startDate,endDate,country,os]);

 const hero=useMemo(()=>{
  const active=sumPointsByDate(activeParts);
  const neu=sumPointsByDate(newParts);
  const spend=sumPointsByDate(spendParts);
  const ecpi=dailyEcpi(spend,neu);
  return [
   {name:'일별 활성',color:COLORS.active,points:active},
   {name:'신규 사용자',color:COLORS.neu,points:neu,dashed:true},
   {name:'마케팅 비용',color:COLORS.spend,points:spend,format:'usd' as const},
   {name:'eCPI',color:COLORS.ecpi,points:ecpi,format:'usd' as const,aggregate:'avg' as const},
  ].filter(s=>s.points.length);
 },[activeParts,newParts,spendParts]);

 const revenueSeries=useMemo(()=>{
  const points=sumPointsByDate(revenueParts);
  return points.length?[{name:'광고 수익 합',color:COLORS.revenue,points,format:'usd' as const}]:[];
 },[revenueParts]);

 const storeSeries=useMemo(()=>{
  const play=sumPointsByDate(playParts);
  const asc=sumPointsByDate(ascParts);
  return [
   ...(play.length?[{name:'Play 설치 합',color:COLORS.play,points:play}]:[]),
   ...(asc.length?[{name:'ASC 다운로드 합',color:COLORS.asc,points:asc,dashed:true}]:[]),
  ];
 },[playParts,ascParts]);

 const periodEcpi=cpi(periodSpend,periodNewUsers);
 const multi=apps.length>1;
 const scopeLabel=multi?'합산':'이 앱';
 const revenueSeriesNamed=useMemo(()=>revenueSeries.map(s=>({...s,name:multi?'광고 수익 합':'광고 수익'})),[revenueSeries,multi]);
 const storeSeriesNamed=useMemo(()=>storeSeries.map(s=>({
  ...s,
  name:s.name.includes('Play')?(multi?'Play 설치 합':'Play 설치'):(multi?'ASC 다운로드 합':'ASC 다운로드'),
 })),[storeSeries,multi]);

 return <section className="overview-combined">
  <div className="sectiontitle"><h2>{multi?'합산 추세':'핵심 추세'}</h2><span>{loading?'조회 중…':(multi?'앱 합 · 시리즈 온/오프':'시리즈 온/오프')}</span></div>
  <p className="note">{multi?'앱별 수치를 날짜별로 합칩니다. ':''}eCPI = 마케팅 비용 ÷ 신규 사용자(GA4) · 기간 eCPI {periodEcpi==null?'—':'$'+periodEcpi.toFixed(2)} · 블록을 눌러 그래프를 켜고 끌 수 있습니다.</p>
  {!!hero.length&&!loading&&<div className="panel"><div className="sectiontitle"><h2>일별 활성 · 신규 · 비용 · eCPI</h2><span>{scopeLabel}</span></div><TrendChart series={hero} height={220}/></div>}
  {!!revenueSeriesNamed.length&&!loading&&<div className="panel" style={{marginTop:16}}><div className="sectiontitle"><h2>일별 광고 수익</h2><span>{scopeLabel}</span></div><TrendChart series={revenueSeriesNamed}/></div>}
  {!!storeSeriesNamed.length&&!loading&&<div className="panel" style={{marginTop:16}}><div className="sectiontitle"><h2>일별 스토어 유입</h2><span>{scopeLabel}</span></div><TrendChart series={storeSeriesNamed}/></div>}
  {!loading&&!hero.length&&!revenueSeriesNamed.length&&!storeSeriesNamed.length&&<p className="note">표시할 일별 데이터가 없습니다. 연결 상태를 확인해 주세요.</p>}
 </section>;
}
