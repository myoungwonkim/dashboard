'use client';
import {useId,useState,type ReactNode} from 'react';
import {CircleHelp} from 'lucide-react';
import type {FieldHelpContent} from '@/lib/connection-help';

export function FieldHelp({help}:{help:FieldHelpContent}){
 const id=useId();
 const [open,setOpen]=useState(false);
 return <span className={'fieldhelp'+(open?' open':'')} onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)}>
  <button
   type="button"
   className="fieldhelp-btn"
   aria-label={`${help.title} 도움말`}
   aria-expanded={open}
   aria-controls={id}
   onFocus={()=>setOpen(true)}
   onBlur={()=>setOpen(false)}
   onClick={e=>{e.preventDefault();e.stopPropagation();setOpen(v=>!v);}}
  >
   <CircleHelp size={15} strokeWidth={2}/>
  </button>
  <span className="fieldhelp-panel" role="tooltip" id={id} hidden={!open}>
   <strong className="fieldhelp-title">{help.title}</strong>
   <ol className="fieldhelp-steps">{help.steps.map((s,i)=><li key={i}>{s}</li>)}</ol>
   {help.note&&<p className="fieldhelp-note">{help.note}</p>}
   {help.link&&<a className="fieldhelp-link" href={help.link.href} target="_blank" rel="noreferrer" onMouseDown={e=>e.preventDefault()}>{help.link.label} ↗</a>}
  </span>
 </span>;
}

/** Use inside <label>: wraps the title text + optional help icon. */
export function LabelText({children,help}:{children:ReactNode;help?:FieldHelpContent}){
 return <span className="labeltext">{children}{help&&<FieldHelp help={help}/>}</span>;
}
