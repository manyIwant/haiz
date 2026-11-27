import { Color, Vector3 } from 'three';

/**
 * Shared atmospheric & lens uniform pack compatible with Round 2's CampusAtmosphere
 * and usable standalone in living-character-lab.html.
 */
export function createCharacterShaderUniforms() {
  return {
    uTime: { value: 0 },
    uLensMode: { value: 0 }, // 0: 南海晴光 (PBR + painterly wrap), 1: 入画水粉 (Gouache), 2: Cutaway
    uSunDir: { value: new Vector3(0.55, 0.72, 0.42).normalize() },
    uSunColor: { value: new Color(0xfff0d4) },
    uNight: { value: 0 },
    uRain: { value: 0 },
    uWetness: { value: 0 },
    uWindDir: { value: new Vector3(0.75, 0, 0.65).normalize() },
    uWindStrength: { value: 0.35 },
  };
}

/**
 * Upgrade character MeshStandardMaterials so every model honors:
 *  - Tropical skin & cloth wrap shading + subtle rim separation in NanHai Sunlight
 *  - Authentic 入画 (RuHua) warm gouache pigment quantization, tooth grain, and shadow cooling
 *  - Wet-fabric darkening during tropical rain
 *  - Preserves HAIZ_Kind vertex attribute when present in GLB
 */
export function enhanceCharacterMaterials(root, uniforms) {
  if (!root || !uniforms) return;
  const processed = new Set();

  root.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    const hasKindAttr = Boolean(obj.geometry?.attributes?.COLOR_0 || obj.geometry?.attributes?.color);

    for (const mat of mats) {
      if (!mat || !mat.isMeshStandardMaterial || processed.has(mat)) continue;
      processed.add(mat);

      mat.userData.haizUniforms = uniforms;
      mat.customProgramCacheKey = () => `haiz-living-char-v3-${hasKindAttr ? 'k1' : 'k0'}`;

      const prevCompile = mat.onBeforeCompile;
      mat.onBeforeCompile = (shader, renderer) => {
        if (typeof prevCompile === 'function') prevCompile(shader, renderer);

        shader.uniforms.uTime = uniforms.uTime;
        shader.uniforms.uLensMode = uniforms.uLensMode;
        shader.uniforms.uSunDir = uniforms.uSunDir;
        shader.uniforms.uSunColor = uniforms.uSunColor;
        shader.uniforms.uNight = uniforms.uNight;
        shader.uniforms.uRain = uniforms.uRain;
        shader.uniforms.uWetness = uniforms.uWetness;

        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            `#include <common>
varying vec3 vHaizWorldPos;
varying vec3 vHaizWorldNormal;`
          )
          .replace(
            '#include <worldpos_vertex>',
            `#include <worldpos_vertex>
vec4 haizWp = modelMatrix * vec4(transformed, 1.0);
vHaizWorldPos = haizWp.xyz;
vHaizWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`
          );

        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>
uniform float uTime;
uniform float uLensMode;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uNight;
uniform float uRain;
uniform float uWetness;
varying vec3 vHaizWorldPos;
varying vec3 vHaizWorldNormal;
float haizPaperGrain(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}`
          )
          .replace(
            '#include <dithering_fragment>',
            `
vec3 hwN = normalize(vHaizWorldNormal);
vec3 hwV = normalize(cameraPosition - vHaizWorldPos);
float ndl = dot(hwN, normalize(uSunDir));
float fresnel = pow(1.0 - max(dot(hwN, hwV), 0.0), 2.8);

// Tropical rain fabric dampening
float rainDark = 1.0 - 0.14 * clamp(uWetness + uRain * 0.5, 0.0, 1.0);
gl_FragColor.rgb *= rainDark;

if (uLensMode > 0.5 && uLensMode < 1.5) {
  // 入画水粉 (Gouache art world): warm paper-tooth highlights & cool cobalt shadow wash
  float litBand = smoothstep(-0.18, 0.38, ndl);
  float gouacheStep = floor(litBand * 3.0 + 0.35) / 3.0;
  vec3 warmWash = mix(vec3(0.84, 0.88, 0.98), vec3(1.06, 1.02, 0.94), gouacheStep);
  float grain = (haizPaperGrain(gl_FragCoord.xy * 0.72) - 0.5) * 0.045;
  float edgeInk = smoothstep(0.62, 0.92, fresnel);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * warmWash + grain, 0.58);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(0.45, 0.42, 0.48), edgeInk * 0.28);
} else {
  // 南海晴光 PBR + soft rim light & warm cloth/skin bounce so silhouette reads cleanly
  vec3 rimTint = mix(uSunColor * 0.16, vec3(0.18, 0.22, 0.32), uNight);
  float wrap = max(0.0, (ndl + 0.35) / 1.35);
  gl_FragColor.rgb += gl_FragColor.rgb * uSunColor * (wrap * 0.08 * (1.0 - uNight));
  gl_FragColor.rgb += rimTint * fresnel * 0.55;
}
#include <dithering_fragment>`
          );
      };
      mat.needsUpdate = true;
    }
  });
}
