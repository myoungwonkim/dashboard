import {useEffect,useState} from 'react';
import {seal} from '@/lib/admob-crypto.mjs';
import type {AppRecord} from '@/lib/apps';
import {LabelText} from './field-help';
import {HELP} from '@/lib/connection-help';
import MetricTable from './metric-table';

type Account={id:string;platform:string;label:string;appId:string;externalId:string;lastSyncAt:string|null;lastError:string|null};
type Setup={accounts:Account[];publicKey:JsonWebKey;kid:string};
type DayRow={appId:string;source:string;date:string;spend:number;currency:string;note?:string|null};

const CHANNELS=[{id:'google_ads',label:'Google Ads'},{id:'meta',label:'Meta'},{id:'manual',label:'수동'},{id:'other',label:'기타'}] as const;
const SOURCE_LABEL:Record<string,string>={google_ads:'Google Ads',meta:'Meta',manual:'수동',other:'기타'};

function isoDaysAgo(n:number){const d=new Date();d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10);}
function todayIso(){return new Date().toISOString().slice(0,10);}

const CSV_TEMPLATE_HEADER='date,app_id,source,spend,currency,note';

export default function MarketingSetup({apps}:{apps:AppRecord[]}){
 const [setup,setSetup]=useState<Setup|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('마케팅 비용 확인 중…');
 // Manual (primary)
 const [appId,setAppId]=useState(apps[0]?.id||'');
 const [date,setDate]=useState(todayIso);
 const [channel,setChannel]=useState('google_ads');
 const [spend,setSpend]=useState('');
 const [csv,setCsv]=useState('');
 const [editingKey,setEditingKey]=useState<string|null>(null);
 // Saved rows
 const [listStart,setListStart]=useState(()=>isoDaysAgo(30));
 const [listEnd,setListEnd]=useState(todayIso);
 const [listApp,setListApp]=useState('');
 const [days,setDays]=useState<DayRow[]>([]);
 // Advanced API (collapsed)
 const [platform,setPlatform]=useState<'google_ads'|'meta'>('meta');
 const [apiApp,setApiApp]=useState(apps[0]?.id||'');
 const [accessToken,setAccessToken]=useState('');
 const [adAccountId,setAdAccountId]=useState('');
 const [clientId,setClientId]=useState('');
 const [clientSecret,setClientSecret]=useState('');
 const [refreshToken,setRefreshToken]=useState('');
 const [developerToken,setDeveloperToken]=useState('');
 const [customerId,setCustomerId]=useState('');
 const [syncStart,setSyncStart]=useState(()=>isoDaysAgo(7));
 const [syncEnd,setSyncEnd]=useState(todayIso);

 const appName=(id:string)=>apps.find(a=>a.id===id)?.name||id;

 useEffect(()=>{
  if(apps[0]){if(!appId)setAppId(apps[0].id);if(!apiApp)setApiApp(apps[0].id);}
 },[apps,appId,apiApp]);

 async function refreshSetup(){
  try{
   const r=await fetch('/api/marketing/setup',{cache:'no-store'});
   const v=await r.json() as Setup & {message?:string};
   if(!r.ok)throw Error(v.message);
   setSetup(v);
   setMessage(v.accounts.length?`API 계정 ${v.accounts.length}개 · 수동 입력도 가능`:'앱·날짜·비용만 넣으면 됩니다. CSV도 지원합니다.');
  }catch(e){setMessage(e instanceof Error?e.message:'상태를 불러오지 못했습니다.');}
 }

 async function refreshDays(){
  try{
   const r=await fetch('/api/marketing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:listApp||undefined,startDate:listStart,endDate:listEnd})});
   const v=await r.json() as {status?:string;message?:string;data?:{rows?:DayRow[]}};
   if(!r.ok||v.status!=='success')throw Error(v.message||'목록을 불러오지 못했습니다.');
   const rows=[...(v.data?.rows||[])].sort((a,b)=>b.date.localeCompare(a.date)||a.appId.localeCompare(b.appId)||a.source.localeCompare(b.source));
   setDays(rows);
  }catch(e){setMessage(e instanceof Error?e.message:'목록을 불러오지 못했습니다.');}
 }

 useEffect(()=>{void refreshSetup();},[]);
 useEffect(()=>{void refreshDays();},[listStart,listEnd,listApp]);

 async function saveDay(){
  if(busy)return;setBusy(true);
  try{
   const amount=Number(spend);
   if(!(amount>=0)||!appId||!date)throw Error('앱·날짜·금액을 확인하세요.');
   const r=await fetch('/api/marketing/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({row:{date,appId,source:channel,spend:amount,currency:'USD'}})});
   const v=await r.json() as {message?:string};if(!r.ok)throw Error(v.message);
   setMessage(editingKey?'수정했습니다.':(v.message||'저장했습니다.'));
   setSpend('');setEditingKey(null);
   await refreshDays();
  }catch(e){setMessage(e instanceof Error?e.message:'저장 실패');}
  finally{setBusy(false);}
 }

 async function saveCsv(){
  if(busy||!csv.trim())return;setBusy(true);
  try{
   const r=await fetch('/api/marketing/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csv})});
   const v=await r.json() as {message?:string;errors?:string[]};if(!r.ok)throw Error(v.message||v.errors?.[0]||'업로드 실패');
   setMessage(v.message||'CSV 저장 완료');if(!v.errors?.length)setCsv('');
   await refreshDays();
  }catch(e){setMessage(e instanceof Error?e.message:'CSV 업로드 실패');}
  finally{setBusy(false);}
 }

 async function saveApi(){
  if(!setup||busy||!apiApp)return;setBusy(true);
  try{
   const creds=platform==='meta'
    ?{access_token:accessToken,ad_account_id:adAccountId}
    :{client_id:clientId,client_secret:clientSecret,refresh_token:refreshToken,developer_token:developerToken,customer_id:customerId};
   const envelope=await seal(creds,setup.publicKey,setup.kid,'marketing');
   const r=await fetch('/api/marketing/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...envelope,platform,appId:apiApp,label:platform==='meta'?'Meta':'Google Ads'})});
   const v=await r.json() as {message?:string};if(!r.ok)throw Error(v.message||'저장 실패');
   setMessage(v.message||'API 계정을 저장했습니다.');
   setAccessToken('');setClientSecret('');setRefreshToken('');
   await refreshSetup();
  }catch(e){setMessage(e instanceof Error?e.message:'API 계정 저장 실패');}
  finally{setBusy(false);}
 }

 async function syncAll(){
  if(busy)return;setBusy(true);
  try{
   const r=await fetch('/api/marketing/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({startDate:syncStart,endDate:syncEnd})});
   const v=await r.json() as {message?:string};if(!r.ok)throw Error(v.message);
   setMessage(v.message||'동기화 완료');await refreshSetup();await refreshDays();
  }catch(e){setMessage(e instanceof Error?e.message:'동기화 실패');}
  finally{setBusy(false);}
 }

 async function removeAccount(id:string){
  if(busy||!confirm('API 계정을 삭제할까요? 저장된 일별 비용은 유지됩니다.'))return;
  setBusy(true);
  try{
   const r=await fetch('/api/marketing/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',id})});
   const v=await r.json() as {message?:string};if(!r.ok)throw Error(v.message);
   setMessage(v.message||'삭제했습니다.');await refreshSetup();
  }catch(e){setMessage(e instanceof Error?e.message:'삭제 실패');}
  finally{setBusy(false);}
 }

 function beginEdit(row:DayRow){
  setAppId(row.appId);
  setDate(row.date);
  setChannel(CHANNELS.some(c=>c.id===row.source)?row.source:'other');
  setSpend(String(row.spend));
  setEditingKey(`${row.appId}|${row.source}|${row.date}`);
  setMessage('위 입력칸에서 금액을 고친 뒤 저장하세요. 같은 앱·채널·날짜면 덮어씁니다.');
  document.getElementById('marketing-day-form')?.scrollIntoView({behavior:'smooth',block:'start'});
 }

 function cancelEdit(){
  setEditingKey(null);setSpend('');setMessage('수정을 취소했습니다.');
 }

 async function removeDay(row:DayRow){
  const label=`${row.date} · ${appName(row.appId)} · ${SOURCE_LABEL[row.source]||row.source} · $${row.spend.toFixed(2)}`;
  if(busy||!confirm(`이 비용을 삭제할까요?\n${label}`))return;
  setBusy(true);
  try{
   const r=await fetch('/api/marketing/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',key:{appId:row.appId,source:row.source,date:row.date}})});
   const v=await r.json() as {message?:string};if(!r.ok)throw Error(v.message);
   setMessage(v.message||'삭제했습니다.');
   if(editingKey===`${row.appId}|${row.source}|${row.date}`)cancelEdit();
   await refreshDays();
  }catch(e){setMessage(e instanceof Error?e.message:'삭제 실패');}
  finally{setBusy(false);}
 }

 function downloadCsvTemplate(){
  const sampleApp=apps[0]?.id||'bazi';
  const d1=isoDaysAgo(2),d2=isoDaysAgo(1);
  const body=[
   CSV_TEMPLATE_HEADER,
   `${d1},${sampleApp},google_ads,12.50,USD,예시`,
   `${d2},${sampleApp},meta,8.00,USD,`,
   `${todayIso()},${sampleApp},other,0,USD,`,
  ].join('\n');
  const blob=new Blob([body+'\n'],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='marketing-spend-template.csv';a.click();
  URL.revokeObjectURL(url);
 }

 return <section className="safenote ga4setup" id="marketing">
  <div className="sectiontitle"><h2>마케팅 비용</h2><span className="status">{editingKey?'수정 중':'간단 입력'}</span></div>
  <p role="status" aria-live="polite">{message||(setup?.accounts.length?`API 계정 ${setup.accounts.length}개 · 수동 입력도 가능`:'앱·날짜·비용만 넣으면 됩니다. CSV도 지원합니다.')}</p>

  <div className="form marketing-simple" id="marketing-day-form">
   <label>앱<select value={appId} onChange={e=>setAppId(e.target.value)}>{apps.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
   <label>날짜<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
   <label>채널<select value={channel} onChange={e=>setChannel(e.target.value)}>{CHANNELS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
   <label>비용 (USD)<input inputMode="decimal" value={spend} onChange={e=>setSpend(e.target.value)} placeholder="12.50"/></label>
   <div className="setupactions" style={{margin:0}}>
    <button type="button" className="setupbutton" disabled={busy||!apps.length} onClick={()=>void saveDay()}>{editingKey?'수정 저장':'저장'}</button>
    {editingKey&&<button type="button" className="refresh" disabled={busy} onClick={cancelEdit}>수정 취소</button>}
   </div>
  </div>

  <div className="marketing-days">
   <div className="sectiontitle"><h2>저장된 비용</h2><span>{days.length}건</span></div>
   <div className="setupactions marketing-days-filters">
    <label className="filelabel">시작<input type="date" value={listStart} onChange={e=>setListStart(e.target.value)}/></label>
    <label className="filelabel">종료<input type="date" value={listEnd} onChange={e=>setListEnd(e.target.value)}/></label>
    <label className="filelabel">앱
     <select value={listApp} onChange={e=>setListApp(e.target.value)}>
      <option value="">전체</option>
      {apps.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
     </select>
    </label>
    <button type="button" className="refresh" disabled={busy} onClick={()=>void refreshDays()}>새로고침</button>
   </div>
   {!days.length&&<p className="note">이 기간에 저장된 비용이 없습니다.</p>}
   {!!days.length&&<MetricTable
    rows={days}
    rowKey={row=>`${row.appId}|${row.source}|${row.date}`}
    tableClassName="dense marketing-days-table"
    defaultSort={{key:'date',dir:'desc'}}
    rowClassName={row=>editingKey===`${row.appId}|${row.source}|${row.date}`?'on':undefined}
    columns={[
     {key:'date',label:'날짜',get:r=>r.date,render:r=>r.date},
     {key:'app',label:'앱',className:'cell-text',get:r=>appName(r.appId),render:r=>appName(r.appId)},
     {key:'source',label:'채널',get:r=>SOURCE_LABEL[r.source]||r.source,render:r=>SOURCE_LABEL[r.source]||r.source},
     {key:'spend',label:'비용',get:r=>r.spend,render:r=>`$${r.spend.toFixed(2)}`},
     {key:'actions',label:'작업',className:'cell-text',sortable:false,get:()=>null,render:r=><div className="marketing-day-actions">
      <button type="button" className="refresh" disabled={busy} onClick={()=>beginEdit(r)}>수정</button>
      <button type="button" className="refresh" disabled={busy} onClick={()=>void removeDay(r)}>삭제</button>
     </div>},
    ]}
   />}
  </div>

  <details className="marketing-more">
   <summary>여러 날을 CSV로 한 번에 올리기</summary>
   <p className="note">한 줄에 하루 · source는 google_ads / meta / manual / other · 같은 앱·채널·날짜는 덮어씁니다.</p>
   <div className="setupactions">
    <button type="button" className="refresh" onClick={downloadCsvTemplate}>CSV 양식 다운로드</button>
   </div>
   <textarea className="marketing-csv" value={csv} onChange={e=>setCsv(e.target.value)} rows={5} placeholder={`${CSV_TEMPLATE_HEADER}\n2024-01-01,bazi,google_ads,15,USD,`}/>
   <div className="setupactions"><button type="button" className="setupbutton" disabled={busy||!csv.trim()} onClick={()=>void saveCsv()}>CSV 저장</button></div>
  </details>

  <details className="marketing-more">
   <summary>고급 · Meta / Google Ads 자동 가져오기 (선택)</summary>
   <p className="note">대부분은 위 수동 입력만으로 충분합니다. API는 토큰이 있을 때만 사용하세요. Meta가 설정이 더 단순합니다.</p>
   {!!setup?.accounts.length&&<div className="appslist" style={{marginTop:12}}>{setup.accounts.map(a=><div className="approw" key={a.id}>
    <div className="meta"><strong>{a.platform==='meta'?'Meta':'Google Ads'}</strong><span>{a.externalId} · {appName(a.appId)}{a.lastSyncAt?` · ${new Date(a.lastSyncAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}`:''}{a.lastError?` · ${a.lastError}`:''}</span></div>
    <button type="button" className="refresh" disabled={busy} onClick={()=>void removeAccount(a.id)}>삭제</button>
   </div>)}</div>}
   {!!setup?.accounts.length&&<div className="setupactions">
    <label className="filelabel">시작<input type="date" value={syncStart} onChange={e=>setSyncStart(e.target.value)}/></label>
    <label className="filelabel">종료<input type="date" value={syncEnd} onChange={e=>setSyncEnd(e.target.value)}/></label>
    <button type="button" className="setupbutton" disabled={busy} onClick={()=>void syncAll()}>기간 동기화</button>
   </div>}
   <div className="form" style={{marginTop:16}}>
    <label>플랫폼<select value={platform} onChange={e=>setPlatform(e.target.value as 'google_ads'|'meta')}><option value="meta">Meta</option><option value="google_ads">Google Ads</option></select></label>
    <label>귀속 앱<select value={apiApp} onChange={e=>setApiApp(e.target.value)}>{apps.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    {platform==='meta'?<>
     <label><LabelText help={HELP.metaAccessToken}>Access token</LabelText><input type="password" value={accessToken} onChange={e=>setAccessToken(e.target.value)} autoComplete="off"/></label>
     <label><LabelText help={HELP.metaAdAccountId}>Ad account ID</LabelText><input value={adAccountId} onChange={e=>setAdAccountId(e.target.value)} placeholder="act_…"/></label>
    </>:<>
     <label><LabelText help={HELP.googleAdsClientId}>client_id</LabelText><input value={clientId} onChange={e=>setClientId(e.target.value)} autoComplete="off"/></label>
     <label><LabelText help={HELP.googleAdsClientSecret}>client_secret</LabelText><input type="password" value={clientSecret} onChange={e=>setClientSecret(e.target.value)} autoComplete="off"/></label>
     <label><LabelText help={HELP.googleAdsRefreshToken}>refresh_token</LabelText><input type="password" value={refreshToken} onChange={e=>setRefreshToken(e.target.value)} autoComplete="off"/></label>
     <label><LabelText help={HELP.googleAdsDeveloperToken}>developer_token</LabelText><input type="password" value={developerToken} onChange={e=>setDeveloperToken(e.target.value)} autoComplete="off"/></label>
     <label><LabelText help={HELP.googleAdsCustomerId}>customer_id</LabelText><input value={customerId} onChange={e=>setCustomerId(e.target.value)} placeholder="123-456-7890"/></label>
    </>}
    <button type="button" className="setupbutton" disabled={busy||!setup||!apiApp} onClick={()=>void saveApi()}>API 계정 저장</button>
   </div>
  </details>
 </section>;
}
