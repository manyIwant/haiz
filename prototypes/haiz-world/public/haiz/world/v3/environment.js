/* V3 daylight authority. Call tick after CampusClimate.tick; Three.js r128, no extra render passes. */
(function (root) {
  'use strict';
  const EYE_HEIGHT = 1.85, SUN_DISTANCE = 120, SHADOW_SNAP = 4, SHADOW_FAR = 350;
  const TRANSITION_SECONDS = 2.4, MAX_DT = 10, INDOOR_EXPOSURE = 1.08;
  const COLORS = ['sunColor', 'hemiColor', 'groundColor', 'ambientColor', 'fog', 'top', 'bottom'];
  const SKY_VALUES = ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG'];
  const QUALITY = { high: { size: 2048, radius: 58 }, balanced: { size: 1024, radius: 45 }, low: { size: 0, radius: 45 } };
  const PRESETS = {
    morning: {
      direction: [-.48, .72, -.50], sunColor: '#fffaf2', sunPower: 1.5,
      hemiColor: '#d3e4ff', groundColor: '#a3a9aa', hemiPower: .65,
      ambientColor: '#f4f6fa', ambientPower: .08, exposure: 1,
      fog: '#cdd9e1', top: '#8ab6d6', bottom: '#dce4e6',
      turbidity: 2.2, rayleigh: 1.65, mieCoefficient: .0035, mieDirectionalG: .78, glow: 0,
    },
    golden: {
      direction: [.64, .24, -.73], sunColor: '#ffdaaa', sunPower: 1.3,
      hemiColor: '#b7ceef', groundColor: '#b7a799', hemiPower: .58,
      ambientColor: '#ececf0', ambientPower: .07, exposure: .98,
      fog: '#d4c7b8', top: '#8cabc9', bottom: '#ecd8bb',
      turbidity: 2.6, rayleigh: 2.1, mieCoefficient: .005, mieDirectionalG: .78, glow: 0,
    },
    dusk: {
      direction: [.94, .02, .34], sunColor: '#b6c6e3', sunPower: .08,
      hemiColor: '#a9bfe3', groundColor: '#68768b', hemiPower: .35,
      ambientColor: '#bdcbe1', ambientPower: .06, exposure: .92,
      fog: '#7f93b0', top: '#627caa', bottom: '#99a7bf',
      turbidity: 2, rayleigh: 3.2, mieCoefficient: .003, mieDirectionalG: .76, glow: .18,
    },
  };
  const has = (object, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(object, key);
  const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
  const cloneable = value => value && (value.isColor || value.isVector3 || value.isVector2);
  function color(target, channels) {
    if (target && (target.r !== channels[0] || target.g !== channels[1] || target.b !== channels[2])) target.setRGB(...channels);
  }
  function vector(target, x, y, z) {
    if (target.x === x && target.y === y && target.z === z) return false;
    target.set(x, y, z);
    return true;
  }
  function blend(from, to, progress) {
    return Object.fromEntries(Object.entries(to).map(([key, end]) => [key, Array.isArray(end)
      ? end.map((value, i) => from[key][i] + (value - from[key][i]) * progress)
      : from[key] + (end - from[key]) * progress]));
  }

  /**
   * Owns the supplied lighting after legacy climate; shared GPU resources stay with the caller.
   * @param {{scene:object,renderer:object,camera:object,sky:object,sun:object,hemiLight:object,ambientLight:object,world?:object,reduced?:boolean}} options
   * @returns {{setTime:Function,tick:Function,setQuality:Function,readonly time:string,diagnostics:Function,dispose:Function}}
   */
  function create({ scene, renderer, camera, sky, sun, hemiLight, ambientLight, world = {}, reduced = false } = {}) {
    const T = root.THREE;
    if (!T || !scene || !renderer || !camera?.position || !sun?.target || !hemiLight || !ambientLight) {
      throw new TypeError('V3 environment requires a scene, renderer, camera and existing daylight lights.');
    }
    // r128 lighting is linear; its fog is mixed after output encoding and uses display colors.
    const presets = Object.fromEntries(Object.entries(PRESETS).map(([name, preset]) => [name, {
      ...preset, direction: new T.Vector3(...preset.direction).normalize().toArray(),
      ...Object.fromEntries(COLORS.map(key => {
        const value = new T.Color(preset[key]);
        return [key, (key === 'fog' ? value : value.convertSRGBToLinear()).toArray()];
      })),
    }]));
    const uniforms = sky?.material?.uniforms || {};
    const warmWindow = new T.Color('#ffe1b4').convertSRGBToLinear().toArray();
    const originalMapSize = sun.shadow.mapSize.clone();
    let time = 'morning', quality = 'balanced', state = presets.morning, transition = null;
    let context = { indoors: false, mode: 'walk' }, disposed = false, glows = new Map(), restores = [];

    function remember(object, keys) {
      if (!object) return;
      restores = [...restores, ...keys.map(key => {
        const saved = cloneable(object[key]) ? object[key].clone() : object[key];
        return () => { if (cloneable(saved)) object[key].copy(saved); else object[key] = saved; };
      })];
    }
    remember(renderer, ['toneMappingExposure']);
    remember(renderer.shadowMap, ['enabled']);
    remember(sun, ['color', 'intensity', 'position', 'castShadow']);
    remember(sun.target, ['position']);
    remember(sun.shadow, ['mapSize']);
    remember(sun.shadow.camera, ['left', 'right', 'top', 'bottom', 'far']);
    remember(hemiLight, ['color', 'groundColor', 'intensity']);
    remember(ambientLight, ['color', 'intensity']);
    remember(scene.fog, ['color', 'near', 'far']);
    remember(scene, ['background']);
    for (const uniform of Object.values(uniforms)) remember(uniform, ['value']);

    function collectGlows() {
      function collect(material) {
        if (!material?.emissive?.isColor || !Number.isFinite(material.emissiveIntensity) || glows.has(material)) return;
        glows = new Map([...glows, [material, { color: material.emissive.clone(), intensity: material.emissiveIntensity }]]);
        if (material.emissive.r + material.emissive.g + material.emissive.b === 0) color(material.emissive, warmWindow);
      }
      scene.traverse(object => {
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (material?.userData?.v3WindowGlow === true) collect(material);
        }
      });
      if (Array.isArray(world?.lampLamps)) for (const entry of world.lampLamps) {
        for (const material of entry?.isMaterial ? [entry] : Array.isArray(entry?.material) ? entry.material : [entry?.material]) collect(material);
      }
    }

    function applySun() {
      const overview = context.mode === 'overview';
      const x = overview ? 0 : Math.round(finite(camera.position.x) / SHADOW_SNAP) * SHADOW_SNAP;
      const z = overview ? 20 : Math.round(finite(camera.position.z) / SHADOW_SNAP) * SHADOW_SNAP;
      // Keep floor height independent of XZ snapping; camera eye height can change floors.
      const y = context.mode === 'overview' ? 0 : finite(camera.position.y, EYE_HEIGHT) - EYE_HEIGHT;
      const [dx, dy, dz] = state.direction, distance = SUN_DISTANCE / Math.hypot(dx, dy, dz);
      const moved = vector(sun.target.position, x, y, z);
      const changed = vector(sun.position, x + dx * distance, y + dy * distance, z + dz * distance);
      if (moved) sun.target.updateMatrixWorld(true);
      if (changed || moved) sun.shadow.needsUpdate = true;
      if (uniforms.sunPosition) vector(uniforms.sunPosition.value, dx * distance, dy * distance, dz * distance);
      color(sun.color, state.sunColor);
      if (sun.intensity !== state.sunPower) sun.intensity = state.sunPower;
    }

    function apply() {
      applySun();
      color(hemiLight.color, state.hemiColor); color(hemiLight.groundColor, state.groundColor);
      color(ambientLight.color, state.ambientColor);
      if (hemiLight.intensity !== state.hemiPower) hemiLight.intensity = state.hemiPower;
      if (ambientLight.intensity !== state.ambientPower) ambientLight.intensity = state.ambientPower;
      for (const key of SKY_VALUES) if (uniforms[key] && uniforms[key].value !== state[key]) uniforms[key].value = state[key];
      if (uniforms.top) color(uniforms.top.value, state.top);
      if (uniforms.bottom) color(uniforms.bottom.value, state.bottom);
      if (scene.fog) {
        color(scene.fog.color, state.fog);
        const near = context.mode === 'overview' ? 350 : 170, far = context.mode === 'overview' ? 1200 : 600;
        if (scene.fog.near !== near) scene.fog.near = near;
        if (scene.fog.far !== far) scene.fog.far = far;
      }
      if (scene.background?.isColor) color(scene.background, state.fog);
      const exposure = state.exposure * (context.indoors ? INDOOR_EXPOSURE : 1);
      if (renderer.toneMappingExposure !== exposure) renderer.toneMappingExposure = exposure;
      for (const material of glows.keys()) if (material.emissiveIntensity !== state.glow) material.emissiveIntensity = state.glow;
    }

    /** @param {'morning'|'golden'|'dusk'} name @param {boolean} [instant=false] @returns {boolean} */
    function setTime(name, instant = false) {
      if (disposed || !has(presets, name)) return false;
      collectGlows();
      if (name !== time || instant || reduced) {
        time = name;
        transition = instant || reduced ? null : { from: state, to: presets[name], elapsed: 0 };
        if (!transition) state = presets[name];
      }
      apply();
      return true;
    }

    /** @param {number} dt @param {boolean} indoors @param {'walk'|'overview'} mode @returns {{transitioning:number}} */
    function tick(dt, indoors, mode) {
      if (disposed) return { transitioning: 0 };
      const previousMode = context.mode;
      context = { indoors: indoors === true, mode: mode === 'overview' ? 'overview' : 'walk' };
      if (context.mode !== previousMode) setQuality(quality);
      if (transition) {
        const elapsed = Math.min(TRANSITION_SECONDS, transition.elapsed + Math.max(0, Math.min(MAX_DT, finite(dt))));
        const progress = elapsed / TRANSITION_SECONDS;
        state = progress === 1 ? transition.to : blend(transition.from, transition.to, 1 - Math.pow(1 - progress, 3));
        transition = progress === 1 ? null : { ...transition, elapsed };
      }
      apply();
      return { transitioning: transition ? 1 : 0 };
    }

    function releaseShadowMap() {
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    /** @param {'high'|'balanced'|'low'} tier @returns {boolean} */
    function setQuality(tier) {
      if (disposed || !has(QUALITY, tier)) return false;
      quality = tier;
      const { size } = QUALITY[tier], radius = context.mode === 'overview' ? 190 : QUALITY[tier].radius;
      const shadow = sun.shadow, camera = shadow.camera;
      if (renderer.shadowMap) renderer.shadowMap.enabled = size > 0;
      sun.castShadow = size > 0;
      if (size && (shadow.mapSize.x !== size || shadow.mapSize.y !== size)) {
        releaseShadowMap(); shadow.mapSize.set(size, size);
      }
      if (camera.left !== -radius || camera.right !== radius || camera.top !== radius || camera.bottom !== -radius || camera.far !== SHADOW_FAR) {
        camera.left = camera.bottom = -radius; camera.right = camera.top = radius; camera.far = SHADOW_FAR;
        camera.updateProjectionMatrix();
      }
      shadow.needsUpdate = true;
      if (renderer.shadowMap) renderer.shadowMap.needsUpdate = true;
      return true;
    }

    /** @returns {{time:string,quality:string,transitioning:number,glowMaterials:number,disposed:boolean}} */
    function diagnostics() {
      return { time, quality, transitioning: transition ? 1 : 0, glowMaterials: glows.size, disposed };
    }
    /** @returns {void} */
    function dispose() {
      if (disposed) return;
      disposed = true; transition = null;
      if (!sun.shadow.mapSize.equals(originalMapSize)) releaseShadowMap();
      for (const [material, saved] of glows) { material.emissive.copy(saved.color); material.emissiveIntensity = saved.intensity; }
      for (const restore of restores) restore();
      sun.shadow.camera.updateProjectionMatrix(); sun.target.updateMatrixWorld(true);
      sun.shadow.needsUpdate = true;
      if (renderer.shadowMap) renderer.shadowMap.needsUpdate = true;
      glows = new Map(); restores = [];
    }

    collectGlows(); setQuality(quality); apply();
    return { setTime, tick, setQuality, get time() { return time; }, diagnostics, dispose };
  }
  root.HaizV3Environment = Object.freeze({ create });
})(window);
