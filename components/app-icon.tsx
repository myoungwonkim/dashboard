import {useState} from 'react';
import type {AppRecord} from '@/lib/apps';
import {appColor} from '@/lib/app-colors';

/** Prefer store artwork; fall back to symbol tile with app color ring. */
export default function AppIcon({app,size=36}:{app:Pick<AppRecord,'id'|'name'|'symbol'|'iconUrl'>;size?:number}){
 const ring=appColor(app.id);
 const [broken,setBroken]=useState(false);
 if(app.iconUrl&&!broken){
  return <img
   className="appicon img"
   src={app.iconUrl}
   alt=""
   width={size}
   height={size}
   loading="lazy"
   referrerPolicy="no-referrer"
   onError={()=>setBroken(true)}
   style={{boxShadow:`inset 0 0 0 1px ${ring}33`}}
  />;
 }
 return <span className="appicon" style={{width:size,height:size,boxShadow:`inset 0 0 0 2px ${ring}`}}>{app.symbol||app.name.slice(0,1)}</span>;
}
