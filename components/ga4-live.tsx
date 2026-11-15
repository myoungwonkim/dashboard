import {useEffect,useMemo,useState} from 'react';
import type {AppRecord} from '@/lib/apps';
import {appColor} from '@/lib/app-colors';
import {meanNums,sumNums,weightedMean} from '@/lib/metric-rollups.mts';
import {retentionTotals} from '@/lib/ga4-cohort.mts';
import TrendChart from './trend-chart';
type Daily={date:string,active:number,newUsers?:number,sessions?:number};
type Retention={summary:{d1:number|null;d7:number|null;d14:number|null;d30:number|null;cohorts:number;endOffset:number};rows:{cohort:string;users:number;rates:Record<number,number|null>}[];offsets:number[]};
type Data={
 app:string,activeUsers:number,averageDau:number,sessions:number,events:number,
 newUsers?:number,engagedSessions?:number,engagementRate?:number,averageSessionDuration?:number,sessionsPerUser?:number,
 crashAffectedUsers?:number|null,crashFreeUsersRate?:number|null,
 timeZone:string,fetchedAt:string,limited:boolean,daily:Daily[],
 firstUser?:{source:string,medium:string,newUsers:number}[],
 countries?:{country:string,activeUsers:number,newUsers:number}[],
 versions?:{version:string,activeUsers:number}[],
 retention?:Retention|null,
 retentionNote?:string|null,
};
type Result={status:'success',data:Data}|{status:'error',message:string};
function fmtRate(v?:number|null){return v==null?'—':(v*100).toFixed(1)+'%';}
function fmtSec(v?:number|null){if(v==null)return '—';const s=Math.round(v);return s<60?`${s}초`:`${Math.floor(s/60)}분 ${s%60}초`;}
function fmtCohort(ymd:string){return /^\d{8}$/.test(ymd)?`${ymd.slice(4,6)}/${ymd.slice(6,8)}`:ymd;}
function heat(rate:number|null){
 if(rate==null)return undefined;
 const t=Math.max(0,Math.min(1,rate));
 return {background:`rgba(29,78,216,${0.08+t*0.55})`};
}
const SHOW_OFFSETS=[0,1,3,7,14,30];
function AppMark({id,name}:{id:string;name:string}){
 return <span className="apptitle"><span className="appdot" style={{background:appColor(id)}} aria-hidden/>{name}</span>;
}
export default function GA4Live({apps,app,days,startDate,endDate,country,os,showCharts=true}:{apps:AppRecord[],app?:string,days:number,startDate:string,endDate:string,country:string,os:string,showCharts?:boolean}){
 const [results,setResults]=useState<Record<string,Result>>({}),[loading,setLoading]=useState(true);
 const targets=apps.filter(a=>a.ga4PropertyId&&(!app||a.id===app));
 useEffect(()=>{const controller=new AbortController();let active=true;setLoading(true);setResults({});
 if(!targets.length){setLoading(false);return ()=>{active=false;controller.abort();};}
 Promise.all(targets.map(async a=>{
 let result:Result;try{const res=await fetch('/api/ga4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days,startDate,endDate,country,os}),signal:controller.signal});const body=await res.json() as Result;result=res.ok&&body.status==='success'?body:{status:'error',message:body.status==='error'?body.message:'조회에 실패했습니다.'};}catch{result={status:'error',message:'서버에 연결할 수 없습니다.'};}
 if(active)setResults(prev=>({...prev,[a.id]:result}));
 })).finally(()=>{if(active)setLoading(false);});return ()=>{active=false;controller.abort();};},[app,days,startDate,endDate,country,os,targets.map(t=>t.id).join(',')]);
 const ok=useMemo(()=>targets.map(a=>{const r=results[a.id];return r?.status==='success'?{app:a,data:r.data}:null;}).filter(Boolean) as {app:AppRecord;data:Data}[],[targets,results]);
 const totals=useMemo(()=>{
  if(ok.length<2)return null;
  const activeUsers=sumNums(ok.map(o=>o.data.activeUsers))!;
  const sessions=sumNums(ok.map(o=>o.data.sessions))!;
  const newUsers=sumNums(ok.map(o=>o.data.newUsers??0))!;
  const events=sumNums(ok.map(o=>o.data.events))!;
  const engaged=sumNums(ok.map(o=>o.data.engagedSessions??0))!;
  const averageDau=sumNums(ok.map(o=>o.data.averageDau))!;
  return {
   activeUsers,sessions,newUsers,events,engagedSessions:engaged,averageDau,
   engagementRate:weightedMean(ok.map(o=>({value:o.data.engagementRate??null,weight:o.data.sessions}))),
   sessionsPerUser:activeUsers?sessions/activeUsers:null,
   averageSessionDuration:weightedMean(ok.map(o=>({value:o.data.averageSessionDuration??null,weight:o.data.sessions}))),
   crashFreeUsersRate:meanNums(ok.map(o=>o.data.crashFreeUsersRate)),
   d1:weightedMean(ok.map(o=>({value:o.data.retention?.summary.d1??null,weight:o.data.retention?.summary.cohorts||o.data.newUsers||1}))),
   d7:weightedMean(ok.map(o=>({value:o.data.retention?.summary.d7??null,weight:o.data.retention?.summary.cohorts||o.data.newUsers||1}))),
   n:ok.length,
  };
 },[ok]);
 const chartSeries=targets.flatMap(a=>{const r=results[a.id];if(!r||r.status!=='success')return [];const color=appColor(a.id);return [{name:a.name+' 활성',color,points:r.data.daily.map(d=>({date:d.date,value:d.active}))}];});
 const newUserSeries=targets.flatMap(a=>{const r=results[a.id];if(!r||r.status!=='success')return [];const color=appColor(a.id);return [{name:a.name+' 신규',color,dashed:true,points:r.data.daily.map(d=>({date:d.date,value:d.newUsers??0}))}];});
 const detail=app?results[app]:undefined;
 const detailData=detail?.status==='success'?detail.data:null;
 return <section className="ga4live"><div className="sectiontitle"><h2>Firebase / GA4 실제 데이터</h2><span>{loading?'조회 중…':'GA4'}</span></div><p className="note">각 GA4 속성의 시간대 기준, {startDate} ~ {endDate} ({days}일) · 앱 간 사용자 중복 제거 없음 · 합산=절대값 합 · 리텐션·참여율=가중 평균 · 색=앱, 점선=신규</p>
 {!targets.length?<p className="note">GA4 속성이 연결된 앱이 없습니다. 데이터 연결에서 앱을 추가해 주세요.</p>:<>
 <div className="livegrid" aria-live="polite">
  {totals&&!loading&&<article className="livecard aggregate"><h3>전체 합산 · 평균 <small>{totals.n}개 앱</small></h3><dl>{[
   ['기간 활성 합',totals.activeUsers.toLocaleString()],
   ['일평균 DAU 합',Math.round(totals.averageDau).toLocaleString()],
   ['신규 합',totals.newUsers.toLocaleString()],
   ['세션 합',totals.sessions.toLocaleString()],
   ['참여 세션 합',totals.engagedSessions.toLocaleString()],
   ['참여율(가중)',fmtRate(totals.engagementRate)],
   ['세션/사용자',totals.sessionsPerUser==null?'—':totals.sessionsPerUser.toFixed(2)],
   ['평균 세션(가중)',fmtSec(totals.averageSessionDuration)],
   ['이벤트 합',totals.events.toLocaleString()],
   ['Crash-free(평균)',fmtRate(totals.crashFreeUsersRate)],
   ['리텐션 D1(가중)',fmtRate(totals.d1)],
   ['리텐션 D7(가중)',fmtRate(totals.d7)],
  ].map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl><small>절대값은 합산, 비율·리텐션은 앱별 코호트/세션 가중 평균입니다.</small></article>}
  {targets.map(a=>{const result=results[a.id];return <article key={a.id} className="livecard"><h3><AppMark id={a.id} name={a.name}/></h3>{!result?<p>연결 상태를 확인하고 있습니다.</p>:result.status==='error'?<p role="status">{result.message}</p>:<><dl>{[
  ['기간 활성 사용자',result.data.activeUsers.toLocaleString()],
  ['일평균 DAU',result.data.averageDau.toLocaleString()],
  ['신규 사용자',(result.data.newUsers??0).toLocaleString()],
  ['세션',result.data.sessions.toLocaleString()],
  ['참여 세션',(result.data.engagedSessions??0).toLocaleString()],
  ['참여율',fmtRate(result.data.engagementRate)],
  ['세션/사용자',result.data.sessionsPerUser==null?'—':result.data.sessionsPerUser.toFixed(2)],
  ['평균 세션',fmtSec(result.data.averageSessionDuration)],
  ['이벤트',result.data.events.toLocaleString()],
  ['Crash-free',result.data.crashFreeUsersRate==null?'—':fmtRate(result.data.crashFreeUsersRate)],
  ['리텐션 D1',fmtRate(result.data.retention?.summary.d1)],
  ['리텐션 D7',fmtRate(result.data.retention?.summary.d7)],
 ].map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl><small>시간대 {result.data.timeZone} · 조회 {new Date(result.data.fetchedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} KST{result.data.crashAffectedUsers!=null?` · 크래시 영향 ${result.data.crashAffectedUsers.toLocaleString()}명`:''} · D1/D7=리텐션</small>{result.data.limited&&<p>임계값 또는 샘플링 등이 적용된 보고서입니다.</p>}</>}</article>;})}
 </div>
 {showCharts&&!!chartSeries.length&&!loading&&<div className="panel" style={{marginTop:20}}><div className="sectiontitle"><h2>일별 활성 · 신규 사용자</h2><span>GA4 · 앱별</span></div><TrendChart series={[...chartSeries,...newUserSeries]}/></div>}
 {!loading&&targets.map(a=>{
  const r=results[a.id];if(!r||r.status!=='success')return null;
  const ret=r.data.retention;
  if(ret&&ret.rows.length){
   const offs=SHOW_OFFSETS.filter(d=>d<=ret.summary.endOffset);
   const period=retentionTotals(ret.rows,offs);
   return <div className="panel" style={{marginTop:20}} key={a.id+'-ret'}><div className="sectiontitle"><h2><AppMark id={a.id} name={a.name}/> · 리텐션</h2><span>D0–D{ret.summary.endOffset} · {ret.summary.cohorts}코호트</span></div>
    <p className="note">행=그날에 처음 연 사용자 · 열 Dn=n일 뒤 활성 비율 · 상단 종합=코호트 규모 가중 평균. D1 {fmtRate(ret.summary.d1)} · D7 {fmtRate(ret.summary.d7)} · D14 {fmtRate(ret.summary.d14)} · D30 {fmtRate(ret.summary.d30)}{r.data.retentionNote?` · ${r.data.retentionNote}`:''}</p>
    <div className="tablewrap retentionwrap"><table className="retention dense"><thead><tr><th>첫 세션</th><th>규모</th>{offs.map(d=><th key={d} title={d===0?'당일':d===1?'다음날':`${d}일 후`}>D{d}</th>)}</tr></thead>
    <tbody>
     <tr className="retention-total"><td>기간 종합</td><td>{period.users?period.users.toLocaleString():'—'}</td>{offs.map(d=>{const v=period.rates[d]??null;return <td key={d} style={heat(v)}>{fmtRate(v)}</td>;})}</tr>
     {ret.rows.map(row=><tr key={row.cohort}><td>{fmtCohort(row.cohort)}</td><td>{row.users?row.users.toLocaleString():'—'}</td>{offs.map(d=>{const v=row.rates[d]??null;return <td key={d} style={heat(v)}>{fmtRate(v)}</td>;})}</tr>)}
    </tbody></table></div>
   </div>;
  }
  return <p className="note" key={a.id+'-ret-miss'}><AppMark id={a.id} name={a.name}/>: {r.data.retentionNote||'리텐션을 불러오지 못했습니다.'}</p>;
 })}
 {detailData&&!loading&&!!(detailData.firstUser?.length||detailData.countries?.length||detailData.versions?.length)&&<div className={'detail-grid'+(detailData.firstUser?.length&&detailData.countries?.length&&detailData.versions?.length?' cols-3':'')}>
 {!!detailData.firstUser?.length&&<div className="panel"><div className="sectiontitle"><h2>유입</h2><span>Top 10</span></div><div className="tablewrap"><table className="dense"><thead><tr><th>소스 / 매체</th><th>신규</th></tr></thead><tbody>{detailData.firstUser.map(r=><tr key={r.source+'/'+r.medium}><td className="cell-text">{r.source} / {r.medium}</td><td>{r.newUsers.toLocaleString()}</td></tr>)}</tbody></table></div></div>}
 {!!detailData.countries?.length&&<div className="panel"><div className="sectiontitle"><h2>국가</h2><span>활성 · 신규</span></div><div className="tablewrap"><table className="dense"><thead><tr><th>국가</th><th>활성</th><th>신규</th></tr></thead><tbody>{detailData.countries.map(r=><tr key={r.country}><td className="cell-text">{r.country}</td><td>{r.activeUsers.toLocaleString()}</td><td>{r.newUsers.toLocaleString()}</td></tr>)}</tbody></table></div></div>}
 {!!detailData.versions?.length&&<div className="panel"><div className="sectiontitle"><h2>앱 버전</h2><span>활성</span></div><div className="tablewrap"><table className="dense"><thead><tr><th>버전</th><th>활성</th></tr></thead><tbody>{detailData.versions.map(r=><tr key={r.version}><td className="cell-text">{r.version}</td><td>{r.activeUsers.toLocaleString()}</td></tr>)}</tbody></table></div></div>}
 </div>}
 </>}
 <p className="note">Dn 리텐션은 GA4 firstSessionDate 코호트(그날 첫 세션 유저) 기준입니다. Crash-free는 Crashlytics 연동 속성에만 표시됩니다.</p></section>;
}
