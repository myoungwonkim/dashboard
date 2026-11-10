import {useState,type ChangeEvent} from 'react';
import type {AppRecord} from '@/lib/apps';
type Draft={id:string;name:string;symbol:string;ga4PropertyId:string;firebaseProjectId:string;androidPkg:string;appleAppId:string;admobAndroidAppId:string;admobIosAppId:string;afAndroidId:string;afIosId:string};
const blank=():Draft=>({id:'',name:'',symbol:'',ga4PropertyId:'',firebaseProjectId:'',androidPkg:'',appleAppId:'',admobAndroidAppId:'',admobIosAppId:'',afAndroidId:'',afIosId:''});
export default function AppForm({onSaved,onCancel}:{onSaved:(app:AppRecord)=>void;onCancel:()=>void}){
 const [step,setStep]=useState(0),[draft,setDraft]=useState(blank),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const set=(key:keyof Draft)=>(e:ChangeEvent<HTMLInputElement>)=>setDraft(d=>({...d,[key]:e.target.value}));
 const steps=['기본 정보','GA4','AdMob','스토어','AppsFlyer','완료'];
 async function save(){
  setBusy(true);setError('');
  try{
   const res=await fetch('/api/apps',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    id:draft.id.trim(),name:draft.name.trim(),symbol:draft.symbol.trim(),
    ga4PropertyId:draft.ga4PropertyId,firebaseProjectId:draft.firebaseProjectId,androidPkg:draft.androidPkg,
    appleAppId:draft.appleAppId,admobAndroidAppId:draft.admobAndroidAppId,admobIosAppId:draft.admobIosAppId,
    afAndroidId:draft.afAndroidId,afIosId:draft.afIosId,
   })});
   const body=await res.json() as {status?:string;app?:AppRecord;message?:string};
   if(!res.ok||!body.app)throw Error(body.message||'저장에 실패했습니다.');
   onSaved(body.app);
  }catch(e){setError(e instanceof Error?e.message:'저장에 실패했습니다.');}
  finally{setBusy(false);}
 }
 return <div className="wizard">
  <div className="steps">{steps.map((label,i)=><div key={label} className={'step'+(i===step?' on':'')}>{i+1}. {label}</div>)}</div>
  <div className="form">
   <p className="note">필수만 채우고 저장해도 Overview에 바로 나타납니다. AppsFlyer 무료(Zero)는 API 조회 없이 ID만 보관합니다.</p>
   {step===0&&<>
    <label>표시명<input value={draft.name} onChange={set('name')} placeholder="읽어주는 만세력"/></label>
    <label>slug<input value={draft.id} onChange={set('id')} placeholder="bazi"/></label>
    <label>심볼(선택)<input value={draft.symbol} onChange={set('symbol')} placeholder="命"/></label>
   </>}
   {step===1&&<>
    <label>GA4 속성 ID<input value={draft.ga4PropertyId} onChange={set('ga4PropertyId')} placeholder="550050295"/></label>
    <label>Firebase 프로젝트 ID(선택)<input value={draft.firebaseProjectId} onChange={set('firebaseProjectId')}/></label>
   </>}
   {step===2&&<>
    <label>AdMob Android 앱 ID<input value={draft.admobAndroidAppId} onChange={set('admobAndroidAppId')} placeholder="ca-app-pub-…~…"/></label>
    <label>AdMob iOS 앱 ID<input value={draft.admobIosAppId} onChange={set('admobIosAppId')}/></label>
   </>}
   {step===3&&<>
    <label>Android 패키지<input value={draft.androidPkg} onChange={set('androidPkg')} placeholder="com.nolsoopgames.app"/></label>
    <label>App Store Apple ID(선택)<input value={draft.appleAppId} onChange={set('appleAppId')}/></label>
   </>}
   {step===4&&<>
    <label>AppsFlyer Android ID(예비)<input value={draft.afAndroidId} onChange={set('afAndroidId')}/></label>
    <label>AppsFlyer iOS ID(예비)<input value={draft.afIosId} onChange={set('afIosId')}/></label>
    <p className="note">무료 요금제에서는 Pull API가 없어 대시보드에 설치·캠페인 수치를 자동 수집하지 않습니다.</p>
   </>}
   {step===5&&<div className="livecard"><h3>저장 요약</h3><dl>
    <div><dt>이름</dt><dd>{draft.name||'—'}</dd></div>
    <div><dt>slug</dt><dd>{draft.id||'—'}</dd></div>
    <div><dt>GA4</dt><dd>{draft.ga4PropertyId||'미입력'}</dd></div>
    <div><dt>AdMob</dt><dd>{draft.admobAndroidAppId||draft.admobIosAppId?'등록':'미입력'}</dd></div>
   </dl></div>}
   {error&&<p role="status" className="formerror">{error}</p>}
   <div className="setupactions">
    {step>0&&<button type="button" className="refresh" disabled={busy} onClick={()=>setStep(s=>s-1)}>이전</button>}
    {step<5&&<button type="button" className="setupbutton" disabled={busy||(step===0&&(!draft.id.trim()||!draft.name.trim()))} onClick={()=>setStep(s=>s+1)}>다음</button>}
    {step===5&&<button type="button" className="setupbutton" disabled={busy} onClick={save}>{busy?'저장 중…':'검증 후 저장'}</button>}
    <button type="button" className="refresh" disabled={busy} onClick={onCancel}>취소</button>
   </div>
  </div>
 </div>;
}
