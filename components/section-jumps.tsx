export type SectionJump={id:string;label:string};

export default function SectionJumps({items}:{items:SectionJump[]}){
 if(!items.length)return null;
 return <nav className="section-jumps" aria-label="영역 바로가기">
  {items.map(item=>(
   <a
    key={item.id}
    href={`#${item.id}`}
    className="section-jump"
    onClick={e=>{
     e.preventDefault();
     const el=document.getElementById(item.id);
     if(!el)return;
     el.scrollIntoView({behavior:'smooth',block:'start'});
     history.replaceState(null,'',`#${item.id}`);
    }}
   >{item.label}</a>
  ))}
 </nav>;
}
