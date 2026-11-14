import {useEffect,useState} from 'react';
import type {AppRecord} from '@/lib/apps';
import {appColor} from '@/lib/app-colors';
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
};
type Result={status:'success',data:Data}|{status:'error',message:string};
function fmtRate(v?:number|null){return v==null?'—':(v*100).toFixed(1)+'%';}
function fmtSec(v?:number){if(v==null)return '—';const s=Math.round(v);return s<60?`${s}초`:`${Math.floor(s/60)}분 ${s%60}초`;}
function fmtCohort(ymd:string){return /^\d{8}$/.test(ymd)?`${ymd.slice(4,6)}/${ymd.slice(6,8)}`:ymd;}
function heat(rate:number|null){
 if(rate==null)return undefined;
 const t=Math.max(0,Math.min(1,rate));
 return {background:`rgba(29,78,216,${0.08+t*0.55})`};
}
const SHOW_OFFSETS=[0,1,3,7,14,30];
export default function GA4Live({apps,app,days,startDate,endDate,country,os}:{apps:AppRecord[],app?:string,days:number,startDate:string,endDate:string,country:string,os:string}){
 const [results,setResults]=useState<Record<string,Result>>({}),[loading,setLoading]=useState(true);
 const targets=apps.filter(a=>a.ga4PropertyId&&(!app||a.id===app));
 useEffect(()=>{const controller=new AbortController();let active=true;setLoading(true);setResults({});
 if(!targets.length){setLoading(false);return ()=>{active=false;controller.abort();};}
 Promise.all(targets.map(async a=>{
 let result:Result;try{const res=await fetch('/api/ga4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:a.id,days,startDate,endDate,country,os}),signal:controller.signal});const body=await res.json() as Result;result=res.ok&&body.status==='success'?body:{status:'error',message:body.status==='error'?body.message:'조회에 실패했습니다.'};}catch{result={status:'error',message:'서버에 연결할 수 없습니다.'};}
 if(active)setResults(prev=>({...prev,[a.id]:result}));
 })).finally(()=>{if(active)setLoading(false);});return ()=>{active=false;controller.abort();};},[app,days,startDate,endDate,country,os,targets.map(t=>t.id).join(',')]);
 // Solid = active (app color); dashed = new users (same color).
 const chartSeries=targets.flatMap(a=>{const r=results[a.id];if(!r||r.status!=='success')return [];const color=appColor(a.id);return [{name:a.name+' 활성',color,points:r.data.daily.map(d=>({date:d.date,value:d.active}))}];});
 const newUserSeries=targets.flatMap(a=>{const r=results[a.id];if(!r||r.status!=='success')return [];const color=appColor(a.id);return [{name:a.name+' 신규',color,dashed:true,points:r.data.daily.map(d=>({date:d.date,value:d.newUsers??0}))}];});
 const detail=app?results[app]:undefined;
 const detailData=detail?.status==='success'?detail.data:null;
 return <section className="ga4live"><div className="sectiontitle"><h2>Firebase / GA4 실제 데이터</h2><span>{loading?'조회 중…':'GA4'}</span></div><p className="note">각 GA4 속성의 시간대 기준, {startDate} ~ {endDate} ({days}일) · 오늘 포함 시 집계 중 · 앱 간 사용자 중복 제거 없음 · 유입은 firstUser (AF 대체) · 색=앱, 점선=신규</p>
 {!targets.length?<p className="note">GA4 속성이 연결된 앱이 없습니다. 데이터 연결에서 앱을 추가해 주세요.</p>:<>
 <div className="livegrid" aria-live="polite">{targets.map(a=>{const result=results[a.id];return <article key={a.id} className="livecard"><h3><span className="appdot" style={{background:appColor(a.id)}} aria-hidden/>{a.name}</h3>{!result?<p>연결 상태를 확인하고 있습니다.</p>:result.status==='error'?<p role="status">{result.message}</p>:<><dl>{[
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
  ['평균 D1',fmtRate(result.data.retention?.summary.d1)],
  ['평균 D7',fmtRate(result.data.retention?.summary.d7)],
 ].map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl><small>시간대 {result.data.timeZone} · 조회 {new Date(result.data.fetchedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} KST{result.data.crashAffectedUsers!=null?` · 크래시 영향 ${result.data.crashAffectedUsers.toLocaleString()}명`:''}</small>{result.data.limited&&<p>임계값 또는 샘플링 등이 적용된 보고서입니다.</p>}</>}</article>})}
 </div>
 {!!chartSeries.length&&!loading&&<div className="panel" style={{marginTop:20}}><div className="sectiontitle"><h2>일별 활성 · 신규 사용자</h2><span>GA4</span></div><TrendChart series={[...chartSeries,...newUserSeries]}/></div>}
 {detailData&&!loading&&<>
 {detailData.retention&&!!detailData.retention.rows.length&&<div className="panel" style={{marginTop:20}}><div className="sectiontitle"><h2>일별 코호트 리텐션</h2><span>GA4 · D0–D{detailData.retention.summary.endOffset} · {detailData.retention.summary.cohorts}코호트</span></div>
  <p className="note">행=첫 세션일(코호트) · 열=경과일 · 값은 코호트 잔존율. 평균 D1 {fmtRate(detailData.retention.summary.d1)} · D7 {fmtRate(detailData.retention.summary.d7)} · D14 {fmtRate(detailData.retention.summary.d14)} · D30 {fmtRate(detailData.retention.summary.d30)}</p>
  <div className="tablewrap retentionwrap"><table className="retention"><thead><tr><th>코호트</th><th>유저</th>{SHOW_OFFSETS.filter(d=>d<=detailData.retention!.summary.endOffset).map(d=><th key={d}>D{d}</th>)}</tr></thead>
  <tbody>{detailData.retention.rows.map(r=><tr key={r.cohort}><td>{fmtCohort(r.cohort)}</td><td>{r.users?r.users.toLocaleString():'—'}</td>{SHOW_OFFSETS.filter(d=>d<=detailData.retention!.summary.endOffset).map(d=>{const v=r.rates[d]??null;return <td key={d} style={heat(v)}>{fmtRate(v)}</td>;})}</tr>)}</tbody></table></div>
 </div>}
 {!detailData.retention&&<p className="note">코호트 리텐션을 불러오지 못했습니다. 기간을 늘리거나 GA4 속성 권한을 확인하세요.</p>}
 {!!detailData.firstUser?.length&&<div className="panel" style={{marginTop:20}}><div className="sectiontitle"><h2>유입 (firstUserSource / Medium)</h2><span>AF 대체 · Top 10</span></div><div className="tablewrap"><table><thead><tr><th>소스</th><th>매체</th><th>신규</th></tr></thead><tbody>{detailData.firstUser.map(r=><tr key={r.source+'/'+r.medium}><td>{r.source}</td><td>{r.medium}</td><td>{r.newUsers.toLocaleString()}</td></tr>)}</tbody></table></div></div>}
 {!!detailData.countries?.length&&<div className="panel" style={{marginTop:20}}><div className="sectiontitle"><h2>국가</h2><span>활성 · 신규</span></div><div className="tablewrap"><table><thead><tr><th>국가</th><th>활성</th><th>신규</th></tr></thead><tbody>{detailData.countries.map(r=><tr key={r.country}><td>{r.country}</td><td>{r.activeUsers.toLocaleString()}</td><td>{r.newUsers.toLocaleString()}</td></tr>)}</tbody></table></div></div>}
 {!!detailData.versions?.length&&<div className="panel" style={{marginTop:20}}><div className="sectiontitle"><h2>앱 버전</h2><span>활성 사용자</span></div><div className="tablewrap"><table><thead><tr><th>버전</th><th>활성</th></tr></thead><tbody>{detailData.versions.map(r=><tr key={r.version}><td>{r.version}</td><td>{r.activeUsers.toLocaleString()}</td></tr>)}</tbody></table></div></div>}
 </>}
 </>}
 <p className="note">조회에 실패하면 오류를 표시합니다. Crash-free는 Crashlytics 연동 속성에만 표시됩니다. 리텐션은 firstSessionDate 코호트입니다.</p></section>;
}
