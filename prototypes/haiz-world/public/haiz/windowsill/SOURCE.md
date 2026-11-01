# 课间窗台：源码与许可

这是一套可独立运行的 AGPL-3.0 应用，改编自幡幡（TangfanOVO）的 **qiaosi**。海岸、书房与四季是想象场景，不是海南中学府城校区的实拍或测绘模型。没有聊天机器人、健康数据、用户账户或上传服务。

## 原作与固定版本

- [qiaosi](https://github.com/TangfanOVO/qiaosi/tree/309508f1ce637269638810d9b1e43cb5d1aeb7bd)，© 2026 幡幡（TangfanOVO），AGPL-3.0。使用了 `scenes/windowsill` 与 `components/voice-note`，未使用演示健康数据。
- [fanfan-icons](https://github.com/TangfanOVO/fanfan-icons/tree/5ecb58513b66f9dd801fb2542d588ebd96f9f9b5)，© 2026 唐幡，MIT。使用六枚 thin 猫咪图标，许可在 [vendor/fanfan/LICENSE](vendor/fanfan/LICENSE)。
- [Three.js 0.170.0](https://github.com/mrdoob/three/tree/r170)，MIT，许可在 [vendor/three/LICENSE](vendor/three/LICENSE)。官方 npm 归档经 SHA-512 完整性核验，仅保留实际需要的 20 个本地模块。与主站原有 Three r128 分开运行。
- 语音组件内含 Tabler 图标路径（MIT），保留 [Tabler 许可](vendor/voice-note/TABLER-LICENSE)。

完整 AGPL 文本：[LICENSE](LICENSE)。原作说明：[scene/UPSTREAM-README.md](scene/UPSTREAM-README.md)、[vendor/voice-note/README.md](vendor/voice-note/README.md)、[UPSTREAM-COMMERCIAL.md](UPSTREAM-COMMERCIAL.md)。

## 完整对应源码与构建

[本应用全部源码、模型、构建工具与依赖](https://github.com/manyIwant/haiz/tree/main/windowsill) 随部署公开。也可在网站直接读取相同路径文件。本目录没有私有构建依赖、服务端组件或密钥。

```sh
git clone https://github.com/manyIwant/haiz.git
cd haiz
node windowsill/scene/build.mjs
npm ci
npm run test:windowsill
```

用任意静态 HTTP 服务器提供整个仓库，打开 `windowsill/index.html`；也可单独部署本目录的应用主体，但指向原网站的普通导航链接需要修改。场景也可直接打开 `scene/index.html`。本机计时、便签和信件不依赖 3D；3D 仅在点击后加载。

`scene/src/index.template.html` 与顺序排列的 `scene/src/js/*.js` 是场景的首选修改形式。`scene/build.mjs` 将其合成为 `scene/index.html` 与 `scene/scene.mjs`。四件精修家具的内嵌 glTF 与原始 Blender 生成脚本完整保留在 `scene/models`、`scene/blender`；不需要 Blender 即可构建或运行网站。`import-upstream.cjs` 是首次导入、固定版本与记录原始哈希的辅助工具，不会覆盖已修改的场景。

## 2026-10-18 的 haiz 修改

- 新增独立纸面界面、`app.js`、`core.js`、样式、实际渲染的场景预览图、测试与本说明；本应用新增代码采用 AGPL-3.0-only。
- 场景 `00-setup`：真实桌面/手机视口、本地模块与有上限的画质；`06-model-loading-helpers`：家具加载状态与重绘；`09-left-writing-corner`、`12-windowsill`：原创校园书信与无虚构播放状态的文案。
- `16-weather`：雷声改为明确按钮后才允许开启；`17-tags-camera-glass`：校园物件入口、轻量画质后处理；`18-input-sliders`：键盘输入保护、物件动作；`19-frame-api`：暂停、后台停止、减少动态时按需渲染；新增 `20-campus-adapter`：同源且限制命令的应用内消息接口。
- 场景模板、本地样式和构建器：来源入口、可访问控件、模块失败与 WebGL 丢失回退；不引入 CDN。
- `vendor/voice-note/voice-note.js`：移除音频指纹持久化；无可用文件或播放失败时不模拟播放成功；添加释放本机音频的方法。实际响度包络取自用户选择的本机声音，配文仅按进度排版，不宣称语音识别或逐字对齐。
- `upstream-manifest.json` 记录导入时的原始文件 SHA-256；以上修改文件的当前哈希自然不同。未改动的模型、Blender 脚本、Three.js、图标及许可仍可据此核验。

## 范围、隐私与限制

此目录以独立页面和独立运行时提供；原站通过普通超链接进入，不将 AGPL 代码导入原有主站脚本。**这不重新授权既有校园照片或整个仓库**。各文件保留自己的许可；未来若把此代码深度合入其他程序，需重新核对 AGPL 的组合作品义务。

便签与信仅用 `haiz.windowsill.v1` 本机存储键，可从本页或主站的隐私工具清除。本机声音上限 20 MiB / 180 秒，仅保留内存 Blob URL，移除或离开页面即释放；不请求麦克风。计时不持久化，刷新会重置；后台用实际截止时间计算，不承诺系统级通知。降低动态偏好会停用连续动画与雷闪，声音始终默认关闭。

作者其他作品只用于审美研究：[同页](https://github.com/TangfanOVO/tongye) 的照片优先与真实数据原则、[赴约](https://github.com/TangfanOVO/fuyue) 的本地优先和外观组织。**未复制同页私人照片、未添加模型接口或演示私人数据**。

预览图和软件 WebGL 测试不能证明真机帧率，也不能证明照片级复刻。四季中的冬雪仅是原作的想象模式，不是海口真实天气。
