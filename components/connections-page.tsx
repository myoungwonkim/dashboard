import {useEffect,useState} from 'react';
import Link from '@/client/navigation';
import {appBadges,type AppRecord} from '@/lib/apps';
import {appColor} from '@/lib/app-colors';
import {admobPublisherId} from '@/lib/admob-config';
import AppIcon from './app-icon';
import AppForm from './app-form';
import GA4Setup from './ga4-setup';
import AdmobSetup from './admob-setup';
import PlaySetup from './play-setup';
import AscSetup from './asc-setup';
import StoreBatchPanel from './store-batch-panel';
import MarketingSetup from './marketing-setup';

type Tab='apps'|'ga4'|'admob'|'play'|'asc'|'marketing'|'batch';
const TABS: {id:Tab;label:string;hint:string}[]=[
 {id:'apps',label:'앱',hint:'레지스트리'},
 {id:'ga4',label:'GA4',hint:'사용자·리텐션'},
 {id:'admob',label:'AdMob',hint:'광고 수익'},
 {id:'play',label:'Play',hint:'설치·GCS'},
 {id:'asc',label:'App Store',hint:'ASC API'},
 {id:'marketing',label:'마케팅',hint:'광고 비용'},
 {id:'batch',label:'배치',hint:'스토어 적재'},
];
const HASH_TAB:Record<string,Tab>={apps:'apps',ga4:'ga4',admob:'admob',play:'play',asc:'asc',marketing:'marketing',checklist:'apps',batch:'batch'};

export default function ConnectionsPage({
 apps,appsLoaded,appsError,onRetryApps,onAppsChange,checklist,showForm,setShowForm,editing,setEditing,onSavedNew,
}:{
 apps:AppRecord[];
 appsLoaded:boolean;
 appsError:string;
 onRetryApps:()=>void;
 onAppsChange:(apps:AppRecord[])=>void;
 checklist:{ok:boolean;label:string;href:string;tab:Tab}[];
 showForm:boolean;
 setShowForm:(v:boolean)=>void;
 editing:AppRecord|null;
 setEditing:(a:AppRecord|null)=>void;
 onSavedNew:(app:AppRecord,isNew:boolean)=>void;
}){
 const [tab,setTab]=useState<Tab>(()=>{
  if(typeof window==='undefined')return 'apps';
  const hash=window.location.hash.replace(/^#/,'');
  return (hash&&HASH_TAB[hash])||'apps';
 });
 useEffect(()=>{
  const hash=window.location.hash.replace(/^#/,'');
  if(hash&&HASH_TAB[hash])return;
  const firstIncomplete=checklist.find(c=>!c.ok);
  if(firstIncomplete)setTab(firstIncomplete.tab);
 },[]);
 useEffect(()=>{
  const onHash=()=>{
   const hash=window.location.hash.replace(/^#/,'');
   if(hash&&HASH_TAB[hash])setTab(HASH_TAB[hash]);
  };
  window.addEventListener('hashchange',onHash);
  return ()=>window.removeEventListener('hashchange',onHash);
 },[]);
 function go(id:Tab){
  setTab(id);
  history.replaceState(null,'',`#${id}`);
 }

 return <div className="connpage">
  <aside className="connnav" aria-label="연결 항목">
   <p className="connnav-title">연결 항목</p>
   {TABS.map(t=>{
    const related=checklist.filter(c=>c.tab===t.id);
    const done=related.length?related.every(c=>c.ok):undefined;
    return <button type="button" key={t.id} className={'connnav-item'+(tab===t.id?' on':'')} onClick={()=>go(t.id)}>
     <span className="connnav-label">{t.label}</span>
     <span className="connnav-hint">{t.hint}</span>
     {done!=null&&<span className={'connnav-dot '+(done?'ok':'warn')} aria-hidden/>}
    </button>;
   })}
   <div className="connnav-check">
    <p>체크 {checklist.filter(c=>c.ok).length}/{checklist.length}</p>
    <ul>{checklist.map(c=><li key={c.label} className={c.ok?'ok':''}><button type="button" onClick={()=>go(c.tab)}>{c.ok?'✓':'○'} {c.label}</button></li>)}</ul>
   </div>
  </aside>

  <div className="connmain">
   {tab==='apps'&&<>
    <div className="sectiontitle"><h2>등록된 앱</h2><span>{apps.length} active</span></div>
    {appsError&&<div className="notice" role="status"><span className="dot"/>{appsError}<button type="button" className="refresh" onClick={onRetryApps}>다시 시도</button></div>}
    {!appsError&&!apps.length&&appsLoaded&&<div className="empty"><h2>등록된 앱이 없습니다</h2><p>앱을 추가하면 Overview에 바로 나타납니다.</p></div>}
    <div className="appslist">{apps.map(a=>{const b=appBadges(a);return <div className="approw" key={a.id}><AppIcon app={a}/><div className="meta"><strong><span className="appdot" style={{background:appColor(a.id)}} aria-hidden/><Link href={`/apps/${a.id}`}>{a.name}</Link></strong><span>{a.id}{a.androidPkg?` · ${a.androidPkg}`:''}{a.appleAppId?` · ASC ${a.appleAppId}`:''}</span></div><div className="badges"><span className={'pill '+(b.ga4?'ok':'warn')}>GA4</span><span className={'pill '+(b.admob?'ok':'warn')}>AdMob</span><span className={'pill '+(b.play?'ok':'warn')}>Play</span><span className={'pill '+(b.asc?'ok':'warn')}>ASC</span></div><button type="button" className="refresh" onClick={()=>{setShowForm(false);setEditing(a);go('apps');}}>수정</button></div>;})}</div>
    {(showForm||editing)&&<section className="ga4setup" id="apps"><div className="sectiontitle"><h2>{editing?'앱 수정':'앱 추가'}</h2></div><AppForm initial={editing||undefined} onCancel={()=>{setShowForm(false);setEditing(null);}} onSaved={app=>{const isNew=!editing;onAppsChange([...apps.filter(a=>a.id!==app.id),app].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)));setShowForm(false);setEditing(null);onSavedNew(app,isNew);}}/></section>}
    {!showForm&&!editing&&<button type="button" className="setupbutton" onClick={()=>{setEditing(null);setShowForm(true);}}>앱 추가</button>}
    <p className="note" style={{marginTop:16}}>각 필드 옆 <strong>?</strong> 아이콘에 마우스를 올리면 콘솔에서 값을 찾는 최신 경로가 표시됩니다.</p>
   </>}
   {tab==='ga4'&&<div id="ga4"><GA4Setup/></div>}
   {tab==='admob'&&<div id="admob"><AdmobSetup/><p className="note" style={{marginTop:16}}>게시자 ID: {admobPublisherId} · 앱별 ca-app-pub ID는 앱 탭에 저장</p></div>}
   {tab==='play'&&<div id="play"><PlaySetup/></div>}
   {tab==='asc'&&<div id="asc"><AscSetup/></div>}
   {tab==='marketing'&&<div id="marketing"><MarketingSetup apps={apps}/></div>}
   {tab==='batch'&&<div id="batch"><StoreBatchPanel/><p className="note">매일 UTC 21:00 자동 실행 · Play GCS CSV · ASC Sales → D1</p></div>}
  </div>
 </div>;
}
