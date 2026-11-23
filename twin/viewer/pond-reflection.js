// Preserve the exported water mesh and normal map. Both water levels reflect
// their surroundings from the observer's current position in the r128 viewer.
function installPondReflections(part, camera, sunDirection) {
  part.updateMatrixWorld(true);
  const surfaces = [];
  part.traverse(obj => {
    if (obj.isMesh && obj.material.name === 'pond.water.olive') surfaces.push(obj);
  });
  for (const source of surfaces) {
    const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld);
    geometry.computeBoundingBox();
    const planeHeight = geometry.boundingBox.getCenter(new THREE.Vector3()).y;
    // Water.js reflects across its local +Z plane through the object's origin.
    geometry.translate(0,-planeHeight,0).rotateX(Math.PI/2);
    const water = new THREE.Water(geometry, {
      textureWidth:1024, textureHeight:1024, clipBias:.0008,
      waterNormals:source.material.normalMap,
      waterColor:new THREE.Color(0x55663d).convertSRGBToLinear(),
      sunDirection, sunColor:0xf3e8c7
    });
    water.rotation.x = -Math.PI/2;
    water.position.y = planeHeight;
    water.name = source.name+'.reflection';
    water.material.vertexShader = water.material.vertexShader
      .replace('varying vec4 mirrorCoord;', 'varying vec4 mirrorCoord; varying vec3 pondNormal;')
      .replace('worldPosition = mirrorCoord.xyzw;', 'worldPosition = mirrorCoord.xyzw; pondNormal = normalize(mat3(modelMatrix)*normal);');
    water.material.fragmentShader = `
      uniform sampler2D mirrorSampler, normalSampler;
      uniform vec3 waterColor, eye, sunDirection, sunColor;
      varying vec4 mirrorCoord, worldPosition;
      varying vec3 pondNormal;
      void main() {
        vec3 ripple = texture2D(normalSampler,worldPosition.xz/2.8).xyz*2.0-1.0;
        vec3 n = normalize(pondNormal + vec3(ripple.x,0.0,ripple.y)*0.55);
        vec3 view = normalize(eye-worldPosition.xyz);
        float grazing = 1.0-clamp(dot(n,view),0.0,1.0);
        float fresnel = 0.028+0.90*pow(grazing,4.5);
        vec2 uv = mirrorCoord.xy/mirrorCoord.w;
        uv += n.xz*(0.014+0.052/max(length(eye-worldPosition.xyz),1.0));
        vec3 reflected = texture2D(mirrorSampler,clamp(uv,0.001,0.999)).rgb;
        float glint = pow(max(dot(reflect(-sunDirection,n),view),0.0),150.0);
        vec3 light = mix(waterColor,reflected,fresnel)+sunColor*glint*.30;
        gl_FragColor = vec4(light,1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }
    `;
    const mirror = water.onBeforeRender;
    water.onBeforeRender = function(renderer,scene,activeCamera) {
      if (activeCamera === camera) mirror.call(this,renderer,scene,activeCamera);
    };
    source.visible = false;
    part.add(water);
  }
}
