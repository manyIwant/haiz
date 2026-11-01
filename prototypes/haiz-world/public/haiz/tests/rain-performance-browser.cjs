// Real rain buffers/framebuffer versus the original linear roof predicate.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=process.cwd(),errors=[];let browser;
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(f,(e,b)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css'})[path.extname(f)]||'application/octet-stream');res.end(b);});});
(async()=>{
  fs.mkdirSync('tests/artifacts',{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:800,height:500}});page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:'+server.address().port+'/campus-3d.html?focus=yihao&observe=1');await page.waitForFunction(()=>window.haizWalk);await page.click('#enterButton');await page.waitForFunction(()=>getComputedStyle(document.getElementById('intro')).visibility==='hidden');await page.evaluate(()=>{haizWalk.pause(null);window.requestAnimationFrame=()=>0;});
  const evidence=await page.evaluate(()=>{
    const a=haizWalk,field=a.scene.getObjectByName('Local tropical rain'),open=new Set(['oldtree','pond','rock','field','botanic','garden']);
    const shelters=a.world.buildings.filter(b=>!open.has(b.data.form)||['fengqitang','yanlintang'].includes(b.data.id)).map(b=>({x:b.center.x,z:b.center.z,w:b.data.size[0]/2+.5,d:b.data.size[2]/2+.5,top:new THREE.Box3().setFromObject(b.group).max.y,cos:Math.cos(b.data.rot||0),sin:Math.sin(b.data.rot||0)}));
    let oldTests=0;
    function expected(){const d=a.climate.diagnostics,p=[],c=a.camera.position;for(let i=0;i<d.rainBudget;i++){
      const angle=i*2.399963,r=3+Math.sqrt((i*.6180339887)%1)*17,x=c.x+Math.cos(angle)*r,z=c.z+Math.sin(angle)*r,y=c.y-4+(((i*3.713-d.time*(10+d.rain*8))%20)+20)%20;
      if(y<0||shelters.some(s=>{oldTests++;const dx=x-s.x,dz=z-s.z;return y<s.top&&Math.abs(dx*s.cos-dz*s.sin)<s.w&&Math.abs(dx*s.sin+dz*s.cos)<s.d;}))continue;
      p.push(x,y,z,x-.1-d.rain*.1,y+.5+d.rain*.6,z+.08);
    }return new Float32Array(p);}
    function check(){const ref=expected(),current=field.geometry.attributes.position.array;let differences=0;for(let i=0;i<ref.length;i++)if(ref[i]!==current[i])differences++;if(ref.length!==a.climate.diagnostics.rainCount*6)throw Error('rain count differs');if(differences)throw Error('rain coordinates differ');return ref;}
    a.climate.select('afterrain');a.climate.setWeather({rain:1,wet:1,cloud:.9});a.renderer.toneMappingExposure=a.climate.tick(5,false,true);check();
    const start=a.climate.diagnostics.roofLookup,first=field.geometry.attributes.position.array.slice(),time=a.climate.diagnostics.time;oldTests=0;
    for(let i=0;i<240;i++){a.climate.tick(1/60,false,false);check();}
    const after=a.climate.diagnostics.roofLookup,stationary={frames:240,indexQueries:after.queries-start.queries,footprintTests:after.tests-start.tests,oldFootprintTests:oldTests,rainAdvanced:a.climate.diagnostics.time>time+3.9,bufferChanged:first.some((v,i)=>v!==field.geometry.attributes.position.array[i])};
    const movingStart=a.climate.diagnostics.roofLookup;oldTests=0;
    const point=a.camera.position.clone();for(let i=0;i<120;i++){a.camera.position.x=point.x+Math.sin(i*.1)*12;a.camera.position.z=point.z+Math.cos(i*.1)*12;a.climate.tick(1/60,false,false);check();}
    const movingEnd=a.climate.diagnostics.roofLookup,moving={frames:120,indexQueries:movingEnd.queries-movingStart.queries,footprintTests:movingEnd.tests-movingStart.tests,oldFootprintTests:oldTests};
    a.camera.position.copy(point);a.climate.tick(0,false,true);const reference=check();a.renderer.render(a.scene,a.camera);
    const gl=a.renderer.getContext(),read=()=>{const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;};
    const optimized=read();field.geometry.attributes.position.array.set(reference);field.geometry.attributes.position.needsUpdate=true;a.renderer.render(a.scene,a.camera);const original=read();let differingChannels=0;for(let i=0;i<original.length;i++)if(original[i]!==optimized[i])differingChannels++;
    return {stationary,moving,framebuffer:{differingChannels,totalChannels:original.length},rainBudget:a.climate.diagnostics.rainBudget,rainCount:a.climate.diagnostics.rainCount,shadowSize:a.scene.children.find(o=>o.isDirectionalLight).shadow.mapSize.x,pixelRatio:a.renderer.getPixelRatio()};
  });
  assert.equal(evidence.stationary.indexQueries,0);assert(evidence.stationary.rainAdvanced&&evidence.stationary.bufferChanged);assert(evidence.moving.footprintTests<evidence.moving.oldFootprintTests);assert.equal(evidence.framebuffer.differingChannels,0);assert.equal(evidence.rainBudget,160);assert(evidence.rainCount>0);
  await page.screenshot({path:'tests/artifacts/rain-performance.png'});assert.deepEqual(errors,[]);const result={date:new Date().toISOString(),passed:true,evidence,errors,limits:'Exact same rain vertex positions and image, not physical rainfall/roof accuracy. Software WebGL, not phone FPS.'};fs.writeFileSync('tests/rain-performance-browser-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
