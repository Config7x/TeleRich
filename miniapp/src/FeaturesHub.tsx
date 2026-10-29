import { useState } from 'react';
import { ChevronDown, ArrowUpRight } from 'lucide-react';
import { HUB } from './features';
import type { HubAction } from './features';

/* The features hub. It is the single map of everything the studio can do, so a
   capability can never hide behind a page the user forgot about. */
export default function FeaturesHub({lang, onAct, title=true}:{lang:'en'|'fa'; onAct:(a:HubAction)=>void; title?:boolean}){
 const fa=lang==='fa';
 const [open,setOpen]=useState<string[]>(['build']);
 const toggle=(k:string)=>setOpen(o=>o.includes(k)?o.filter(x=>x!==k):[...o,k]);
 return <section className="hub">
  {title&&<header className="hub-head">
   <div><span className="hub-eyebrow">{fa?'نقشهٔ کامل':'The full map'}</span><h2>{fa?'همه‌ی امکانات':'Every feature'}</h2></div>
   <p>{fa?'هر چیزی که استودیو می‌تواند بسازد، یک‌جا.':'Everything the studio can do, in one place.'}</p>
  </header>}
  {HUB.map(g=>{
   const isOpen=open.includes(g.key);
   return <div key={g.key} className={'hub-group '+(isOpen?'open':'')} style={{['--accent' as any]:g.accent}}>
    <button className="hub-summary" onClick={()=>toggle(g.key)} aria-expanded={isOpen}>
     <span className="hub-emoji">{g.emoji}</span>
     <span className="hub-titles"><strong>{g.title[fa?1:0]}</strong><small>{g.subtitle[fa?1:0]}</small></span>
     <em>{g.items.length}</em>
     <ChevronDown size={16} className="hub-chev"/>
    </button>
    {isOpen&&<div className="hub-grid">
     {g.items.map(it=>{
      const external=it.act.to==='link';
      return <button key={it.title[0]} className="hub-card" onClick={()=>onAct(it.act)}>
       <span className="hub-card-top"><strong>{it.title[fa?1:0]}</strong>{it.badge?<i>{it.badge[fa?1:0]}</i>:null}{external?<ArrowUpRight size={13} className="hub-out"/>:null}</span>
       <small>{it.desc[fa?1:0]}</small>
      </button>;
     })}
    </div>}
   </div>;
  })}
 </section>;
}
