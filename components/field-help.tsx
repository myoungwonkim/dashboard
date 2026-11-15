'use client';
import {useId,useState,type ReactNode} from 'react';
import {CircleHelp,X} from 'lucide-react';
import type {FieldHelpContent} from '@/lib/connection-help';

export function FieldHelp({help}:{help:FieldHelpContent}){
 const id=useId();
 const [open,setOpen]=useState(false);
 return <span className={'fieldhelp'+(open?' open':'')}>
  <button
   type="button"
   className="fieldhelp-btn"
   aria-label={`${help.title} 도움말`}
   aria-expanded={open}
   aria-controls={id}
   onClick={e=>{e.preventDefault();e.stopPropagation();setOpen(true);}}
  >
   <CircleHelp size={15} strokeWidth={2}/>
  </button>
  {open&&<span className="fieldhelp-panel" role="dialog" aria-labelledby={`${id}-title`} id={id}>
   <span className="fieldhelp-head">
    <strong className="fieldhelp-title" id={`${id}-title`}>{help.title}</strong>
    <button type="button" className="fieldhelp-close" aria-label="도움말 닫기" onClick={e=>{e.preventDefault();e.stopPropagation();setOpen(false);}}>
     <X size={16} strokeWidth={2}/>
    </button>
   </span>
   <ol className="fieldhelp-steps">{help.steps.map((s,i)=><li key={i}>{s}</li>)}</ol>
   {help.note&&<p className="fieldhelp-note">{help.note}</p>}
   {help.link&&<a className="fieldhelp-link" href={help.link.href} target="_blank" rel="noreferrer">{help.link.label} ↗</a>}
  </span>}
 </span>;
}

/** Use inside <label>: wraps the title text + optional help icon. */
export function LabelText({children,help}:{children:ReactNode;help?:FieldHelpContent}){
 return <span className="labeltext">{children}{help&&<FieldHelp help={help}/>}</span>;
}
