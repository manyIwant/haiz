import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {getPhotoReference,REVIEWED_PHOTOS,WITHHELD_PHOTOS} from '../src/photoReferences.js';

const campus=JSON.parse(readFileSync(new URL('../public/haiz/assets/walk/campus.json',import.meta.url),'utf8'));

test('all 34 original nodes have an explicit photo-evidence state',()=>{
  assert.equal(campus.buildings.length,34);
  for(const place of campus.buildings){
    const photo=getPhotoReference(place);
    assert.ok(['verified-historical','bundled-reviewed','withheld','candidate','missing'].includes(photo.status));
    assert.equal(typeof photo.label,'string');assert.equal(typeof photo.limit,'string');assert.ok(Array.isArray(photo.features));
    if(photo.image)assert.ok(!/meilun|campus_yanlintang|xxgk-yanlintang/.test(photo.image));
  }
});

test('reviewed image files are local real JPEGs, not remote hotlinks or missing placeholders',()=>{
  for(const photo of Object.values(REVIEWED_PHOTOS)){
    assert.ok(photo.image.startsWith('/haiz/assets/images/'));
    const file=new URL('../public'+photo.image,import.meta.url);
    assert.ok(statSync(file).size>1000);assert.equal(readFileSync(file).subarray(0,3).toString('hex'),'ffd8ff');
    assert.ok(photo.alt.length>8);assert.ok(photo.features.length>0);
  }
});

test('the newly sourced entrance photograph preserves its author, historical date and CC0 provenance',()=>{
  const photo=getPhotoReference({id:'beimen'});
  assert.equal(photo.status,'verified-historical');assert.equal(photo.author,'Anna Frodesiak');
  assert.equal(photo.date,'2013-09-22');assert.equal(photo.license,'CC0 1.0');
  assert.equal(new URL(photo.source).hostname,'commons.wikimedia.org');assert.ok(photo.limit.includes('不代表当前'));
});

test('existing project photos are not relabelled as independently verified online sources',()=>{
  for(const id of ['yihao','erhao','library','fengqitang','yanchi','kexue','yundong']){
    const photo=getPhotoReference({id});
    assert.equal(photo.status,'bundled-reviewed');assert.equal(photo.date,null);assert.equal(photo.license,null);assert.equal(photo.source,undefined);
    for(const link of photo.links)assert.equal(new URL(link.url).protocol,'https:');
  }
});

test('known wrong-building and ambiguous pavilion photographs stay withheld',()=>{
  for(const id of Object.keys(WITHHELD_PHOTOS)){
    const photo=getPhotoReference({id,image:'assets/images/campus/campus_yanlintang.jpg'});
    assert.equal(photo.image,null);assert.equal(photo.status,'withheld');
  }
});

test('unknown, other-campus and corridor references never invent an image',()=>{
  for(const id of ['__proto__','constructor','corr_w12','unknown'])assert.equal(getPhotoReference({id}).image,null);
  for(const image of ['assets/images/campus/campus_meilun_gate.jpg','https://example.invalid/photo.jpg','../../photo.jpg']){
    const photo=getPhotoReference({id:'unknown',image});assert.equal(photo.image,null);assert.equal(photo.status,'missing');
  }
  const candidate=getPhotoReference({id:'dorm_f',image:'assets/images/campus/campus_dorm_f.jpg'});
  assert.equal(candidate.status,'candidate');assert.equal(candidate.image,null);
});
