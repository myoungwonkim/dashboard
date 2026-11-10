import {useEffect,useState} from 'react';
import type {AppRecord} from '@/lib/apps';
import TrendChart from './trend-chart';
type Data={
 revenue:number;impressions:number;clicks:number;ecpm:number;ctr?:number;currency:string;timeZone:string;fetchedAt:string;limited:boolean;
 adRequests?:number;matchedRequests?:number;matchRate?:number;showRate?:number;
 daily:{date:string;revenue:number}[];
 countries?:{country:string;revenue:number;impressions:number;clicks:number;ecpm:number;ctr:number;adRequests:number;matchedRequests:number}[];
 formats?:{format:string;revenue:number;impressions:number;clicks:number;ecpm:number;ctr:number;adRequests:number;matchedRequests:number}[];
};
type Result={status:'success',data:Data}|{status:'error',message:string};
export default function AdmobLive({apps,app,days,startDate,endDate,country,os}:{apps:AppRecord[];app?:string;days:number;startDate:string;endDate:string;country:string;os:string}){
 const [results,setResults]=useState<Record<string,Result>>({}),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 const targets=apps.filter(a=>(a.admobAndroidAppId||a.admobIosAppId)&&(!app||a.id===app));
 useEffect(()=>{const c=new AbortController();let active=true;setLoading(true);setResults({});
 if(!targets.length){setLoading(false);return ()=>{active=false;c.abort();};}
 Promise.all(targets.map(async a=>{let result:Result;try{const r=await fetch('/api/admob',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days,startDate,endDate,country,os}),signal:c.signal});result=await r.json() as Result;}catch{result={status:'error',message:'AdMob 서버에 연결하지 못했습니다.'};}if(active)setResults(p=>({...p,[a.id]:result}));})).finally(()=>{if(active)setLoading(false);});return ()=>{active=false;c.abort();};},[app,days,startDate,endDate,country,os,retry,targets.map(t=>t.id).join(',')]);
 const chartSeries=targets.flatMap(a=>{const r=results[a.id];if(!r||r.status!=='success')return [];return [{name:a.name+' 수익',color:'#888',dashed:true,points:r.data.daily.map(d=>({date:d.date,value:d.revenue}))}];});
 const detail=app?results[app]:undefined;
 const detailData=detail?.status==='success'?detail.data:null;
 return <section className="ga4live"><div className="sectiontitle"><h2>AdMob 광고 수익</h2><button className="refresh" disabled={loading} onClick={()=>setRetry(x=>x+1)}>{loading?'조회 중…':'새로고침'}</button></div><p className="note">AdMob 네트워크 보고서 · USD · 계정 시간대 기준 {startDate} ~ {endDate} ({days}일) · 오늘 포함 시 집계 중 · 수익은 추정치</p>
 {!targets.length?<p className="note">AdMob 앱 ID가 등록된 앱이 없습니다.</p>:<div className="livegrid" aria-live="polite">{targets.map(a=>{const r=results[a.id];const ctr=r&&r.status==='success'?(r.data.ctr??(r.data.impressions?r.data.clicks/r.data.impressions:0)):0;return <article className="livecard" key={a.id}><h3>{a.name}</h3>{!r?<p>수익 조회 중…</p>:r.status==='error'?<><p>{r.message}</p><a href="/connections">데이터 연결 확인 →</a></>:<><dl>{[
  ['예상 광고 수익','$'+r.data.revenue.toFixed(2)],
  ['광고 요청',(r.data.adRequests??0).toLocaleString()],
  ['매칭',(r.data.matchedRequests??0).toLocaleString()],
  ['매칭률',((r.data.matchRate??0)*100).toFixed(1)+'%'],
  ['노출률',((r.data.showRate??0)*100).toFixed(1)+'%'],
  ['광고 노출',r.data.impressions.toLocaleString()],
  ['클릭',r.data.clicks.toLocaleString()],
  ['eCPM','$'+r.data.ecpm.toFixed(2)],
  ['CTR',(ctr*100).toFixed(2)+'%'],
 ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><small>시간대 {r.data.timeZone} · 조회 {new Date(r.data.fetchedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} KST</small>{r.data.limited&&<p>보고서에 제한 또는 누락 경고가 있습니다. 전체 수치로 해석하지 마세요.</p>}</>}</article>;})}</div>}
 {!!chartSeries.length&&!loading&&<div className="panel" style={{marginTop:20}}><div className="sectiontitle"><h2>일별 예상 수익</h2><span>AdMob · USD</span></div><TrendChart series={chartSeries}/></div>}
 {detailData&&!loading&&<>
 {!!detailData.formats?.length&&<div className="panel" style={{marginTop:20}}><div className="sectiontitle"><h2>광고 포맷</h2><span>수익 · 노출</span></div><div className="tablewrap"><table><thead><tr><th>포맷</th><th>수익</th><th>노출</th><th>요청</th><th>매칭</th><th>eCPM</th><th>CTR</th></tr></thead><tbody>{detailData.formats.map(f=><tr key={f.format}><td>{f.format}</td><td>${f.revenue.toFixed(2)}</td><td>{f.impressions.toLocaleString()}</td><td>{f.adRequests.toLocaleString()}</td><td>{f.matchedRequests.toLocaleString()}</td><td>${f.ecpm.toFixed(2)}</td><td>{(f.ctr*100).toFixed(2)}%</td></tr>)}</tbody></table></div></div>}
 {!!detailData.countries?.length&&<div className="panel" style={{marginTop:20}}><div className="sectiontitle"><h2>국가별 수익</h2><span>AdMob</span></div><div className="tablewrap"><table><thead><tr><th>국가</th><th>수익</th><th>노출</th><th>eCPM</th><th>CTR</th></tr></thead><tbody>{detailData.countries.map(c=><tr key={c.country}><td>{c.country}</td><td>${c.revenue.toFixed(2)}</td><td>{c.impressions.toLocaleString()}</td><td>${c.ecpm.toFixed(2)}</td><td>{(c.ctr*100).toFixed(2)}%</td></tr>)}</tbody></table></div></div>}
 </>}
 </section>;
}
