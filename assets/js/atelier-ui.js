/* Quiet editorial motion: finite entrances only, no polling or animation loop. */
(()=>{'use strict';
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
const guide=document.querySelector('.observatory');
if(guide){
  const nav=document.createElement('nav');nav.className='atelier-chapters';nav.setAttribute('aria-label','建筑手册章节');
  const links=[['observeTitle','观察'],['materialTitle','材质'],['lightTitle','光影']].map(([id,label])=>{const a=document.createElement('a');a.href='#'+id;a.textContent=label;nav.append(a);return a;});document.body.append(nav);
  if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){links.forEach(a=>{if(a.hash==='#'+e.target.id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});}},{rootMargin:'-15% 0px -50% 0px'});links.forEach(a=>observer.observe(document.querySelector(a.hash)));}
}
if(!reduced&&'IntersectionObserver'in window){
  const observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){e.target.classList.add('atelier-reveal');observer.unobserve(e.target);}},{threshold:.08});
  document.querySelectorAll('.field-hero>div,.field-hero>figure,.observe-grid,.lab-grid,.light-study,.director-section-head,.director-workspace,.director-views').forEach(el=>observer.observe(el));
}
})();
