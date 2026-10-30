(function(root){'use strict';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const chapters=[{at:0,label:'01 / PLANET',title:'在同一颗星球上。',text:'镜头朝向海南。每一次靠近，都沿着同一处地理焦点。'},{at:.25,label:'02 / ISLAND',title:'海的这一边，是海南。',text:'海岸线开始有了形状，目的地仍在岛屿的北端。'},{at:.44,label:'03 / CITY',title:'城市，慢慢展开。',text:'海口、府城。一处校园，藏在道路与树木之间。'},{at:.63,label:'04 / FUCHENG',title:'把远方，变成日常。',text:'距离继续缩短。操场、屋顶与树冠逐渐能够辨认。'},{at:.81,label:'05 / CAMPUS',title:'一所学校，有了轮廓。',text:'地理影像在这里交接给近似空间模型，镜头向北门落下。'}];
function frame(p){p=clamp(p);const t=smooth(p/.84),altitude=Math.exp(Math.log(48000000)*(1-t)+Math.log(350)*t);return {progress:p,altitude,model:smooth((p-.80)/.12),arrival:smooth((p-.80)/.20),chapter:chapters.filter(c=>p>=c.at).pop()||chapters[0]};}

// At the start the entire Earth disc must fit in the viewport, including
// narrow portrait screens. Gradually bring its centre back to the screen
// centre while approaching the island, without moving the geographic focus.
function composition(p,aspect){
  p=clamp(p);aspect=Math.max(.35,Number(aspect)||1);
  const earthR=6371000,openingAlt=48000000;
  const angularRadius=Math.asin(earthR/(earthR+openingAlt));
  const horizontalRadius=Math.tan(angularRadius)/(.364*aspect);
  const maxOffset=Math.max(0,.89-horizontalRadius);
  return {shiftX:Math.min(.48,maxOffset)*(1-smooth(p/.26))};
}
const api={clamp,smooth,frame,composition,chapters,duration:32};if(typeof module==='object'&&module.exports)module.exports=api;else root.DescentCore=api;
})(typeof window==='undefined'?globalThis:window);
