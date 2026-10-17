(async()=>{'use strict';
const $=id=>document.getElementById(id),C=window.CampusJourneyCore;
const presets={shade:['beimen','lanshu','yanchi'],architecture:['fengqitang','yihao','erhao','library'],afterclass:['yihao','library','yundong','yanchi']};
const ids=['beimen','fengqitang','lanshu','yihao','erhao','library','yanchi','yundong','kexue','nanmen'];
let catalog=[],selected=[],data;
function element(tag,text){const n=document.createElement(tag);if(text)n.textContent=text;return n;}
function svg(tag,attributes,parent){const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attributes))n.setAttribute(key,String(value));parent.append(n);return n;}
function world(rect){const t=data.meta.transform;return {x:((rect[0]+rect[2])/2-t.originPx[0])*t.scale,z:-((rect[1]+rect[3])/2-t.originPx[1])*t.scale,w:Math.abs(rect[2]-rect[0])*t.scale,d:Math.abs(rect[3]-rect[1])*t.scale};}
function persist(){try{localStorage.setItem('haiz.director.route.v1',JSON.stringify({stops:selected,climate:$('directorClimate').value}));}catch{$('directorStatus').textContent='本次仍可编排和开始路线，但浏览器没有允许本地保存。';}}
function map(){
  const root=$('directorMap');root.replaceChildren();
  const defs=svg('defs',{},root),pattern=svg('pattern',{id:'directorGrid',width:25,height:25,patternUnits:'userSpaceOnUse'},defs);svg('path',{d:'M25 0H0V25',fill:'none',stroke:'currentColor','stroke-width':.5,opacity:.1},pattern);
  svg('rect',{x:-310,y:-290,width:620,height:580,fill:'url(#directorGrid)'},root);
  for(const lawn of data.lawns||[]){const p=world(lawn.rect);svg('rect',{x:p.x-p.w/2,y:-p.z-p.d/2,width:p.w,height:p.d,class:'map-lawn'},root);}
  for(const b of data.buildings){const p=world(b.rect);svg('rect',{x:p.x-p.w/2,y:-p.z-p.d/2,width:p.w,height:p.d,rx:b.form==='field'?30:1,class:'map-footprint '+b.form},root);}
  const points=selected.map(id=>catalog.find(p=>p.id===id));
  if(points.length>1)svg('polyline',{points:points.map(p=>p.x+','+-p.z).join(' '),fill:'none',class:'map-order'},root);
  for(const p of catalog){const index=selected.indexOf(p.id),g=svg('g',{class:'director-pin'+(index>=0?' selected':''),role:'button',tabindex:0,'data-pin':p.id,'aria-label':(index>=0?'移除':'加入')+p.name,'aria-pressed':index>=0,transform:'translate('+p.x+','+-p.z+')'},root);
    svg('circle',{r:index>=0?13:8},g);const text=svg('text',{'text-anchor':'middle',y:3.5},g);text.textContent=index>=0?String(index+1):'＋';
    const label=svg('text',{x:18,y:4,class:'pin-name'},g);label.textContent=p.name;
    g.addEventListener('click',()=>toggle(p.id));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle(p.id);}});
  }
  svg('text',{x:-292,y:-266,class:'map-direction'},root).textContent='南 / S';svg('text',{x:-292,y:268,class:'map-direction'},root).textContent='北 / N';
}
function update(){
  $('stopCount').textContent=String(selected.length).padStart(2,'0')+' / 06';
  $('directorStops').replaceChildren(...selected.map((id,index)=>{const p=catalog.find(p=>p.id===id),li=element('li');li.dataset.stop=id;
    const number=element('span',String(index+1).padStart(2,'0')),name=element('strong',p.name),actions=element('div');
    for(const [label,direction]of [['上移',-1],['下移',1]]){const b=element('button',direction<0?'↑':'↓');b.setAttribute('aria-label',label+p.name);b.disabled=index+direction<0||index+direction>=selected.length;b.onclick=()=>{selected=C.move(selected,index,index+direction);render();$('directorStatus').textContent='已'+label+p.name+'。';};actions.append(b);}
    const remove=element('button','×');remove.setAttribute('aria-label','移除'+p.name);remove.onclick=()=>toggle(id);actions.append(remove);li.append(number,name,actions);return li;
  }));
  $('sequenceEmpty').hidden=selected.length>0;
  const distance=C.distance(selected.map(id=>catalog.find(p=>p.id===id)));$('routeDistance').textContent=selected.length>1?'模型地点直线跨度约 '+Math.round(distance)+' m':'从一个地点开始';
  const launch=$('launchJourney');launch.href='campus-3d.html?'+C.query(selected,$('directorClimate').value);launch.setAttribute('aria-disabled',String(!selected.length));
  $('copyJourney').disabled=!selected.length;$('clearRoute').disabled=!selected.length;
  $('directorCatalog').replaceChildren(...catalog.map(p=>{const b=element('button',p.name);b.dataset.place=p.id;b.setAttribute('aria-pressed',String(selected.includes(p.id)));b.onclick=()=>toggle(p.id);return b;}));
}
function render(){
  const active=document.activeElement,place=active?.dataset?.place,pin=active?.dataset?.pin,stop=active?.closest?.('[data-stop]')?.dataset.stop,label=active?.getAttribute?.('aria-label');
  update();map();persist();
  // Replacing the numbered list/map must not strand keyboard users on <body>.
  const scope=stop?document.querySelector('[data-stop="'+stop+'"]'):null;
  const next=place?document.querySelector('[data-place="'+place+'"]'):pin?document.querySelector('[data-pin="'+pin+'"]'):scope?[...scope.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===label&&!b.disabled)||scope.querySelector('button:not(:disabled)'):stop?$('clearRoute'):null;
  if(next&&!next.disabled)next.focus({preventScroll:true});else if(stop)$('directorCatalog').querySelector('button')?.focus({preventScroll:true});
}
function toggle(id){if(selected.includes(id))selected=selected.filter(x=>x!==id);else{if(selected.length===6){$('directorStatus').textContent='最多选择 6 站，先移除一站再加入。';return;}selected.push(id);}render();}
function views(){
  const records=window.CampusViews.read();$('emptyViews').hidden=records.length>0;
  $('savedViews').replaceChildren(...records.map((record,index)=>{
    const card=element('article'),num=element('span',String(index+1).padStart(2,'0')),heading=element('h3',record.name),detail=element('p',({morning:'晨光',afterrain:'雨后',dusk:'薄暮'}[record.climate])+' / '+Math.round(record.lens)+'° 镜头'),link=element('a','回到这个视角 ↗'),remove=element('button','移除 ×');
    link.href='campus-3d.html?'+C.viewQuery(record);remove.setAttribute('aria-label','移除机位'+record.name);remove.onclick=()=>{try{window.CampusViews.remove(record.id);views();const cards=$('savedViews').querySelectorAll('article');(cards[Math.min(index,cards.length-1)]?.querySelector('a')||$('emptyViews').querySelector('a')).focus({preventScroll:true});}catch{$('directorStatus').textContent='浏览器暂未允许移除，请检查存储设置。';}};
    card.append(num,heading,detail,link,remove);return card;
  }));
}
try{
  const response=await fetch('assets/walk/campus.json');if(!response.ok)throw Error('campus data');data=await response.json();
  catalog=ids.map(id=>{const b=data.buildings.find(p=>p.id===id);return {id,name:b.name,...world(b.rect)};});
  let saved={};try{saved=JSON.parse(localStorage.getItem('haiz.director.route.v1')||'{}')||{};}catch{}
  const query=new URLSearchParams(location.search);selected=C.stops(query.get('journey')||saved.stops||presets.shade,catalog);
  const mood=query.get('climate')||saved.climate;if(C.climates.includes(mood))$('directorClimate').value=mood;
  document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{selected=presets[b.dataset.preset].slice();render();$('directorStatus').textContent='已载入路线灵感，你仍可自由增删与调换顺序。';});
  $('directorClimate').onchange=render;$('clearRoute').onclick=()=>{selected=[];render();$('directorStatus').textContent='已清空。下一条路，由你来选。';};
  $('launchJourney').onclick=e=>{if(!selected.length){e.preventDefault();$('directorStatus').textContent='先选择至少一个地点。';}};
  $('mapTheme').onclick=()=>{const dark=$('directorMap').classList.toggle('dark-map');$('mapTheme').setAttribute('aria-pressed',String(dark));};
  $('copyJourney').onclick=async()=>{const url=new URL($('launchJourney').getAttribute('href'),location.href);try{await navigator.clipboard.writeText(url.href);$('directorStatus').textContent='已复制路线。朋友打开后会从第一站开始。';}catch{$('directorStatus').textContent='路线入口：'+url.href;}};
  window.addEventListener('storage',views);render();views();
  window.HaizDirector={get stops(){return selected.slice();},select(ids){selected=C.stops(ids,catalog);render();},get catalog(){return catalog.slice();}};
}catch(error){$('directorError').hidden=false;$('directorStatus').textContent='路线资料未载入；仍可使用页面下方的校园入口。';}
})();
