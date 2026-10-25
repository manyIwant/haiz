// Optional private CI key. Never print key bytes, aliases, passwords, or environment contents.
import {writeFileSync,appendFileSync,mkdirSync} from 'node:fs';import path from 'node:path';
const names=['HAIZ_ANDROID_KEYSTORE_BASE64','HAIZ_KEYSTORE_PASSWORD','HAIZ_KEY_ALIAS','HAIZ_KEY_PASSWORD'];
const present=names.filter(n=>process.env[n]);
if(present.length&&present.length!==names.length)throw Error('Incomplete protected signing configuration; refusing a partial fallback');
const stable=present.length===names.length;
if(stable){const dir=process.env.RUNNER_TEMP;if(!dir)throw Error('Protected CI signing requires RUNNER_TEMP');mkdirSync(dir,{recursive:true});const file=path.join(dir,'haiz-preview-private.jks');writeFileSync(file,Buffer.from(process.env.HAIZ_ANDROID_KEYSTORE_BASE64,'base64'),{mode:0o600});appendFileSync(process.env.GITHUB_ENV,'HAIZ_KEYSTORE_PATH='+file+'\n');}
if(process.env.GITHUB_ENV)appendFileSync(process.env.GITHUB_ENV,'HAIZ_SIGNING_TYPE='+(stable?'protected-preview-key':'ephemeral-debug-key')+'\n');
console.log(stable?'Protected preview signing selected; no key material logged.':'No protected key configured. Ephemeral debug candidate; cross-build update compatibility NOT guaranteed.');
