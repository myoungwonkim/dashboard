import {useEffect,useState} from 'react';
import type {AppRecord} from '@/lib/apps';
import TrendChart from './trend-chart';
type PlayData={packageName:string;installs:number|null;uninstalls?:number|null;reviews:{id:string;author:string;rating:number;text:string;at:string|null}[];vitals:{crashRate:number;anrRate:number;crashFreeRate:number}|null;ratings?:{average:number;count:number}|null;daily?:{date:string;installs:number}[];note?:string;fetchedAt:string};
type AscData={appleAppId:string;name:string;bundleId:string;downloads:number|null;reviews?:{id:string;rating:number;title:string;text:string;author:string;at:string|null}[];daily?:{date:string;downloads:number}[];note?:string;fetchedAt:string};
type Result<T>={status:'success';data:T}|{status:'error';message:string;code?:string};
export default function StoreLive({apps,app,days}:{apps:AppRecord[];app?:string;days:number}){
 const [play,setPlay]=useState<Record<string,Result<PlayData>>>({});
 const [asc,setAsc]=useState<Record<string,Result<AscData>>>({});
 const [loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 const playTargets=apps.filter(a=>a.androidPkg&&(!app||a.id===app));
 const ascTargets=apps.filter(a=>a.appleAppId&&(!app||a.id===app));
 useEffect(()=>{
  const c=new AbortController();let active=true;setLoading(true);setPlay({});setAsc({});
  const tasks:Promise<void>[]=[];
  for(const a of playTargets)tasks.push((async()=>{let result:Result<PlayData>;try{const r=await fetch('/api/play',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days}),signal:c.signal});result=await r.json() as Result<PlayData>;}catch{result={status:'error',message:'Play 서버에 연결하지 못했습니다.'};}if(active)setPlay(p=>({...p,[a.id]:result}));})());
  for(const a of ascTargets)tasks.push((async()=>{let result:Result<AscData>;try{const r=await fetch('/api/asc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days}),signal:c.signal});result=await r.json() as Result<AscData>;}catch{result={status:'error',message:'ASC 서버에 연결하지 못했습니다.'};}if(active)setAsc(p=>({...p,[a.id]:result}));})());
  if(!tasks.length){setLoading(false);return ()=>{active=false;c.abort();};}
  Promise.all(tasks).finally(()=>{if(active)setLoading(false);});
  return ()=>{active=false;c.abort();};
 },[app,days,retry,playTargets.map(t=>t.id).join(','),ascTargets.map(t=>t.id).join(',')]);
 const playCharts=playTargets.flatMap(a=>{const r=play[a.id];if(!r||r.status!=='success'||!r.data.daily?.length)return [];return [{name:a.name+' 설치',color:'#444',points:r.data.daily.map(d=>({date:d.date,value:d.installs}))}];});
 const ascCharts=ascTargets.flatMap(a=>{const r=asc[a.id];if(!r||r.status!=='success'||!r.data.daily?.length)return [];return [{name:a.name+' 다운로드',color:'#888',dashed:true,points:r.data.daily.map(d=>({date:d.date,value:d.downloads}))}];});
 return <section className="ga4live">
  <div className="sectiontitle"><h2>스토어 · 유입 본선</h2><button className="refresh" disabled={loading} onClick={()=>setRetry(x=>x+1)}>{loading?'조회 중…':'새로고침'}</button></div>
  <p className="note">Play 설치·ASC 다운로드가 유입 1순위입니다. 미연결 시 가짜 숫자 없이 연결 안내만 표시합니다. AppsFlyer 무료(Zero)는 API 없음.</p>
  <div className="livegrid" aria-live="polite">
   {playTargets.map(a=>{const r=play[a.id];return <article className="livecard" key={'play-'+a.id}><h3>{a.name} · Play</h3>{!r?<p>조회 중…</p>:r.status==='error'?<><p>{r.message}</p><a href="/connections">Play 연결 →</a></>:<><dl>
    <div><dt>패키지</dt><dd>{r.data.packageName}</dd></div>
    <div><dt>설치 (기간)</dt><dd>{r.data.installs==null?'배치 대기':r.data.installs.toLocaleString()}</dd></div>
    <div><dt>삭제</dt><dd>{r.data.uninstalls==null?'—':r.data.uninstalls.toLocaleString()}</dd></div>
    <div><dt>평점</dt><dd>{r.data.ratings?`${r.data.ratings.average.toFixed(2)} (${r.data.ratings.count.toLocaleString()})`:'—'}</dd></div>
    <div><dt>최근 리뷰</dt><dd>{r.data.reviews.length.toLocaleString()}</dd></div>
    <div><dt>Crash-free</dt><dd>{r.data.vitals?((r.data.vitals.crashFreeRate)*100).toFixed(2)+'%':'—'}</dd></div>
   </dl>{r.data.note&&<p className="note">{r.data.note}</p>}<small>조회 {new Date(r.data.fetchedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} KST</small>
   {!!r.data.reviews.length&&<div className="tablewrap" style={{marginTop:12}}><table><thead><tr><th>별</th><th>리뷰</th></tr></thead><tbody>{r.data.reviews.slice(0,5).map(v=><tr key={v.id}><td>{v.rating}</td><td style={{whiteSpace:'normal',textAlign:'left'}}>{v.text||v.author}</td></tr>)}</tbody></table></div>}
   </>}</article>;})}
   {ascTargets.map(a=>{const r=asc[a.id];return <article className="livecard" key={'asc-'+a.id}><h3>{a.name} · App Store</h3>{!r?<p>조회 중…</p>:r.status==='error'?<><p>{r.message}</p><a href="/connections">ASC 연결 →</a></>:<><dl>
    <div><dt>Apple ID</dt><dd>{r.data.appleAppId}</dd></div>
    <div><dt>번들</dt><dd>{r.data.bundleId||'—'}</dd></div>
    <div><dt>다운로드</dt><dd>{r.data.downloads==null?'배치 대기':r.data.downloads.toLocaleString()}</dd></div>
    <div><dt>최근 리뷰</dt><dd>{(r.data.reviews?.length||0).toLocaleString()}</dd></div>
   </dl>{r.data.note&&<p className="note">{r.data.note}</p>}<small>조회 {new Date(r.data.fetchedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} KST</small>
   {!!r.data.reviews?.length&&<div className="tablewrap" style={{marginTop:12}}><table><thead><tr><th>별</th><th>리뷰</th></tr></thead><tbody>{r.data.reviews.slice(0,5).map(v=><tr key={v.id}><td>{v.rating}</td><td style={{whiteSpace:'normal',textAlign:'left'}}>{v.title||v.text||v.author}</td></tr>)}</tbody></table></div>}
   </>}</article>;})}
   {!playTargets.length&&!ascTargets.length&&<p className="note">스토어 ID(패키지·Apple App ID)가 등록된 앱이 없습니다.</p>}
  </div>
  {!!([...playCharts,...ascCharts].length)&&!loading&&<div className="panel" style={{marginTop:20}}><div className="sectiontitle"><h2>일별 스토어 유입</h2><span>배치 데이터</span></div><TrendChart series={[...playCharts,...ascCharts]}/></div>}
 </section>;
}
