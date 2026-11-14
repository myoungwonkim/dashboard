import {useEffect,useState} from 'react';
import {seal} from '@/lib/admob-crypto.mjs';
import type {AppRecord} from '@/lib/apps';

type Account={id:string;platform:string;label:string;appId:string;externalId:string;createdAt:string;verifiedAt:string|null;lastSyncAt:string|null;lastError:string|null};
type Setup={accounts:Account[];publicKey:JsonWebKey;kid:string};

export default function MarketingSetup({apps}:{apps:AppRecord[]}){
 const [setup,setSetup]=useState<Setup|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('마케팅 연결 확인 중…');
 const [platform,setPlatform]=useState<'google_ads'|'meta'>('google_ads');
 const [appId,setAppId]=useState(apps[0]?.id||'');
 const [label,setLabel]=useState('');
 // Google
 const [clientId,setClientId]=useState('');
 const [clientSecret,setClientSecret]=useState('');
 const [refreshToken,setRefreshToken]=useState('');
 const [developerToken,setDeveloperToken]=useState('');
 const [customerId,setCustomerId]=useState('');
 const [loginCustomerId,setLoginCustomerId]=useState('');
 // Meta
 const [accessToken,setAccessToken]=useState('');
 const [adAccountId,setAdAccountId]=useState('');
 // Manual
 const [manualApp,setManualApp]=useState(apps[0]?.id||'');
 const [manualDate,setManualDate]=useState(()=>new Date().toISOString().slice(0,10));
 const [manualSource,setManualSource]=useState('manual');
 const [manualSpend,setManualSpend]=useState('');
 const [manualNote,setManualNote]=useState('');
 const [csv,setCsv]=useState('');
 const [syncStart,setSyncStart]=useState(()=>{const d=new Date();d.setUTCDate(d.getUTCDate()-7);return d.toISOString().slice(0,10);});
 const [syncEnd,setSyncEnd]=useState(()=>new Date().toISOString().slice(0,10));

 useEffect(()=>{if(!appId&&apps[0])setAppId(apps[0].id);if(!manualApp&&apps[0])setManualApp(apps[0].id);},[apps,appId,manualApp]);

 async function refresh(){
  try{
   const r=await fetch('/api/marketing/setup',{cache:'no-store'});
   const v=await r.json() as Setup & {message?:string};
   if(!r.ok)throw Error(v.message);
   setSetup(v);
   setMessage(v.accounts.length?`연결된 광고 계정 ${v.accounts.length}개`:'Google Ads / Meta 계정을 등록하거나 일별 비용을 수동 업로드하세요.');
  }catch(e){setMessage(e instanceof Error?e.message:'상태를 불러오지 못했습니다.');}
 }
 useEffect(()=>{void refresh();},[]);

 async function saveAccount(){
  if(!setup||busy||!appId)return;setBusy(true);
  try{
   const creds=platform==='google_ads'
    ?{client_id:clientId,client_secret:clientSecret,refresh_token:refreshToken,developer_token:developerToken,customer_id:customerId,login_customer_id:loginCustomerId||undefined}
    :{access_token:accessToken,ad_account_id:adAccountId};
   const envelope=await seal(creds,setup.publicKey,setup.kid,'marketing');
   const r=await fetch('/api/marketing/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...envelope,platform,appId,label:label||undefined})});
   const v=await r.json() as {message?:string};
   if(!r.ok)throw Error(v.message||'저장 실패');
   setMessage(v.message||'저장했습니다.');
   setClientSecret('');setRefreshToken('');setAccessToken('');
   await refresh();
  }catch(e){setMessage(e instanceof Error?e.message:'계정 저장에 실패했습니다.');}
  finally{setBusy(false);}
 }

 async function removeAccount(id:string){
  if(busy||!confirm('이 광고 계정을 삭제할까요? (이미 가져온 일별 비용은 유지됩니다)'))return;
  setBusy(true);
  try{
   const r=await fetch('/api/marketing/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',id})});
   const v=await r.json() as {message?:string};if(!r.ok)throw Error(v.message);
   setMessage(v.message||'삭제했습니다.');await refresh();
  }catch(e){setMessage(e instanceof Error?e.message:'삭제 실패');}
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

 async function uploadManual(){
  if(busy)return;setBusy(true);
  try{
   const spend=Number(manualSpend);
   if(!(spend>=0)||!manualApp||!manualDate)throw Error('앱·날짜·금액을 확인하세요.');
   const r=await fetch('/api/marketing/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({row:{date:manualDate,appId:manualApp,source:manualSource,spend,currency:'USD',note:manualNote||null}})});
   const v=await r.json() as {message?:string};if(!r.ok)throw Error(v.message);
   setMessage(v.message||'저장했습니다.');setManualSpend('');setManualNote('');
  }catch(e){setMessage(e instanceof Error?e.message:'수동 저장 실패');}
  finally{setBusy(false);}
 }

 async function uploadCsv(){
  if(busy||!csv.trim())return;setBusy(true);
  try{
   const r=await fetch('/api/marketing/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csv})});
   const v=await r.json() as {message?:string;errors?:string[]};if(!r.ok)throw Error(v.message||v.errors?.[0]||'업로드 실패');
   setMessage(v.message||'CSV 저장 완료');if(!v.errors?.length)setCsv('');
  }catch(e){setMessage(e instanceof Error?e.message:'CSV 업로드 실패');}
  finally{setBusy(false);}
 }

 const appName=(id:string)=>apps.find(a=>a.id===id)?.name||id;

 return <section className="safenote ga4setup" id="marketing">
  <div className="sectiontitle"><h2>마케팅 비용</h2><span className="status">{setup?.accounts.length?`${setup.accounts.length}계정`:'미연결'}</span></div>
  <p role="status" aria-live="polite">{message}</p>
  <p className="note">Google Ads·Meta는 계정별 일별 비용을 자동 동기화합니다. Apple Search Ads 등 그 외 채널은 CSV/수동 입력으로 올리면 됩니다.</p>

  {!!setup?.accounts.length&&<>
   <div className="sectiontitle" style={{marginTop:20}}><h2>등록된 광고 계정</h2></div>
   <div className="appslist">{setup.accounts.map(a=><div className="approw" key={a.id}>
    <div className="meta"><strong>{a.label}</strong><span>{a.platform==='google_ads'?'Google Ads':'Meta'} · {a.externalId} · {appName(a.appId)}{a.lastSyncAt?` · 동기화 ${new Date(a.lastSyncAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}`:''}{a.lastError?` · 오류: ${a.lastError}`:''}</span></div>
    <button type="button" className="refresh" disabled={busy} onClick={()=>void removeAccount(a.id)}>삭제</button>
   </div>)}</div>
   <div className="setupactions">
    <label className="filelabel">동기화 시작<input type="date" value={syncStart} onChange={e=>setSyncStart(e.target.value)}/></label>
    <label className="filelabel">동기화 종료<input type="date" value={syncEnd} onChange={e=>setSyncEnd(e.target.value)}/></label>
    <button type="button" className="setupbutton" disabled={busy} onClick={()=>void syncAll()}>{busy?'동기화 중…':'비용 동기화'}</button>
   </div>
  </>}

  <div className="sectiontitle" style={{marginTop:28}}><h2>광고 계정 추가</h2></div>
  <div className="form">
   <label>플랫폼
    <select value={platform} onChange={e=>setPlatform(e.target.value as 'google_ads'|'meta')}>
     <option value="google_ads">Google Ads</option>
     <option value="meta">Meta (Facebook) Ads</option>
    </select>
   </label>
   <label>귀속 앱
    <select value={appId} onChange={e=>setAppId(e.target.value)}>
     {!apps.length&&<option value="">앱 없음</option>}
     {apps.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
    </select>
   </label>
   <label>표시 이름<input value={label} onChange={e=>setLabel(e.target.value)} placeholder="예: Bazi UA"/></label>
   {platform==='google_ads'?<>
    <label>OAuth client_id<input value={clientId} onChange={e=>setClientId(e.target.value)} autoComplete="off"/></label>
    <label>OAuth client_secret<input value={clientSecret} onChange={e=>setClientSecret(e.target.value)} type="password" autoComplete="off"/></label>
    <label>refresh_token<input value={refreshToken} onChange={e=>setRefreshToken(e.target.value)} type="password" autoComplete="off"/></label>
    <label>developer_token<input value={developerToken} onChange={e=>setDeveloperToken(e.target.value)} type="password" autoComplete="off"/></label>
    <label>customer_id<input value={customerId} onChange={e=>setCustomerId(e.target.value)} placeholder="123-456-7890"/></label>
    <label>login_customer_id (MCC, 선택)<input value={loginCustomerId} onChange={e=>setLoginCustomerId(e.target.value)} placeholder="선택"/></label>
   </>:<>
    <label>access_token<input value={accessToken} onChange={e=>setAccessToken(e.target.value)} type="password" autoComplete="off"/></label>
    <label>ad_account_id<input value={adAccountId} onChange={e=>setAdAccountId(e.target.value)} placeholder="act_123…"/></label>
   </>}
   <button type="button" className="setupbutton" disabled={busy||!setup||!appId} onClick={()=>void saveAccount()}>{busy?'저장 중…':'암호화하여 등록'}</button>
  </div>
  <p className="note">자격 증명은 브라우저에서 암호화된 뒤 서버에 보관됩니다. Google Ads는 API 접근이 가능한 개발자 토큰과 ads.readonly 범위의 refresh token이 필요합니다.</p>

  <div className="sectiontitle" style={{marginTop:28}}><h2>일별 비용 수동 입력</h2></div>
  <div className="form">
   <label>앱<select value={manualApp} onChange={e=>setManualApp(e.target.value)}>{apps.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
   <label>날짜<input type="date" value={manualDate} onChange={e=>setManualDate(e.target.value)}/></label>
   <label>채널<select value={manualSource} onChange={e=>setManualSource(e.target.value)}><option value="manual">manual</option><option value="google_ads">google_ads</option><option value="meta">meta</option><option value="other">other</option></select></label>
   <label>비용 (USD)<input inputMode="decimal" value={manualSpend} onChange={e=>setManualSpend(e.target.value)} placeholder="12.50"/></label>
   <label>메모<input value={manualNote} onChange={e=>setManualNote(e.target.value)} placeholder="선택"/></label>
   <button type="button" className="setupbutton" disabled={busy} onClick={()=>void uploadManual()}>하루 비용 저장</button>
  </div>

  <div className="sectiontitle" style={{marginTop:28}}><h2>CSV 업로드</h2></div>
  <p className="note">헤더: <code>date,app_id,source,spend,currency,note</code> · source = google_ads | meta | manual | other</p>
  <textarea className="marketing-csv" value={csv} onChange={e=>setCsv(e.target.value)} rows={6} placeholder={"date,app_id,source,spend,currency,note\n2024-01-01,bazi,manual,15.00,USD,UA"}/>
  <div className="setupactions"><button type="button" className="setupbutton" disabled={busy||!csv.trim()} onClick={()=>void uploadCsv()}>CSV 저장</button><button type="button" className="refresh" disabled={busy} onClick={()=>void refresh()}>상태 새로고침</button></div>
 </section>;
}
