(function(root){'use strict';
  // Every extent shares the same projected center as the bundled photographs.
  // Insert genuine intermediate ArcGIS export requests rather than upscaling
  // already-downloaded 1024px files. Keep the number of texture samplers within
  // the browser's reported fragment-sampler limit (WebGL1 may only offer 8).
  const intermediate=[
    {width:1000000,label:'region-mid',pixels:1536,priority:6},
    {width:220000,label:'island-city-mid',pixels:1536,priority:3},
    {width:32000,label:'city-district-mid',pixels:2048,priority:2},
    {width:4600,label:'district-campus-mid',pixels:2048,priority:1},
    {width:1000,label:'campus-courtyard-mid',pixels:2048,priority:4},
    {width:330,label:'courtyard-close',pixels:1536,priority:5}
  ];
  function create(imagery,maxTextureUnits,options={}){
    if(!imagery?.layers?.length)throw Error('Missing base map layers');
    const originals=imagery.layers.map(l=>({...l,bundled:true}));
    const first=originals[0];
    const cx=(first.bounds[0]+first.bounds[2])/2,cy=(first.bounds[1]+first.bounds[3])/2;
    const maxAdditional=options.enableRemote===false?0:Math.max(0,Math.min(intermediate.length,(Number(maxTextureUnits)||8)-1-originals.length));
    const selected=intermediate.slice().sort((a,b)=>a.priority-b.priority).slice(0,maxAdditional);
    const extras=selected.map(item=>{
      const half=item.width/2,bounds=[cx-half,cy-half,cx+half,cy+half];
      const url=new URL(first.source);
      url.searchParams.set('bbox',bounds.join(','));
      url.searchParams.set('bboxSR','3857');
      url.searchParams.set('imageSR','3857');
      url.searchParams.set('size',item.pixels+','+item.pixels);
      url.searchParams.set('format','jpg');
      url.searchParams.set('f','image');
      url.searchParams.set('compressionQuality','88');
      return {name:item.label,widthMeters:item.width,pixels:item.pixels,bounds,source:url.href,extra:true};
    });
    return {layers:[...originals,...extras].sort((a,b)=>b.widthMeters-a.widthMeters),
      extraNames:extras.map(x=>x.name),extraCount:extras.length,
      samplerBudget:Number(maxTextureUnits)||8};
  }
  const api={create,intermediate};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.DescentImageryPlan=api;
})(typeof window==='undefined'?globalThis:window);
