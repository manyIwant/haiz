/* Small leaf motion; matching depth deformation keeps shadows attached. */
(function(root){'use strict';
function create(scene,reduced){
  const time={value:0},strength={value:reduced?0:1},patched=new Set();let clock=0;
  function patch(material){
    if(!material||patched.has(material))return;patched.add(material);
    const previous=material.onBeforeCompile;
    material.onBeforeCompile=function(shader,renderer){
      previous?.call(this,shader,renderer);shader.uniforms.haizWindTime=time;shader.uniforms.haizWindStrength=strength;
      shader.vertexShader='uniform float haizWindTime;uniform float haizWindStrength;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        if(haizWindStrength>0.0){
          vec4 windPoint=vec4(transformed,1.0);
          #ifdef USE_INSTANCING
            windPoint=instanceMatrix*windPoint;
          #endif
          windPoint=modelMatrix*windPoint;
          float phase=haizWindTime*.9+windPoint.x*.13+windPoint.z*.17;
          float flex=(.35+position.y)*haizWindStrength;
          transformed.x+=sin(phase)*.026*flex;
          transformed.z+=cos(phase*1.3)*.013*flex;
        }`);
    };
    material.customProgramCacheKey=()=> 'haiz-leaf-breeze-1';material.needsUpdate=true;
  }
  scene.traverse(mesh=>{if(mesh.userData.foliage){patch(mesh.material);patch(mesh.customDepthMaterial);}});
  return {tick(dt,quality,paused){if(!paused&&!reduced)clock+=dt;time.value=clock;strength.value=reduced||quality==='low'?0:1;},get materials(){return patched.size;}};
}
root.CampusBreeze={create};
})(window);
