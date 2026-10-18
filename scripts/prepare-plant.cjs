// Reproducible, lossless geometry/texture extraction from the licensed upstream GLB.
// Keep pot + foliage; omit fireflies, lights, animations, dense gravel and the
// newer diffuse-transmission extension unsupported by this site's Three r128.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const [source,output]=process.argv.slice(2);if(!source||!output)throw Error('Usage: node scripts/prepare-plant.cjs source.glb output.glb');
const input=fs.readFileSync(source);if(input.readUInt32LE(0)!==0x46546c67||input.readUInt32LE(4)!==2)throw Error('Expected GLB v2');
const jsonLength=input.readUInt32LE(12),original=JSON.parse(input.subarray(20,20+jsonLength)),bin=input.subarray(28+jsonLength);
const model={asset:{version:'2.0',generator:'haiz lossless plant extraction',copyright:'Rico Cilliers / Poly Haven (2021 CC0); Eric Chadwick / Darmstadt Graphics Group (2024 CC-BY-4.0). See models/NOTICE.md.'},scene:0,scenes:[{nodes:[0,1]}],nodes:original.nodes.slice(0,2),meshes:original.meshes.slice(0,2),materials:original.materials.slice(0,2),samplers:original.samplers};
for(const m of model.materials){delete m.extensions;delete m.emissiveFactor;delete m.emissiveTexture;}
const accessors=[...new Set(model.meshes.flatMap(m=>m.primitives.flatMap(p=>[p.indices,...Object.values(p.attributes)])))];
const remapA=new Map(accessors.map((n,i)=>[n,i]));model.accessors=accessors.map(n=>structuredClone(original.accessors[n]));
for(const m of model.meshes)for(const p of m.primitives){p.indices=remapA.get(p.indices);for(const k of Object.keys(p.attributes))p.attributes[k]=remapA.get(p.attributes[k]);}
const textureIds=new Set();function textures(o,replace){for(const [k,v]of Object.entries(o)){if(v&&typeof v==='object'){if(k.endsWith('Texture')&&Number.isInteger(v.index)){if(replace)v.index=replace.get(v.index);else textureIds.add(v.index);}else textures(v,replace);}}}
model.materials.forEach(m=>textures(m));const ids=[...textureIds],remapT=new Map(ids.map((n,i)=>[n,i]));model.materials.forEach(m=>textures(m,remapT));
model.textures=ids.map(n=>structuredClone(original.textures[n]));const imageIds=[...new Set(model.textures.map(t=>t.source))],remapI=new Map(imageIds.map((n,i)=>[n,i]));model.images=imageIds.map(n=>structuredClone(original.images[n]));model.textures.forEach(t=>t.source=remapI.get(t.source));
const views=[...new Set([...model.accessors.map(a=>a.bufferView),...model.images.map(i=>i.bufferView)])],remapV=new Map(views.map((n,i)=>[n,i])),chunks=[];let offset=0;
model.bufferViews=views.map(n=>{const v=original.bufferViews[n],padding=(4-offset%4)%4;if(padding){chunks.push(Buffer.alloc(padding));offset+=padding;}const data=bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength),out={...v,buffer:0,byteOffset:offset};chunks.push(data);offset+=data.length;return out;});
model.accessors.forEach(a=>a.bufferView=remapV.get(a.bufferView));model.images.forEach(i=>i.bufferView=remapV.get(i.bufferView));model.buffers=[{byteLength:offset}];
const rawJson=Buffer.from(JSON.stringify(model)),json=Buffer.concat([rawJson,Buffer.alloc((4-rawJson.length%4)%4,32)]),packed=Buffer.concat([...chunks,Buffer.alloc((4-offset%4)%4)]),header=Buffer.alloc(20),binHeader=Buffer.alloc(8);
header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+packed.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);binHeader.writeUInt32LE(packed.length,0);binHeader.writeUInt32LE(0x004e4942,4);
const result=Buffer.concat([header,json,binHeader,packed]);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,result);console.log(JSON.stringify({bytes:result.length,sourceSha256:crypto.createHash('sha256').update(input).digest('hex'),sha256:crypto.createHash('sha256').update(result).digest('hex'),meshes:model.meshes.length,images:model.images.length}));
