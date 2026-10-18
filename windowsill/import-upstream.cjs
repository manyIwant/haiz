/* SPDX-License-Identifier: AGPL-3.0-only
 * haiz windowsill distribution helper, 2026-10-18.
 * Copies reviewed upstream sources, not executable installation scripts.
 * Do not rerun over a customized scene. See SOURCE.md for the pinned revisions.
 */
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto');
const [qiaosi, three, icons, tablerLicense] = process.argv.slice(2);
const dest = __dirname;
if (!qiaosi || !three || !icons || !tablerLicense) throw Error('Usage: node import-upstream.cjs QIAOSI_CHECKOUT THREE_PACKAGE ICONS_CHECKOUT TABLER_LICENSE');
const pinned = {qiaosi:'309508f1ce637269638810d9b1e43cb5d1aeb7bd',icons:'5ecb58513b66f9dd801fb2542d588ebd96f9f9b5'};
for (const [name, dir] of [['qiaosi', qiaosi], ['icons', icons]]) if (cp.execFileSync('git',['rev-parse','HEAD'],{cwd:dir,encoding:'utf8'}).trim() !== pinned[name]) throw Error('Unexpected '+name+' revision');
if (JSON.parse(fs.readFileSync(path.join(three,'package.json'))).version !== '0.170.0') throw Error('Expected verified Three 0.170.0 package');
if (fs.existsSync(path.join(dest,'scene','src'))) throw Error('Scene already exists; refusing to overwrite customized sources');
const manifest = {qiaosi:{repository:'https://github.com/TangfanOVO/qiaosi',commit:pinned.qiaosi,license:'AGPL-3.0-only'},icons:{repository:'https://github.com/TangfanOVO/fanfan-icons',commit:pinned.icons,license:'MIT'},three:{version:'0.170.0',integrity:'sha512-FQK+LEpYc0fBD+J8g6oSEyyNzjp+Q7Ks1C568WWaoMRLW+TkNNWmenWeGgJjV105Gd+p/2ql1ZcjYvNiPZBhuQ==',license:'MIT'},files:[]};
function copy(from,to,source){fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);manifest.files.push({file:path.relative(dest,to).replaceAll(path.sep,'/'),source,sha256:crypto.createHash('sha256').update(fs.readFileSync(from)).digest('hex')});}
function tree(from,to,source){for(const e of fs.readdirSync(from,{withFileTypes:true})){const f=path.join(from,e.name),t=path.join(to,e.name);if(e.isDirectory())tree(f,t,source);else copy(f,t,source);}}
tree(path.join(qiaosi,'scenes/windowsill/src'),path.join(dest,'scene/src'),'qiaosi');
tree(path.join(qiaosi,'scenes/windowsill/models'),path.join(dest,'scene/models'),'qiaosi');
tree(path.join(qiaosi,'scenes/windowsill/blender'),path.join(dest,'scene/blender'),'qiaosi');
copy(path.join(qiaosi,'scenes/windowsill/build.mjs'),path.join(dest,'scene/build.mjs'),'qiaosi');
copy(path.join(qiaosi,'scenes/windowsill/README.md'),path.join(dest,'scene/UPSTREAM-README.md'),'qiaosi');
copy(path.join(qiaosi,'LICENSE'),path.join(dest,'LICENSE'),'qiaosi');
copy(path.join(qiaosi,'COMMERCIAL.md'),path.join(dest,'UPSTREAM-COMMERCIAL.md'),'qiaosi');
for(const file of ['voice-note.js','voice-note.css','README.md'])copy(path.join(qiaosi,'components/voice-note',file),path.join(dest,'vendor/voice-note',file),'qiaosi');
copy(path.join(three,'LICENSE'),path.join(dest,'vendor/three/LICENSE'),'three');
copy(tablerLicense,path.join(dest,'vendor/voice-note/TABLER-LICENSE'),'tabler');
copy(path.join(icons,'LICENSE'),path.join(dest,'vendor/fanfan/LICENSE'),'fanfan');
for(const name of ['cat-book','cat-clock','cat-coffee','cat-mail','cat-music','cat-star'])copy(path.join(icons,'svg/thin',name+'.svg'),path.join(dest,'vendor/fanfan',name+'.svg'),'fanfan');
const seen=new Set();
function moduleFile(file){
  file=path.resolve(file);if(!file.startsWith(path.resolve(three)+path.sep))throw Error('Module escaped Three package');if(seen.has(file))return;seen.add(file);
  copy(file,path.join(dest,'vendor/three',path.relative(three,file)),'three');
  const source=fs.readFileSync(file,'utf8');
  for(const m of source.matchAll(/(?:\bfrom\s*|\bimport\s*\()\s*['"]([^'"]+)['"]/g)){const spec=m[1];if(spec==='three')moduleFile(path.join(three,'build/three.module.js'));else if(spec.startsWith('.'))moduleFile(path.resolve(path.dirname(file),spec));}
}
moduleFile(path.join(three,'build/three.module.js'));
const setup=fs.readFileSync(path.join(dest,'scene/src/js/00-setup.js'),'utf8');
for(const m of setup.matchAll(/from\s*['"]three\/addons\/([^'"]+)['"]/g))moduleFile(path.join(three,'examples/jsm',m[1]));
fs.writeFileSync(path.join(dest,'upstream-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Imported reviewed qiaosi scene, four glTF furniture models, voice-note and six MIT icons; '+seen.size+' local Three modules.');
