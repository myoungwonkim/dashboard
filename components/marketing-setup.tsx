import {useEffect,useState} from 'react';
import {seal} from '@/lib/admob-crypto.mjs';
import type {AppRecord} from '@/lib/apps';
import {LabelText} from './field-help';
import {HELP} from '@/lib/connection-help';

type Account={id:string;platform:string;label:string;appId:string;externalId:string;lastSyncAt:string|null;lastError:string|null};
type Setup={accounts:Account[];publicKey:JsonWebKey;kid:string};

const CHANNELS=[{id:'google_ads',label:'Google Ads'},{id:'meta',label:'Meta'},{id:'other',label:'기타'}] as const;

export default function MarketingSetup({apps}:{apps:AppRecord[]}){
 const [setup,setSetup]=useState<Setup|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('마케팅 비용 확인 중…');
 // Manual (primary)
 const [appId,setAppId]=useState(apps[0]?.id||'');
 const [date,setDate]=useState(()=>new Date().toISOString().slice(0,10));
 const [channel,setChannel]=useState('google_ads');
 const [spend,setSpend]=useState('');
 const [csv,setCsv]=useState('');
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
 const [syncStart,setSyncStart]=useState(()=>{const d=new Date();d.setUTCDate(d.getUTCDate()-7);return d.toISOString().slice(0,10);});
 const [syncEnd,setSyncEnd]=useState(()=>new Date().toISOString().slice(0,10));

 useEffect(()=>{
  if(apps[0]){if(!appId)setAppId(apps[0].id);if(!apiApp)setApiApp(apps[0].id);}
 },[apps,appId,apiApp]);

 async function refresh(){
  try{
   const r=await fetch('/api/marketing/setup',{cache:'no-store'});
   const v=await r.json() as Setup & {message?:string};
   if(!r.ok)throw Error(v.message);
   setSetup(v);
   setMessage(v.accounts.length?`API 계정 ${v.accounts.length}개 · 수동 입력도 가능`:'앱·날짜·비용만 넣으면 됩니다. CSV도 지원합니다.');
  }catch(e){setMessage(e instanceof Error?e.message:'상태를 불러오지 못했습니다.');}
 }
 useEffect(()=>{void refresh();},[]);

 async function saveDay(){
  if(busy)return;setBusy(true);
  try{
   const amount=Number(spend);
   if(!(amount>=0)||!appId||!date)throw Error('앱·날짜·금액을 확인하세요.');
   const r=await fetch('/api/marketing/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({row:{date,appId,source:channel,spend:amount,currency:'USD'}})});
   const v=await r.json() as {message?:string};if(!r.ok)throw Error(v.message);
   setMessage(v.message||'저장했습니다.');setSpend('');
  }catch(e){setMessage(e instanceof Error?e.message:'저장 실패');}
  finally{setBusy(false);}
 }

 async function saveCsv(){
  if(busy||!csv.trim())return;setBusy(true);
  try{
   const r=await fetch('/api/marketing/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csv})});
   const v=await r.json() as {message?:string;errors?:string[]};if(!r.ok)throw Error(v.message||v.errors?.[0]||'업로드 실패');
   setMessage(v.message||'CSV 저장 완료');if(!v.errors?.length)setCsv('');
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
   await refresh();
  }catch(e){setMessage(e instanceof Error?e.message:'API 계정 저장 실패');}
  finally{setBusy(false);}
 }

 async function syncAll(){
  if(busy)return;setBusy(true);
  try{
   const r=await fetch('/api/marketing/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({startDate:syncStart,endDate:syncEnd})});
   const v=await r.json() as {message?:string};if(!r.ok)throw Error(v.message);
   setMessage(v.message||'동기화 완료');await refresh();
  }catch(e){setMessage(e instanceof Error?e.message:'동기화 실패');}
  finally{setBusy(false);}
 }

 async function removeAccount(id:string){
  if(busy||!confirm('API 계정을 삭제할까요? 저장된 일별 비용은 유지됩니다.'))return;
  setBusy(true);
  try{
   const r=await fetch('/api/marketing/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',id})});
   const v=await r.json() as {message?:string};if(!r.ok)throw Error(v.message);
   setMessage(v.message||'삭제했습니다.');await refresh();
  }catch(e){setMessage(e instanceof Error?e.message:'삭제 실패');}
  finally{setBusy(false);}
 }

 const appName=(id:string)=>apps.find(a=>a.id===id)?.name||id;

 return <section className="safenote ga4setup" id="marketing">
  <div className="sectiontitle"><h2>마케팅 비용</h2><span className="status">간단 입력</span></div>
  <p role="status" aria-live="polite">{message}</p>

  <div className="form marketing-simple">
   <label>앱<select value={appId} onChange={e=>setAppId(e.target.value)}>{apps.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
   <label>날짜<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
   <label>채널<select value={channel} onChange={e=>setChannel(e.target.value)}>{CHANNELS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
   <label>비용 (USD)<input inputMode="decimal" value={spend} onChange={e=>setSpend(e.target.value)} placeholder="12.50"/></label>
   <button type="button" className="setupbutton" disabled={busy||!apps.length} onClick={()=>void saveDay()}>저장</button>
  </div>

  <details className="marketing-more">
   <summary>여러 날을 CSV로 한 번에 올리기</summary>
   <p className="note">한 줄에 하루 · 헤더 예: <code>date,app_id,source,spend</code> · source는 google_ads / meta / other</p>
   <textarea className="marketing-csv" value={csv} onChange={e=>setCsv(e.target.value)} rows={5} placeholder={'date,app_id,source,spend\n2024-01-01,bazi,google_ads,15'}/>
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
