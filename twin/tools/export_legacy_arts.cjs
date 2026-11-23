// Run with node, Playwright, the r128 GLTFExporter.js, and the original campus source tree.
// node export_legacy_arts.cjs CAMPUS_ROOT GLTFExporter.js OUTPUT.glb
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.HAIZ_PLAYWRIGHT || 'playwright');

async function main() {
  const [rootDir, exporterPath, output] = process.argv.slice(2);
  const root = path.resolve(rootDir);
  const world = fs.readFileSync(path.join(root,'assets/walk/world.js'),'utf8');
  const begin = world.indexOf('buildMaterials();window.CampusLandscape');
  const end = world.indexOf('buildGround(cfg);',begin);
  if (begin<0 || end<0) throw new Error('Unsupported campus material setup');
  // Invoke the real material setup and window queue in the closure that owns them.
  // Build this building alone, before the original walk batches the entire campus.
  const adapter = `global.exportArts = function(b,bank){
    pbrBank=bank;
    var quality='high',pbr=bank;
    ${world.slice(begin,end)}
    Object.entries(MAT).forEach(([k,v])=>{if(v.isMaterial)v.name='arts.'+k;});
    var g=new THREE.Group();
    CampusAtelier.arts(g,b,MAT,queueWindow);
    // Keep the measured-scale steps, pier assemblies, door recess and landscape.
    // The broad slab, its windows and both old roof kits are superseded in Blender.
    const old=g.children.slice();
    if (old[62]?.position.y!==7.5 || old[7]?.position.z!==-21)
      throw Error('Unrecognised legacy arts layout');
    // Keep the original garden root, independently register the portico to the
    // observed entrance, and shorten the approach between the shore and science hall.
    const pavingStart=old.findIndex(o=>o.material?.userData?.artsFinish==='terracotta-paving'
      || (Math.abs(o.position.z-56.6)<.001 && o.isMesh));
    if(pavingStart<80) throw Error('Entrance plaza not found');
    const gardenStart=old.findIndex(o=>o.userData.botanicalPalm);
    for(let i=51;i<gardenStart;i++) {
      const o=old[i];
      if(i>=pavingStart && i<pavingStart+5) {
        o.position.z=46.6+(o.position.z-46.6)*.61+7.4;
        o.position.x=o.position.x*.81-2.15; o.scale.x*=.81; o.scale.z*=.61;
      } else {
        o.position.x-=3.8; o.position.z+=7.4;
      }
    }
    for (const o of old.slice(0,51)) g.remove(o);
    g.remove(old[62]);
    // The wide central lintel and sill are rebuilt around the retained recessed door.
    // No queued window from the old full-width facade belongs on the new wings.
    CampusSurfaces.project(g);
    return g;
  }; `;
  const browser = await chromium.launch({headless:true,executablePath:process.env.HAIZ_CHROME});
  try {
    const page=await browser.newPage();
    page.on('pageerror',e=>console.error(e));
    await page.route('http://campus.local/**',async route=>{
      const requestPath=decodeURIComponent(new URL(route.request().url()).pathname).slice(1);
      if (!requestPath) return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8">'});
      const file=path.resolve(root,requestPath);
      if(!file.startsWith(root+path.sep)) return route.abort();
      await route.fulfill({path:file});
    });
    await page.goto('http://campus.local/');
    for(const src of ['assets/vendor/three.min.js','assets/walk/interiors.js','assets/walk/surfaces.js',
                      'assets/walk/atelier.js','assets/walk/landscape.js']){
      await page.addScriptTag({url:'http://campus.local/'+src});
    }
    await page.addScriptTag({content:world.replace('global.CampusWorld={build:build}',adapter+'global.CampusWorld={build:build}')});
    await page.addScriptTag({path:exporterPath});
    const spec=JSON.parse(fs.readFileSync(path.join(root,'data/buildings.json'),'utf8')).buildings.find(b=>b.id==='yishu');
    const result=await page.evaluate(async spec=>{
      const bank=await CampusInteriors.loadMaterials();
      if(!bank.foliage || !bank.plaster.color) throw Error('Source textures incomplete');
      const g=window.exportArts(spec,bank);
      const instances=[];
      g.traverse(o=>{if(o.isInstancedMesh) instances.push(o);});
      for(const im of instances){
        const group=new THREE.Group();
        group.copy(im,false); group.userData={...im.userData};
        const mat4=new THREE.Matrix4(),color=new THREE.Color();
        for(let i=0;i<im.count;i++){
          let mat=im.material;
          if(im.instanceColor){
            mat=mat.clone(); im.getColorAt(i,color);mat.color.multiply(color);
          }
          const mesh=new THREE.Mesh(im.geometry,mat);
          im.getMatrixAt(i,mat4);mat4.decompose(mesh.position,mesh.quaternion,mesh.scale);
          group.add(mesh);
        }
        im.parent.add(group);im.parent.remove(im);
      }
      // Register the inherited garden on dry ground along the north bank. Its
      // former rectangular layout otherwise puts all three east palms in the pond.
      const northBank=(x,z)=>[-24.4-(z-53.6),64.85+.47*(x+15.635)];
      const plant=o=>{
        const [x,z]=northBank(o.position.x,o.position.z);
        o.position.x=x; o.position.z=z; o.rotateY(-Math.PI/2);
      };
      for (const o of g.children) {
        if (o.userData.botanicalPalm && o.position.x<0) plant(o);
        if (o.userData.foliage && o.children[0]?.position.x<0)
          for (const child of o.children) plant(child);
        if (o.userData.artsPlantingBed) {
          const pos=o.geometry.attributes.position;
          if (pos.getX(0)>=0) continue;
          for (let i=0;i<pos.count;i++) {
            const [x,z]=northBank(pos.getX(i),-pos.getY(i));
            pos.setXY(i,x,-z);
          }
          pos.needsUpdate=true; o.geometry.computeBoundingBox(); o.geometry.computeBoundingSphere();
        }
      }
      g.name='arts'; g.position.set(25.6,0.15,170.3); g.rotation.y=Math.PI;
      g.userData.haiz_tag='estimated';
      g.userData.haiz_basis='Legacy arts entrance and landscaping, native metre scale. Entrance re-registered against the courtyard image; position is an estimate.';
      let count=0;
      g.traverse(o=>{
        if(!o.isMesh) return;
        const mat=[].concat(o.material)[0];
        const hint=mat.userData.artsFinish || mat.name || (o.parent.userData.foliage?'planting':'component');
        o.name='arts.'+hint.replace(/^arts\./,'')+'.'+String(++count).padStart(4,'0');
        o.userData.haiz_tag='photo-derived/estimated';
        o.userData.haiz_basis='Retained from the local HAIZ high-detail arts builder, based on campus_yishu.jpg. Concealed construction and planting are artistic estimates.';
      });
      const buf=await new Promise(resolve=>new THREE.GLTFExporter().parse(g,resolve,{binary:true,onlyVisible:false,embedImages:true}));
      const encoded=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(new Blob([buf]));});
      return {encoded,count,planting:g.userData.photoPlanting};
    },spec);
    fs.writeFileSync(output,Buffer.from(result.encoded,'base64'));
    console.log(output,result.count,'mesh nodes',result.planting);
  } finally { await browser.close(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
