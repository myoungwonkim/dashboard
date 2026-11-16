import {useEffect,useState} from 'react';

export type SectionJump={id:string;label:string};

export default function SectionJumps({items}:{items:SectionJump[]}){
 const [active,setActive]=useState('');
 useEffect(()=>{
  function sync(){setActive(location.hash.replace(/^#/,''));}
  sync();
  window.addEventListener('hashchange',sync);
  return ()=>window.removeEventListener('hashchange',sync);
 },[]);
 if(!items.length)return null;
 return <nav className="section-jumps" aria-label="영역 바로가기">
  {items.map(item=>{
   const on=active===item.id;
   return <a
    key={item.id}
    href={`#${item.id}`}
    className={'section-jump'+(on?' on':'')}
    aria-current={on?'true':undefined}
    onClick={e=>{
     e.preventDefault();
     const el=document.getElementById(item.id);
     if(!el)return;
     el.scrollIntoView({behavior:'smooth',block:'start'});
     history.replaceState(null,'',`#${item.id}`);
     setActive(item.id);
    }}
   >{item.label}</a>;
  })}
 </nav>;
}
