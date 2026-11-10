import {useEffect,useState} from 'react';
import type {AppRecord} from '@/lib/apps';
import TrendChart from './trend-chart';
type Data={app:string,activeUsers:number,averageDau:number,sessions:number,events:number,timeZone:string,fetchedAt:string,limited:boolean,daily:{date:string,active:number}[]};
type Result={status:'success',data:Data}|{status:'error',message:string};
export default function GA4Live({apps,app,days,startDate,endDate,country,os}:{apps:AppRecord[],app?:string,days:number,startDate:string,endDate:string,country:string,os:string}){
 const [results,setResults]=useState<Record<string,Result>>({}),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 const targets=apps.filter(a=>a.ga4PropertyId&&(!app||a.id===app));
 useEffect(()=>{const controller=new AbortController();let active=true;setLoading(true);setResults({});
 if(!targets.length){setLoading(false);return ()=>{active=false;controller.abort();};}
 Promise.all(targets.map(async a=>{
 let result:Result;try{const res=await fetch('/api/ga4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days,startDate,endDate,country,os}),signal:controller.signal});const body=await res.json() as Result;result=res.ok&&body.status==='success'?body:{status:'error',message:body.status==='error'?body.message:'조회에 실패했습니다.'};}catch{result={status:'error',message:'서버에 연결할 수 없습니다.'};}
 if(active)setResults(prev=>({...prev,[a.id]:result}));
 })).finally(()=>{if(active)setLoading(false);});return ()=>{active=false;controller.abort();};},[app,days,startDate,endDate,country,os,retry,targets.map(t=>t.id).join(',')]);
 const chartSeries=targets.flatMap(a=>{const r=results[a.id];if(!r||r.status!=='success')return [];return [{name:a.name,color:app? '#222':'#555',points:r.data.daily.map(d=>({date:d.date,value:d.active}))}];});
 return <section className="ga4live"><div className="sectiontitle"><h2>Firebase / GA4 실제 데이터</h2><button className="refresh" disabled={loading} onClick={()=>setRetry(v=>v+1)}>{loading?'조회 중…':'새로고침'}</button></div><p className="note">각 GA4 속성의 시간대 기준, {startDate} ~ {endDate} ({days}일) · 오늘 포함 시 집계 중 · 앱 간 사용자 중복 제거 없음</p>
 {!targets.length?<p className="note">GA4 속성이 연결된 앱이 없습니다. 데이터 연결에서 앱을 추가해 주세요.</p>:<>
 <div className="livegrid" aria-live="polite">{targets.map(a=>{const result=results[a.id];return <article key={a.id} className="livecard"><h3>{a.name}</h3>{!result?<p>연결 상태를 확인하고 있습니다.</p>:result.status==='error'?<p role="status">{result.message}</p>:<><dl>{[['기간 활성 사용자',result.data.activeUsers],['일평균 DAU',result.data.averageDau],['세션',result.data.sessions],['이벤트',result.data.events]].map(([name,value])=><div key={name}><dt>{name}</dt><dd>{Number(value).toLocaleString()}</dd></div>)}</dl><small>시간대 {result.data.timeZone} · 조회 {new Date(result.data.fetchedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} KST</small>{result.data.limited&&<p>임계값 또는 샘플링 등이 적용된 보고서입니다.</p>}</>}</article>})}
 </div>
 {!!chartSeries.length&&!loading&&<div className="panel" style={{marginTop:20}}><div className="sectiontitle"><h2>일별 활성 사용자</h2><span>GA4</span></div><TrendChart series={chartSeries}/></div>}
 </>}
 <p className="note">조회에 실패하면 오류를 표시합니다.</p></section>;
}
