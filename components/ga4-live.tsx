import {useEffect,useState} from 'react';
import {apps} from '@/lib/apps';
type Data={app:string,activeUsers:number,averageDau:number,sessions:number,events:number,timeZone:string,fetchedAt:string,limited:boolean};
type Result={status:'success',data:Data}|{status:'error',message:string};
export default function GA4Live({app,days,country,os}:{app?:string,days:number,country:string,os:string}){
 const [results,setResults]=useState<Record<string,Result>>({}),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 const targets=apps.filter(a=>!app||a.id===app);
 useEffect(()=>{const controller=new AbortController();let active=true;setLoading(true);setResults({});
 Promise.all(apps.filter(a=>!app||a.id===app).map(async a=>{
 let result:Result;try{const res=await fetch('/api/ga4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days,country,os}),signal:controller.signal});const body=await res.json() as Result;result=res.ok&&body.status==='success'?body:{status:'error',message:body.status==='error'?body.message:'조회에 실패했습니다.'};}catch{result={status:'error',message:'서버에 연결할 수 없습니다.'};}
 if(active)setResults(prev=>({...prev,[a.id]:result}));
 })).finally(()=>{if(active)setLoading(false);});return ()=>{active=false;controller.abort();};},[app,days,country,os,retry]);
 return <section className="ga4live"><div className="sectiontitle"><h2>Firebase / GA4 실제 데이터</h2><button className="refresh" disabled={loading} onClick={()=>setRetry(v=>v+1)}>{loading?'조회 중…':'새로고침'}</button></div><p className="note">각 GA4 속성의 시간대 기준, 어제까지 최근 {days}일 · 앱 간 사용자 중복 제거 없음</p><div className="livegrid" aria-live="polite">{targets.map(a=>{const result=results[a.id];return <article key={a.id} className="livecard"><h3>{a.name}</h3>{!result?<p>연결 상태를 확인하고 있습니다.</p>:result.status==='error'?<p role="status">{result.message}</p>:<><dl>{[['기간 활성 사용자',result.data.activeUsers],['일평균 DAU',result.data.averageDau],['세션',result.data.sessions],['이벤트',result.data.events]].map(([name,value])=><div key={name}><dt>{name}</dt><dd>{Number(value).toLocaleString()}</dd></div>)}</dl><small>시간대 {result.data.timeZone} · 조회 {new Date(result.data.fetchedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} KST</small>{result.data.limited&&<p>임계값 또는 샘플링 등이 적용된 보고서입니다.</p>}</>}</article>})}</div><p className="note">조회에 실패하면 오류를 표시합니다.</p></section>;
}
