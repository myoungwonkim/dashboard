import {useCallback,useState} from 'react';
import {Hourglass} from 'lucide-react';

export function useBusyFlags(){
 const [flags,setFlags]=useState<Record<string,boolean>>({});
 const setBusy=useCallback((key:string,busy:boolean)=>{
  setFlags(prev=>{
   if(!!prev[key]===busy)return prev;
   return {...prev,[key]:busy};
  });
 },[]);
 const busy=Object.values(flags).some(Boolean);
 return {busy,setBusy};
}

export default function LoadingHourglass({show,label='데이터 불러오는 중'}:{show:boolean;label?:string}){
 if(!show)return null;
 return <div className="loading-hourglass" role="status" aria-live="polite" aria-busy="true">
  <div className="loading-hourglass-card">
   <span className="loading-hourglass-icon" aria-hidden>
    <Hourglass size={26} strokeWidth={1.75}/>
   </span>
   <span className="loading-hourglass-label">{label}</span>
  </div>
 </div>;
}
