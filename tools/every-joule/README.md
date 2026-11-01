# Every Joule · 授权后离线封装工作流

**状态：准备完成；尚未获得或导入原作者课程源文件。** 当前分支不会自动抓取 Every Joule 网站，也不会将在线 iframe 冒充为离线课程。

## 需要 Techartist 授权的内容

请求作者书面同意：完整 10 节课（包括源码、Three.js/WebGL 相关模块、着色器、3D 模型、纹理、字体、声音、教学文字与教师资料）在 HAIZ 中**复制、存储、离线运行**。如果要部署到公开的 `haiz.space`、GitHub Releases 或 APK/IPA，必须明确包含**公开托管和向用户再分发**的许可；单纯“免费用于学习”不一定覆盖这些行为。请作者说明署名方式、第三方资源、是否允许修改路径/制作兼容性补丁，以及是否要求保留某些说明。

**请作者优先提供“浏览器可直接启动的完整静态导出文件夹或 ZIP”**（顶层带 `index.html`，无任何 CDN/API/网络依赖），另附 LICENSE/授权回复。网页上的压缩 JS 文件可能无法直接成为可靠的离线工程，源工程和构建说明更好。

## 授权后安装

将作者给的 ZIP 解压到一个仅在本机使用的目录，不要把授权邮件、个人邮箱等隐私内容上传 GitHub。把作者同意的授权说明保存成一个本地文本文件。

```sh
node tools/every-joule/import-authorized.mjs \
  --source "/Users/you/Downloads/EveryJoule-export" \
  --permission-file "/Users/you/Documents/every-joule-permission.txt"
```

导入器进行静态资源检查，拒绝绝对根路径、缺失文件和明确的外部依赖；通过后复制文件到 `every-joule-offline/app/` 并生成 `offline-index.json`。

**完整的离线验证仍需在真实浏览器中测试：** 用本地静态服务器访问 `/every-joule-offline/`，选择“下载完整离线资源”，然后断开网络、关闭并重新打开浏览器，逐节测试十课、3D、音频、测验及教师资料。静态检查无法识别所有动态加载。

```sh
python3 -m http.server 8000
# 打开 http://localhost:8000/every-joule-offline/
```

## 分发要求

本目录的导入产物已列入 `.gitignore`，不会自动发布。只有原作者明确允许公开再分发、且逐项核对第三方依赖的许可后，才人工决定是否将其纳入 HAIZ 公共仓库、独立离线 ZIP 和 APK/IPA。不能把授权证据或作者私有源码上传到公开仓库，除非授权允许。

与原作源码不同，本工程的浏览器容器、缓存服务与导入器是独立编写的代码。**这不是原作的重制或改编，也没有修改原作者课程的内容。**

## 故障检查

- `externalDependencies` 有值：资源仍要访问外网；向作者请求静态替代文件，不要把原站复制下来绕过许可。
- `missingReferences` 有值：资源包不完整，需作者补齐。
- `rootAbsoluteReferences` 有值：原版依赖站点根路径，需经作者允许做路径适配或单独部署到根路径。
- 若离线模式只出现背景：可能缺运行时动态资源、WebGL 或浏览器缓存配额，使用真实设备网络屏蔽测试，不要宣布离线成功。
