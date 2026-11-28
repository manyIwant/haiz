// @ts-nocheck — loader glue
/**
 * The real HAIZ assets, loaded once per session and shared by every page that shows them
 * (003's asset-cache, on 006's paths). The tree and the campus are the same files the main site
 * and Experiment 003 use: lanren/assets/{tree,island}.glb, rosettes.bin, tree.json and
 * lanren/assets/campus-v3/architecture.glb (Blender V3, meshopt-compressed).
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const base = () => new URL("./", document.baseURI).href;
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const tex = new THREE.TextureLoader();
const cache: Record<string, Promise<any>> = {};
const once = (k: string, f: () => Promise<any>) => (cache[k] ??= f());

export const loadGLB = (path: string) => once("glb:" + path, () => loader.loadAsync(base() + path));
export const loadTexture = (path: string, { srgb = true, repeat = 1 } = {}) =>
  once(`tex:${path}:${srgb}:${repeat}`, () => tex.loadAsync(base() + path).then((t) => {
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = 4;
    return t;
  }));

export function loadTerminalia() {
  return once("terminalia", () => Promise.all([
    loadGLB("models/tree.glb"),
    loadGLB("models/island.glb"),
    fetch(base() + "models/rosettes.bin").then((r) => r.arrayBuffer()).then((b) => new Float32Array(b)),
    fetch(base() + "models/tree.json").then((r) => r.json()),
    loadTexture("tex/bark-color.jpg", { srgb: true, repeat: 4 }),
    loadTexture("tex/bark-normal.jpg", { srgb: false, repeat: 4 }),
    loadTexture("tex/leaf-atlas-lo.webp", { srgb: true, repeat: 1 }),
  ]).then(([tree, island, rosettes, meta, barkColor, barkNormal, leafAtlas]) => ({ tree: tree.scene, island: island.scene, rosettes, meta, barkColor, barkNormal, leafAtlas })));
}

export const loadArchitecture = () => loadGLB("models/architecture.glb");
