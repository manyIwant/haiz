/* Exact full-attribute vertex welding. No quantization, simplification or codecs. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'public/haiz/world/v3/assets');
const reportPath = path.join(root, 'docs/v3/blender-assets.json');
const sizes = { 5120:1, 5121:1, 5122:2, 5123:2, 5125:4, 5126:4 };
const elements = { SCALAR:1, VEC2:2, VEC3:3, VEC4:4 };
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function parse(bytes) {
  if (bytes.toString('ascii',0,4) !== 'glTF' || bytes.readUInt32LE(4) !== 2) throw Error('Expected GLB v2');
  const length = bytes.readUInt32LE(12);
  return { json:JSON.parse(bytes.toString('utf8',20,20+length)),bin:bytes.subarray(28+length) };
}
function compact(bytes) {
  const { json, bin } = parse(bytes);
  if (json.animations?.length || json.skins?.length) throw Error('Only static region models are supported');
  const accessors = [], views = [], chunks = [], cache = new Map(); let byteLength = 0;
  function view(data, target) {
    const key = target + ':' + hash(data);
    if (cache.has(key)) return cache.get(key);
    const padded = Buffer.alloc(Math.ceil(data.length/4)*4); data.copy(padded);
    const index = views.length; views.push({ buffer:0,byteOffset:byteLength,byteLength:data.length,...(target?{target}:{}) });
    chunks.push(padded); byteLength += padded.length; cache.set(key,index); return index;
  }
  function accessor(sourceIndex, data, count) {
    const source = json.accessors[sourceIndex];
    if (source.sparse) throw Error('Sparse accessors require an explicit adapter');
    const index = accessors.length;
    accessors.push({ ...source,bufferView:view(data,34962),byteOffset:0,count });
    return index;
  }
  function sourceBytes(index) {
    const a = json.accessors[index], v = json.bufferViews[a.bufferView], width = sizes[a.componentType]*elements[a.type];
    if (!width || a.sparse) throw Error('Unsupported accessor format');
    return { a,width,stride:v.byteStride||width,offset:(v.byteOffset||0)+(a.byteOffset||0) };
  }
  const meshes = json.meshes.map(mesh => ({ ...mesh,primitives:mesh.primitives.map(primitive => {
    if (primitive.targets || (primitive.mode??4)!==4 || primitive.indices===undefined) throw Error('Expected indexed static triangles');
    const fields = Object.entries(primitive.attributes).map(([name,index]) => ({name,index,...sourceBytes(index)}));
    const vertices = fields[0].a.count, tupleSize = fields.reduce((n,f)=>n+f.width,0);
    if (fields.some(f=>f.a.count!==vertices)) throw Error('Inconsistent vertex attributes');
    const tuples = Buffer.allocUnsafe(vertices*tupleSize), lookup = new Map(), remap = new Uint32Array(vertices); let unique = 0;
    for (let i=0;i<vertices;i++) {
      let offset=i*tupleSize;
      for (const f of fields) { bin.copy(tuples,offset,f.offset+i*f.stride,f.offset+i*f.stride+f.width); offset+=f.width; }
      const key=tuples.toString('base64',i*tupleSize,(i+1)*tupleSize);
      if (!lookup.has(key)) lookup.set(key,unique++);
      remap[i]=lookup.get(key);
    }
    const attributes = Object.fromEntries(fields.map(f=>{
      const data=Buffer.allocUnsafe(unique*f.width);
      for (let i=0;i<vertices;i++) bin.copy(data,remap[i]*f.width,f.offset+i*f.stride,f.offset+i*f.stride+f.width);
      return [f.name,accessor(f.index,data,unique)];
    }));
    const old = sourceBytes(primitive.indices), type=unique<=65535?5123:5125, width=sizes[type];
    const indices=Buffer.allocUnsafe(old.a.count*width);
    for(let i=0;i<old.a.count;i++) {
      const at=old.offset+i*old.stride;
      const value=old.a.componentType===5125?bin.readUInt32LE(at):bin.readUInt16LE(at);
      if(value>=vertices)throw Error('Index exceeds vertex count');
      if(type===5125)indices.writeUInt32LE(remap[value],i*width);else indices.writeUInt16LE(remap[value],i*width);
    }
    const index=accessors.length;accessors.push({bufferView:view(indices,34963),componentType:type,count:old.a.count,type:'SCALAR'});
    return {...primitive,attributes,indices:index};
  }) }));
  const images=(json.images||[]).map(image=>{
    if(image.uri)throw Error('Expected embedded textures');
    const source=json.bufferViews[image.bufferView],start=source.byteOffset||0;
    return {...image,bufferView:view(bin.subarray(start,start+source.byteLength))};
  });
  const result={...json,meshes,images,accessors,bufferViews:views,buffers:[{byteLength}]};
  const text=Buffer.from(JSON.stringify(result)),jsonChunk=Buffer.alloc(Math.ceil(text.length/4)*4,32);text.copy(jsonChunk);
  const binary=Buffer.concat(chunks),header=Buffer.alloc(20),binHeader=Buffer.alloc(8);
  header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+jsonChunk.length+binary.length,8);header.writeUInt32LE(jsonChunk.length,12);header.write('JSON',16);
  binHeader.writeUInt32LE(binary.length);binHeader.write('BIN\0',4);
  return Buffer.concat([header,jsonChunk,binHeader,binary]);
}
const report=JSON.parse(fs.readFileSync(reportPath,'utf8'));
for(const tier of ['full','mobile']) {
  const record=report.assets[tier],file=path.join(directory,record.file),before=fs.readFileSync(file);
  if(hash(before)!==record.sha256)throw Error('Asset differs from manifest: '+file);
  const after=compact(before),{json}=parse(after),primitives=json.meshes.flatMap(m=>m.primitives);
  if(after.length>=before.length)throw Error('No size reduction; original asset retained');
  fs.writeFileSync(file+'.compacted',after);fs.renameSync(file+'.compacted',file);
  report.assets[tier]={...record,bytes:after.length,sha256:hash(after),counts:{...record.counts,vertices:primitives.reduce((n,p)=>n+json.accessors[p.attributes.POSITION].count,0)},compaction:{method:'Exact complete-attribute vertex welding and shared buffer deduplication; no simplification or quantization',inputBytes:before.length,inputSha256:hash(before)}};
  process.stdout.write(`${tier}: ${before.length} -> ${after.length} bytes; ${record.counts.vertices} -> ${report.assets[tier].counts.vertices} vertex records\n`);
}
report.compactedUtc=new Date().toISOString();fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
