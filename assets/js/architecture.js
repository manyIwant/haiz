(async function(){'use strict';
  const $=id=>document.getElementById(id),storageKey='haiz.architecture.notebook.v1';
  let data,current,material='roof',saved=[],category='all';
  try{const stored=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(stored))saved=stored.filter(x=>typeof x==='string');}catch{}
  function store(){try{localStorage.setItem(storageKey,JSON.stringify(saved));}catch{$('collectionStatus').textContent='浏览器未允许本地保存；本次会话仍可使用。';}}
  function node(tag,text,className){const n=document.createElement(tag);if(text)n.textContent=text;if(className)n.className=className;return n;}
  function notebook(){
    saved=saved.filter(id=>data.places.some(p=>p.id===id));
    $('collectionStatus').textContent=saved.length?'已留下 '+saved.length+' / '+data.places.length+' 页。下次来，继续观察。':'还没有收藏建筑。选一个细节开始。';
    $('collectionItems').replaceChildren(...saved.map(id=>{const p=data.places.find(p=>p.id===id),b=node('button',p.number+' / '+p.name);b.onclick=()=>{category='all';tabs();select(id);$('observatory').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};return b;}));
    const collected=saved.includes(current.id);$('collectButton').setAttribute('aria-pressed',String(collected));$('collectButton').textContent=collected?'已收进观察册 ✓':'收进观察册 ＋';$('clearCollection').hidden=!saved.length;
  }
  function preview(key){
    material=key;const m=data.materials[key],canvas=$('materialCanvas'),ctx=canvas.getContext('2d'),map=window.CampusSurfaces.maps(key)[$('reliefToggle').checked?'height':'color'];
    ctx.fillStyle=ctx.createPattern(map.image,'repeat');ctx.fillRect(0,0,512,512);
    if(!$('reliefToggle').checked){ctx.globalCompositeOperation='multiply';ctx.fillStyle=m.color;ctx.fillRect(0,0,512,512);ctx.globalCompositeOperation='source-over';}
    $('materialName').textContent=m.en+' / '+m.name;$('materialNote').textContent=m.note;
    $('materialChoices').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.material===key)));
  }
  function tabs(){
    $('categoryFilters').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===category)));
    const places=data.places.filter(p=>category==='all'||p.category===category);
    $('placeTabs').replaceChildren(...places.map(p=>{const b=node('button',p.number+' / '+p.name);b.dataset.place=p.id;b.setAttribute('aria-pressed',String(p.id===current?.id));b.onclick=()=>select(p.id);return b;}));
    if(!places.some(p=>p.id===current?.id))select(places[0].id);
  }
  function select(id){
    current=data.places.find(p=>p.id===id)||data.places[0];const p=current;
    for(const [id,text]of Object.entries({placeIndex:p.number,placeEnglish:p.en,placeTitle:p.name,placeIntro:p.intro,placeObservation:p.observation,placeModel:p.model,placeLimit:p.limit}))$(id).textContent=text;
    const photo=$('placePhoto'),fitHotspots=()=>{$('hotspots').style.height=photo.clientHeight+'px';};
    photo.onload=fitHotspots;photo.src=p.image;photo.alt=p.alt;if(photo.complete)fitHotspots();
    $('walkLink').href='campus-3d.html?focus='+p.id+'&observe=1';
    $('sourceLink').href=p.source;$('sourceLink').textContent=p.sourceName+' ↗';
    $('placeTabs').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.place===p.id)));
    $('hotspots').replaceChildren(...p.hotspots.map((h,i)=>{const b=node('button',String(i+1),'photo-hotspot');b.style.left=h.x+'%';b.style.top=h.y+'%';b.setAttribute('aria-label',h.title+'：'+h.text);b.setAttribute('aria-pressed','false');b.onclick=()=>{$('hotspotNote').textContent=h.title+' / '+h.text;$('hotspots').querySelectorAll('button').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));};return b;}));
    $('hotspotNote').textContent=p.hotspots[0].title+' / '+p.hotspots[0].text;
    $('placeMaterials').replaceChildren(...p.materials.map(k=>{const b=node('button',data.materials[k].name);b.onclick=()=>{preview(k);$('materialTitle').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};return b;}));
    notebook();
  }
  try{
    const response=await fetch('data/architecture.json');if(!response.ok)throw Error('HTTP '+response.status);data=await response.json();
    $('researchNote').textContent=data.researchNote;
    $('materialChoices').replaceChildren(...Object.entries(data.materials).map(([key,m])=>{const b=node('button',m.name);b.dataset.material=key;b.onclick=()=>preview(key);return b;}));
    $('reliefToggle').onchange=()=>preview(material);
    $('categoryFilters').querySelectorAll('button').forEach(b=>b.onclick=()=>{category=b.dataset.category;tabs();});
    $('collectButton').onclick=()=>{saved=saved.includes(current.id)?saved.filter(x=>x!==current.id):[...saved,current.id];notebook();store();};
    $('clearCollection').onclick=()=>{saved=[];notebook();store();};
    current=data.places.find(p=>p.id===new URLSearchParams(location.search).get('place'))||data.places[0];tabs();select(current.id);preview(material);
    window.addEventListener('resize',()=>{$('hotspots').style.height=$('placePhoto').clientHeight+'px';});
    window.HaizArchitecture={select,preview,get current(){return current.id;},get saved(){return saved.slice();}};
  }catch(error){$('loadError').hidden=false;$('researchNote').textContent='资料未能载入。请稍后重试。';console.error('Architecture field guide:',error);}
})();
