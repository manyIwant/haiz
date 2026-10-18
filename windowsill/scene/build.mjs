/* SPDX-License-Identifier: AGPL-3.0-only
 * Modified for haiz campus, 2026-10-18. Original © 2026 幡幡 (TangfanOVO).
 * Full source, changes and third-party exceptions: windowsill/SOURCE.md.
 */
// 把 src/ 里拆开的几段拼回一个能直接打开的 index.html。
// 用法：node build.mjs   （不需要装任何依赖；Node 18 以上）
// 为什么拼成一个文件：整个场景是一个 ES 模块，各段之间直接共用变量（scene、材质、天色……），
// 拆成独立模块要给几百个名字加 import/export；按顺序拼回去最稳，改哪段就打开哪个文件。
import {readFileSync, writeFileSync, readdirSync} from 'node:fs';

const dir = new URL('./src/js/', import.meta.url);
const parts = readdirSync(dir).filter(f => f.endsWith('.js')).sort();
const js = parts.map(f => readFileSync(new URL(f, dir), 'utf8')).join('');
const tpl = readFileSync(new URL('./src/index.template.html', import.meta.url), 'utf8');
if (!tpl.includes('/*@@SCRIPT@@*/')) throw new Error('模板里找不到 /*@@SCRIPT@@*/');
const notice = '/* SPDX-License-Identifier: AGPL-3.0-only\n * Original qiaosi © 2026 幡幡 (TangfanOVO).\n * Modified for haiz 2026-10-18. See ../SOURCE.md and ../LICENSE.\n */\n';
writeFileSync(new URL('./scene.mjs', import.meta.url), notice + js);
writeFileSync(new URL('./index.html', import.meta.url), tpl.replace('/*@@SCRIPT@@*/', () => "import('./scene.mjs?v=12').catch(error => window.roomLoadFailure(error));"));
console.log(`index.html ← ${parts.length} 段，${(js.length / 1024).toFixed(0)} KB 脚本`);
