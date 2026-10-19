// Fixed-resolution CPU/submission probe. Software WebGL timings are not phone FPS.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=process.cwd(),errors=[];let browser;
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}const ext=path.extname(file);res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.json':'application/json'})[ext]||'application/octet-stream');res.end(b);});});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:640,height:400},deviceScaleFactor:1});page.setDefaultTimeout(180000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:'+server.address().port+'/campus-3d.html?focus=yanchi&observe=1');await page.waitForFunction(()=>window.haizWalk);
  await page.evaluate(()=>{haizWalk.pause(null);window.requestAnimationFrame=()=>0;});
  await page.addStyleTag({content:'#intro,#hud,#touchControls,.reference-trigger{display:none!important}'});
  const result=await page.evaluate(()=>{
    const a=haizWalk;a.goTo('yanchi',false);a.state.effectiveQuality='high';a.climate.select('afterrain');a.renderer.toneMappingExposure=a.climate.tick(5,false,true);CampusLandscape.tick(a.camera,'high',a.climate.diagnostics.wet);a.reflections.tick(0,'high',false,true);
    let updates=0;const original=THREE.Object3D.prototype.updateMatrix;THREE.Object3D.prototype.updateMatrix=function(){updates++;return original.call(this);};
    a.renderer.render(a.scene,a.camera);updates=0;const timings=[];
    for(let i=0;i<8;i++){const start=performance.now();a.renderer.render(a.scene,a.camera);timings.push(performance.now()-start);}
    THREE.Object3D.prototype.updateMatrix=original;
    const result={matrixCompositionsPerFrame:updates/8,submissionMs:timings,drawCalls:a.renderer.info.render.calls,triangles:a.renderer.info.render.triangles,pixelRatio:a.renderer.getPixelRatio(),shadowSize:a.scene.children.find(o=>o.isDirectionalLight).shadow.mapSize.x,programs:a.renderer.info.programs.length,landscape:CampusLandscape.diagnostics,position:{...a.state.pos}};
    // Compare actual framebuffer bytes, not the loading overlay screenshot.
    const gl=a.renderer.getContext(),read=()=>{const p=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
    a.renderer.render(a.scene,a.camera);const frozen=read(),staticObjects=[];
    a.scene.traverse(o=>{if(!o.matrixAutoUpdate){staticObjects.push(o);o.matrixAutoUpdate=true;}});
    a.renderer.render(a.scene,a.camera);const thawed=read();let differingChannels=0;for(let i=0;i<frozen.length;i++)if(frozen[i]!==thawed[i])differingChannels++;
    staticObjects.forEach(o=>o.matrixAutoUpdate=false);result.staticTransformComparison={objects:staticObjects.length,differingChannels,totalChannels:frozen.length};
    const expanded=[];let savedVertices=0;
    a.scene.traverse(o=>{if(o.isMesh&&o.geometry.userData.preservedIndexSavings>0){const original=o.geometry;expanded.push([o,original]);savedVertices+=original.userData.preservedIndexSavings;o.geometry=original.toNonIndexed();}});
    a.renderer.render(a.scene,a.camera);const expandedPixels=read();let indexDifferences=0;for(let i=0;i<frozen.length;i++)if(frozen[i]!==expandedPixels[i])indexDifferences++;
    expanded.forEach(([o,g])=>{o.geometry.dispose();o.geometry=g;});result.indexPreservation={savedVertices,differingChannels:indexDifferences};
    const M=CampusMotion,index=M.spatialIndex(a.world.colliders),bounds=a.world.bounds;let mismatch=0,seed=20;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const samples=Array.from({length:4000},()=>({x:bounds.minX+random()*(bounds.maxX-bounds.minX),z:bounds.minZ+random()*(bounds.maxZ-bounds.minZ),r:.2+random()}));
    for(const {x,z,r}of samples)if(M.blocked(x,z,a.world.colliders,bounds,r)!==M.blocked(x,z,index,bounds,r))mismatch++;
    const measure=list=>{const start=performance.now();for(const {x,z,r}of samples)M.blocked(x,z,list,bounds,r);return performance.now()-start;};
    result.collision={samples:samples.length,mismatch,linearMs:measure(a.world.colliders),indexedMs:measure(index)};
    let fan;a.scene.traverse(o=>{if(o.userData.dynamicTransform&&!fan)fan=o;});
    const fanPoint=fan.getWorldPosition(new THREE.Vector3()),angle=fan.rotation.y;fan.updateMatrixWorld(true);const before=fan.matrixWorld.clone();CampusInteriors.tick(fanPoint.x,fanPoint.z,.1,false);a.scene.updateMatrixWorld();result.fanStillAnimates=!before.equals(fan.matrixWorld);fan.rotation.y=angle;
    result.contactShadeCount=0;a.scene.traverse(o=>result.contactShadeCount+=o.userData.contactShadeCount||0);
    return result;
  });
  await page.screenshot({path:'tests/artifacts/performance-'+(process.argv.includes('--baseline')?'baseline':'current')+'.png'});assert.deepEqual(errors,[]);
  assert.equal(result.staticTransformComparison.differingChannels,0);assert.equal(result.collision.mismatch,0);assert(result.fanStillAnimates);assert(result.contactShadeCount>200);assert(result.matrixCompositionsPerFrame<150);
  assert.equal(result.indexPreservation.differingChannels,0);assert(result.indexPreservation.savedVertices>100000);
  const report={date:new Date().toISOString(),passed:true,result,errors,baseline:fs.existsSync('tests/artifacts/performance-baseline.json')?JSON.parse(fs.readFileSync('tests/artifacts/performance-baseline.json')).result:undefined,limits:'640×400 SwiftShader; CPU submission timings include driver stalls, not real-device FPS. Baseline predates the new arts-center geometry. Frozen/thawed framebuffer comparison uses the same final scene.'};
  fs.writeFileSync(process.argv.includes('--baseline')?'tests/artifacts/performance-baseline.json':'tests/performance-browser-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
