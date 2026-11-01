/* Original haiz tropical atmosphere study. Deterministic art direction, not live
   weather or a reconstruction of a proprietary game engine. Three.js r128. */
(function (root) {
  "use strict";
  const presets = {
    morning: {
      name: "晨光",
      top: "#83b6c4",
      bottom: "#eee3c8",
      fog: "#d6ddd0",
      near: 210,
      far: 620,
      sun: "#fff0d8",
      power: 2.2,
      hemi: 0.5,
      ambient: 0.085,
      exposure: 0.98,
      offset: [-65, 80, 100],
      wet: 0,
      cloud: 0.24,
      rain: 0,
      water: "#537d75",
    },
    afterrain: {
      name: "雨后",
      top: "#839da8",
      bottom: "#ccd7d2",
      fog: "#b6c9c5",
      near: 150,
      far: 480,
      sun: "#e6f2ed",
      power: 1.25,
      hemi: 0.68,
      ambient: 0.12,
      exposure: 1.03,
      offset: [-55, 100, 80],
      wet: 0.88,
      cloud: 0.74,
      rain: 0,
      water: "#456d70",
    },
    dusk: {
      name: "薄暮",
      top: "#7c8fa9",
      bottom: "#e4bca1",
      fog: "#aeb3bc",
      near: 190,
      far: 550,
      sun: "#ffc894",
      power: 1.35,
      hemi: 0.42,
      ambient: 0.08,
      exposure: 1.08,
      offset: [105, 28, 45],
      wet: 0,
      cloud: 0.32,
      rain: 0,
      water: "#667786",
    },
    // A second season in a single moment: the downpour has just opened.
    // Low sun meets retreating slate clouds over still-wet campus paving.
    sunbreak: {
      name: "雨隙金光",
      top: "#435773",
      bottom: "#f1c49b",
      fog: "#b3b3b3",
      near: 165,
      far: 505,
      sun: "#ffcc91",
      power: 2.5,
      hemi: 0.52,
      ambient: 0.11,
      exposure: 1.02,
      offset: [124, 34, 55],
      wet: 0.92,
      cloud: 0.69,
      rain: 0.03,
      water: "#5a7380",
      rim: 0.72,
    },
    // The coastline's dense rainy air flattens distant details,
    // while nearby wet material keeps its normals and roughness.
    monsoon: {
      name: "海岛骤雨",
      top: "#435262",
      bottom: "#93a5ac",
      fog: "#8f9fa4",
      near: 105,
      far: 365,
      sun: "#c9dce6",
      power: 0.85,
      hemi: 0.66,
      ambient: 0.14,
      exposure: 1.04,
      offset: [-72, 95, 65],
      wet: 1,
      cloud: 0.93,
      rain: 0.72,
      water: "#405c62",
      rim: 0.04,
    },
  };
  const noiseGLSL = `
float climateHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float climateNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(climateHash(i),climateHash(i+vec2(1.,0.)),f.x),mix(climateHash(i+vec2(0.,1.)),climateHash(i+vec2(1.,1.)),f.x),f.y);}
`;
  // Same rotated-footprint test, with conservative XZ buckets. Keep the exact
  // narrow-phase predicate; roof edges and rain coverage must not be simplified.
  function shelterIndex(shelters,cellSize=24){
    const cells=new Map(),stats={queries:0,tests:0};
    for(const s of shelters){
      const ex=Math.abs(s.cos)*s.w+Math.abs(s.sin)*s.d+1e-7,ez=Math.abs(s.sin)*s.w+Math.abs(s.cos)*s.d+1e-7;
      for(let x=Math.floor((s.x-ex)/cellSize);x<=Math.floor((s.x+ex)/cellSize);x++)for(let z=Math.floor((s.z-ez)/cellSize);z<=Math.floor((s.z+ez)/cellSize);z++){
        const key=x+','+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(s);
      }
    }
    function height(x,z){
      stats.queries++;let highest=-Infinity;
      for(const s of cells.get(Math.floor(x/cellSize)+','+Math.floor(z/cellSize))||[]){
        stats.tests++;const dx=x-s.x,dz=z-s.z;
        if(Math.abs(dx*s.cos-dz*s.sin)<s.w&&Math.abs(dx*s.sin+dz*s.cos)<s.d)highest=Math.max(highest,s.top);
      }
      return highest;
    }
    return {height,get diagnostics(){return {...stats,cells:cells.size};}};
  }
  function create(
    scene,
    sky,
    sun,
    hemi,
    ambient,
    world,
    reduced,
    options = {},
  ) {
    const camera = options.camera,
      quality = () =>
        typeof options.quality === "function" ? options.quality() : "balanced";
    const uniforms = {
      wet: { value: 0 },
      time: { value: 0 },
      cloud: { value: presets.morning.cloud },
      rain: { value: 0 },
    };
    const roads = [...new Set(world.roadMaterials || [])].map((m) => ({
      m,
      color: m.color.clone(),
      rough: m.roughness,
      env: m.envMapIntensity ?? 1,
    }));
    // Preserve scanned albedo/normal/roughness. Add an irregular world-space water
    // film through GGX roughness, not another reflective ground or reflection pass.
    for (const { m } of roads) {
      const previous = m.onBeforeCompile,
        cacheKey = m.customProgramCacheKey();
      m.onBeforeCompile = function (shader, renderer) {
        previous.call(this, shader, renderer);
        shader.uniforms.uCampusWet = uniforms.wet;
        shader.uniforms.uCampusTime = uniforms.time;
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            "#include <common>\nvarying vec3 vCampusGround;",
          )
          .replace(
            "#include <worldpos_vertex>",
            `#include <worldpos_vertex>
vec4 campusWorld=vec4(transformed,1.0);
#ifdef USE_INSTANCING
campusWorld=instanceMatrix*campusWorld;
#endif
vCampusGround=(modelMatrix*campusWorld).xyz;`,
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            `#include <common>
varying vec3 vCampusGround;uniform float uCampusWet;uniform float uCampusTime;
${noiseGLSL}
float campusWaterFilm(vec2 p){float a=climateNoise(p*.57)*.65+climateNoise(p*1.77+9.1)*.25+climateNoise(p*6.2)*.1;return smoothstep(.50,.76,a)*smoothstep(.15,.95,uCampusWet);}
`,
          )
          .replace(
            "#include <color_fragment>",
            `#include <color_fragment>
float campusPuddle=campusWaterFilm(vCampusGround.xz);
diffuseColor.rgb*=1.0-campusPuddle*.18;`,
          )
          .replace(
            "#include <roughnessmap_fragment>",
            `#include <roughnessmap_fragment>
roughnessFactor=mix(roughnessFactor,.095,campusPuddle);`,
          );
      };
      m.customProgramCacheKey = () => cacheKey + "|haiz-ground-water-v12";
      m.userData.climateWaterFilm = true;
      m.needsUpdate = true;
    }
    const surfaces = [],
      seen = new Set();
    scene.traverse((o) => {
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m?.userData.surfaceStudy || seen.has(m)) continue;
        seen.add(m);
        surfaces.push({
          m,
          color: m.color.clone(),
          rough: m.roughness,
          coat: m.clearcoat || 0,
          coatRough: m.clearcoatRoughness ?? 0.3,
          kind: m.userData.surfaceStudy,
        });
      }
    });
    let current = "morning",
      time = 0,
      target = presets[current],
      wet = 0,
      cloud = target.cloud,
      rain = 0,
      rim = 0,
      manual = {},
      exposure = target.exposure,
      offset = target.offset.slice();
    const colors = {};
    for (const [id, p] of Object.entries(presets)) {
      colors[id] = {};
      for (const key of ["top", "bottom", "fog", "sun", "water"])
        colors[id][key] = new THREE.Color(p[key]);
    }
    const cloudUniforms = {
      uTime: uniforms.time,
      uCover: uniforms.cloud,
      uRain: uniforms.rain,
      uDetail: { value: 1 },
      uSun: { value: new THREE.Vector3(...offset).normalize() },
      uLight: { value: colors.morning.sun.clone() },
      uShade: { value: colors.morning.fog.clone() },
      uRim: { value: 0 },
    };
    // One analytic cloud shell over the Preetham sky, not volumetric ray marching.
    const cloudLayer = new THREE.Mesh(
      new THREE.SphereGeometry(700, 32, 16),
      new THREE.ShaderMaterial({
        name: "CampusCloudLayer",
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        uniforms: cloudUniforms,
        vertexShader:
          "varying vec3 vClimateDirection;void main(){vClimateDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
        fragmentShader: `uniform float uTime,uCover,uRain,uDetail,uRim;uniform vec3 uSun,uLight,uShade;varying vec3 vClimateDirection;
${noiseGLSL}
float cloudFbm(vec2 p){float a=.5,n=0.;for(int i=0;i<5;i++){if(i>=3&&uDetail<.5)break;n+=climateNoise(p)*a;p=mat2(1.6,-1.2,1.2,1.6)*p+vec2(1.7,9.2);a*=.5;}return n;}
void main(){vec3 d=normalize(vClimateDirection);float horizon=smoothstep(.015,.19,d.y);vec2 p=d.xz/(max(d.y,0.)+.22)*1.65+vec2(uTime*.003,uTime*.0012);float mass=cloudFbm(p);float threshold=mix(.91,.20,uCover);float density=smoothstep(threshold,threshold+.18,mass)*horizon;float fine=cloudFbm(p*2.3+4.2);float volume=clamp(mass*.8+fine*.2,0.,1.);float sunward=pow(max(0.,dot(d,uSun)),12.);vec3 shade=mix(uShade*.48,uShade*.70,volume);vec3 light=mix(vec3(.96,.98,1.),uLight,.28);vec3 col=mix(shade,light,smoothstep(threshold+.04,threshold+.32,mass)*(1.-uRain*.4));col+=uLight*sunward*(1.-density)*.12;
float silver=pow(max(0.,dot(d,uSun)),18.)*smoothstep(.12,.55,density)*(1.-smoothstep(.83,.98,density));
col+=uLight*silver*uRim*.58;gl_FragColor=vec4(col,density*.94);
#include <tonemapping_fragment>
#include <encodings_fragment>
}`,
      }),
    );
    cloudLayer.name = "Tropical analytic cloud shell";
    cloudLayer.renderOrder = -8;
    cloudLayer.frustumCulled = false;
    scene.add(cloudLayer);
    const drops = 160,
      dropPositions = new Float32Array(drops * 6),
      dropGeometry = new THREE.BufferGeometry();
    dropGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(dropPositions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    const dropMaterial = new THREE.LineBasicMaterial({
      color: "#b9d3d4",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: true,
    });
    const rainField = new THREE.LineSegments(dropGeometry, dropMaterial);
    rainField.name = "Local tropical rain";
    rainField.frustumCulled = false;
    rainField.visible = false;
    scene.add(rainField);
    let rainCount = 0,
      rainBudget = 0;
    const dropOffsets=Array.from({length:drops},(_,i)=>{const a=i*2.399963,r=3+Math.sqrt((i*.6180339887)%1)*17;return [Math.cos(a)*r,Math.sin(a)*r];});
    // Cheap roof-footprint rejection: do not draw falling streaks below a known
    // building roof. This is a rotated footprint approximation, not fluid physics.
    const openForms = new Set([
      "oldtree",
      "pond",
      "rock",
      "field",
      "botanic",
      "garden",
    ]);
    const shelters = (world.buildings || [])
      .filter(
        (b) =>
          !openForms.has(b.data.form) ||
          ["fengqitang", "yanlintang"].includes(b.data.id),
      )
      .map((b) => {
        const angle = b.data.rot || 0,
          box = new THREE.Box3().setFromObject(b.group);
        return {
          x: b.center.x,
          z: b.center.z,
          w: b.data.size[0] / 2 + 0.5,
          d: b.data.size[2] / 2 + 0.5,
          top: box.max.y,
          cos: Math.cos(angle),
          sin: Math.sin(angle),
        };
      });
    const roofIndex=shelterIndex(shelters),roofHeights=new Float64Array(drops);
    let roofX=NaN,roofZ=NaN,roofCached=0;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const c = canvas.getContext("2d"),
      img = c.createImageData(128, 128);
    for (let y = 0; y < 128; y++)
      for (let x = 0; x < 128; x++) {
        const i = (y * 128 + x) * 4;
        img.data[i] =
          128 + Math.sin((x * Math.PI) / 16 + (y * Math.PI) / 32) * 20;
        img.data[i + 1] =
          128 + Math.cos((y * Math.PI) / 16 - (x * Math.PI) / 32) * 20;
        img.data[i + 2] = 251;
        img.data[i + 3] = 255;
      }
    c.putImageData(img, 0, 0);
    const normal = new THREE.CanvasTexture(canvas);
    normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
    normal.repeat.set(7, 9);
    if (world.water) {
      world.water.normalMap = normal;
      world.water.normalScale.set(0.19, 0.19);
      world.water.needsUpdate = true;
    }
    const weather = () => ({
      cloud: manual.cloud ?? target.cloud,
      rain: manual.rain ?? target.rain,
      wet: manual.wet ?? target.wet,
    });
    function tick(dt, indoors, paused = false) {
      dt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 10)) : 0;
      time += paused || reduced ? 0 : dt;
      const t = reduced ? 1 : Math.min(1, dt * 1.1),
        col = colors[current],
        w = weather();
      cloud += (w.cloud - cloud) * t;
      rain += (w.rain - rain) * t;
      rim += ((target.rim || 0) - rim) * t;
      wet += (Math.max(w.wet, rain * 0.8) - wet) * t;
      uniforms.time.value = time;
      uniforms.wet.value = wet;
      uniforms.cloud.value = cloud;
      uniforms.rain.value = rain;
      const su = sky.material.uniforms;
      if (su.top) {
        su.top.value.lerp(col.top, t);
        su.bottom.value.lerp(col.bottom, t);
      }
      scene.fog.color.lerp(col.fog, t);
      scene.background.copy(scene.fog.color);
      scene.fog.near += (target.near * (1 - rain * 0.55) - scene.fog.near) * t;
      scene.fog.far += (target.far * (1 - rain * 0.4) - scene.fog.far) * t;
      sun.color.lerp(col.sun, t);
      sun.intensity +=
        (target.power * (1 - cloud * 0.28) * (1 - rain * 0.45) -
          sun.intensity) *
        t;
      hemi.intensity +=
        (target.hemi + cloud * 0.1 + rain * 0.1 - hemi.intensity) * t;
      ambient.intensity += (target.ambient - ambient.intensity) * t;
      exposure += ((indoors ? 1.28 : target.exposure) - exposure) * t;
      for (let i = 0; i < 3; i++)
        offset[i] += (target.offset[i] - offset[i]) * t;
      sun.position.set(
        sun.target.position.x + offset[0],
        offset[1],
        sun.target.position.z + offset[2],
      );
      if (su.sunPosition) {
        su.sunPosition.value.set(...offset);
        su.turbidity.value = 3 + cloud * 3 + rain * 4;
        su.rayleigh.value = 1.8;
        su.mieCoefficient.value = 0.005 + cloud * 0.004 + rain * 0.008;
        su.mieDirectionalG.value = 0.8;
      }
      cloudUniforms.uSun.value.set(...offset).normalize();
      cloudUniforms.uLight.value.copy(col.sun);
      cloudUniforms.uShade.value.copy(col.fog);
      cloudUniforms.uDetail.value = quality() === "low" ? 0 : 1;
      cloudUniforms.uRim.value = rim;
      if (camera)
        cloudLayer.position.set(camera.position.x, 0, camera.position.z);
      rainField.visible =
        !!camera &&
        !indoors &&
        !reduced &&
        rain > 0.015 &&
        camera.position.y < 25;
      rainBudget = rainField.visible
        ? Math.round((quality() === "low" ? 48 : drops) * rain)
        : 0;
      rainCount = 0;
      dropMaterial.opacity = rain * 0.43;
      if (rainField.visible) {
        const px = camera.position.x,
          pz = camera.position.z,
          py = camera.position.y - 4;
        // Drop columns move only with the camera, not time or rain strength.
        // Retain Float64 heights and invalidate on every exact XZ change.
        if(px!==roofX||pz!==roofZ){roofX=px;roofZ=pz;roofCached=0;}
        for(let i=roofCached;i<rainBudget;i++)roofHeights[i]=roofIndex.height(px+dropOffsets[i][0],pz+dropOffsets[i][1]);
        roofCached=Math.max(roofCached,rainBudget);
        for (let i = 0; i < rainBudget; i++) {
          const fall = (((i * 3.713 - time * (10 + rain * 8)) % 20) + 20) % 20,
            x = px + dropOffsets[i][0],
            z = pz + dropOffsets[i][1],
            y = py + fall;
          if (y < 0 || y < roofHeights[i]) continue;
          const k = rainCount++ * 6;
          dropPositions[k] = x;
          dropPositions[k + 1] = y;
          dropPositions[k + 2] = z;
          dropPositions[k + 3] = x - 0.1 - rain * 0.1;
          dropPositions[k + 4] = y + 0.5 + rain * 0.6;
          dropPositions[k + 5] = z + 0.08;
        }
        dropGeometry.attributes.position.needsUpdate = true;
      }
      dropGeometry.setDrawRange(0, rainCount * 2);
      roads.forEach(({ m, color, rough, env }) => {
        m.color.copy(color).multiplyScalar(1 - wet * 0.08);
        m.roughness = rough * (1 - wet * 0.12);
        m.envMapIntensity = env + (Math.max(env, 0.72) - env) * wet;
        m.userData.climateWetness = wet;
      });
      surfaces.forEach(({ m, color, rough, coat, coatRough, kind }) => {
        const amount =
          wet *
          (kind === "timber"
            ? 0.2
            : kind === "ceramic"
              ? 0.35
              : kind === "stone"
                ? 0.7
                : 1);
        m.color
          .copy(color)
          .multiplyScalar(1 - amount * (kind === "stone" ? 0.24 : 0.1));
        m.roughness = rough * (1 - amount) + 0.3 * amount;
        if (m.isMeshPhysicalMaterial) {
          m.clearcoat = coat + (1 - coat) * amount * 0.35;
          m.clearcoatRoughness = coatRough * (1 - amount) + 0.18 * amount;
        }
      });
      if (world.water) {
        world.water.color.lerp(col.water, t);
        if (!reduced && !paused) normal.offset.set(time * 0.007, time * 0.003);
        world.water.normalScale.set(
          0.15 + wet * 0.05 + rain * 0.08,
          0.15 + wet * 0.05 + rain * 0.08,
        );
        world.water.userData.climateRain = rain;
      }
      return exposure;
    }
    return {
      select(id) {
        if (!Object.hasOwn(presets, id)) return false;
        current = id;
        target = presets[id];
        manual = {};
        return true;
      },
      setWeather(value = {}) {
        for (const key of ["cloud", "rain", "wet"])
          if (typeof value[key] === "number" && Number.isFinite(value[key]))
            manual[key] = Math.max(0, Math.min(1, value[key]));
      },
      resetWeather() {
        manual = {};
      },
      tick,
      get current() {
        return current;
      },
      get weather() {
        return weather();
      },
      get diagnostics() {
        return {
          cloud,
          wet,
          rain,
          rainCount,
          rainBudget,
          shelterCount: shelters.length,
          time,
          custom: Object.keys(manual).length > 0,
          reduced,
          cloudDrawCalls: 1,
          extraReflectionPasses: 0,
          roadWaterFilms: roads.length,
          roofLookup: roofIndex.diagnostics,
          cachedRainColumns: roofCached,
        };
      },
      presets,
    };
  }
  root.CampusClimate = { create, presets, shelterIndex };
})(window);
