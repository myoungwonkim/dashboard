import {useEffect,useMemo,useState} from 'react';

export type AppToggleOption={id:string;name:string};

export function useAppFilter(apps:AppToggleOption[]){
 const ids=useMemo(()=>apps.map(a=>a.id),[apps]);
 const key=ids.join(',');
 const [selected,setSelected]=useState<Set<string>>(()=>new Set(ids));
 useEffect(()=>{setSelected(new Set(ids));},[key]);
 const allOn=!ids.length||selected.size===ids.length||selected.size===0;
 function selectAll(){setSelected(new Set(ids));}
 function toggle(id:string){
  setSelected(prev=>{
   const wasAll=!prev.size||prev.size===ids.length;
   if(wasAll)return new Set([id]);
   const next=new Set(prev);
   if(next.has(id))next.delete(id);else next.add(id);
   if(!next.size||next.size===ids.length)return new Set(ids);
   return next;
  });
 }
 function includes(id:string){return allOn||selected.has(id);}
 const filtered=useMemo(()=>allOn?apps:apps.filter(a=>selected.has(a.id)),[apps,allOn,selected,key]);
 const label=allOn?(apps.length>1?'앱 합산':'이 앱'):filtered.map(a=>a.name).join(' · ');
 return {selected,allOn,selectAll,toggle,includes,filtered,label,show:apps.length>1};
}

export default function AppToggle({
 apps,allOn,selected,onSelectAll,onToggle,label='앱 선택',
}:{
 apps:AppToggleOption[];
 allOn:boolean;
 selected:Set<string>;
 onSelectAll:()=>void;
 onToggle:(id:string)=>void;
 label?:string;
}){
 if(apps.length<=1)return null;
 return <div className="channel-window app-toggle-window" role="group" aria-label={label}>
  <button type="button" className={'channel-seg'+(allOn?' on':'')} aria-pressed={allOn} onClick={onSelectAll}>전체</button>
  {apps.map(a=>{
   const on=!allOn&&selected.has(a.id);
   return <button type="button" key={a.id} className={'channel-seg'+(on?' on':'')} aria-pressed={on} onClick={()=>onToggle(a.id)} title={a.name}>{a.name}</button>;
  })}
 </div>;
}
