'use client';
import {useEffect,useId,useRef,useState} from 'react';
import Link from '@/client/navigation';
import {useRouter} from '@/client/navigation';
import {ChevronDown} from 'lucide-react';
import type {AppRecord} from '@/lib/apps';
import {appColor} from '@/lib/app-colors';
import AppIcon from './app-icon';

function hrefFor(id:string){
 if(id==='overview')return '/';
 if(id==='progress')return '/progress';
 if(id==='connections')return '/connections';
 return `/apps/${id}`;
}

export default function PagePicker({page,apps,progressLabel}:{page:string;apps:AppRecord[];progressLabel:string}){
 const router=useRouter();
 const current=apps.find(a=>a.id===page);
 const value=page==='overview'||page==='progress'||page==='connections'?page:(current?page:'overview');
 const label=current?.name||({overview:'서비스 현황',progress:'진행상황',connections:'데이터 연결'} as Record<string,string>)[value]||value;
 const [open,setOpen]=useState(false);
 const root=useRef<HTMLDivElement>(null);
 const listId=useId();

 useEffect(()=>{
  if(!open)return;
  const onDoc=(e:MouseEvent)=>{if(root.current&&!root.current.contains(e.target as Node))setOpen(false);};
  const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);};
  document.addEventListener('mousedown',onDoc);
  document.addEventListener('keydown',onKey);
  return ()=>{document.removeEventListener('mousedown',onDoc);document.removeEventListener('keydown',onKey);};
 },[open]);

 const go=(id:string)=>{setOpen(false);router.push(hrefFor(id));};

 return <div className="pagepicker-wrap" ref={root}>
  <button type="button" className="pagepicker-trigger" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} onClick={()=>setOpen(v=>!v)}>
   {current?<span className="pagepicker-current"><span className="appdot" style={{background:appColor(current.id)}} aria-hidden/>{label}</span>:label}
   <ChevronDown size={14} aria-hidden/>
  </button>
  {open&&<div className="pagepicker-menu" role="listbox" id={listId} aria-label="페이지 및 앱 선택">
   <div className="pagepicker-group"><div className="pagepicker-label">현황</div>
    <button type="button" role="option" aria-selected={value==='overview'} className={value==='overview'?'selected':''} onClick={()=>go('overview')}>서비스 현황</button>
   </div>
   <div className="pagepicker-group"><div className="pagepicker-label">앱 {apps.length?`· ${apps.length}`:''}</div>
    {!apps.length&&<p className="pagepicker-empty">등록된 앱 없음</p>}
    {apps.map(a=><button type="button" role="option" key={a.id} aria-selected={value===a.id} className={'pagepicker-app'+(value===a.id?' selected':'')} onClick={()=>go(a.id)}>
     <span className="pagepicker-appmeta"><strong><span className="appdot" style={{background:appColor(a.id)}} aria-hidden/>{a.name}</strong><small>{a.androidPkg||a.id}</small></span>
    </button>)}
   </div>
   <div className="pagepicker-group"><div className="pagepicker-label">관리</div>
    <button type="button" role="option" aria-selected={value==='progress'} className={value==='progress'?'selected':''} onClick={()=>go('progress')}>{progressLabel}</button>
    <button type="button" role="option" aria-selected={value==='connections'} className={value==='connections'?'selected':''} onClick={()=>go('connections')}>데이터 연결</button>
   </div>
  </div>}
 </div>;
}

export function WorkspaceNav({page,apps,progressLabel}:{page:string;apps:AppRecord[];progressLabel:string}){
 const current=apps.find(a=>a.id===page);
 const value=page==='overview'||page==='progress'||page==='connections'?page:(current?page:'overview');
 return <nav className="workspacenav" aria-label="워크스페이스 페이지">
  <div className="workspacenav-group">
   <span className="workspacenav-label">현황</span>
   <Link href="/" className={value==='overview'?'selected':undefined}>서비스 현황</Link>
  </div>
  <div className="workspacenav-group workspacenav-apps">
   <span className="workspacenav-label">앱</span>
   {!apps.length&&<span className="workspacenav-empty">등록된 앱 없음</span>}
   <div className="workspacenav-applist">
    {apps.map(a=><Link key={a.id} href={`/apps/${a.id}`} className={'workspacenav-app'+(value===a.id?' selected':'')} title={a.androidPkg||a.id}>
     <AppIcon app={a} size={32}/><span><strong><span className="appdot" style={{background:appColor(a.id)}} aria-hidden/>{a.name}</strong><small>{a.androidPkg||a.id}</small></span>
    </Link>)}
   </div>
  </div>
  <div className="workspacenav-group">
   <span className="workspacenav-label">관리</span>
   <Link href="/progress" className={value==='progress'?'selected':undefined}>{progressLabel}</Link>
   <Link href="/connections" className={value==='connections'?'selected':undefined}>데이터 연결</Link>
  </div>
 </nav>;
}
