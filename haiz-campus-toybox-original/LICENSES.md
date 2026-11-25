# LICENSES · 第三方依赖与原创素材许可说明

## 一、原创内容声明

本项目中的所有以下内容均为 **100% 从零原创设计并由程序代码生成**，未引用任何第三方商业 IP、外部 3D 模型、外部位图纹理或外部音频文件：

- 6 位原创角色模型与动画系统（`src/toys/characters/*.js`、`assets/models/*.glb`）
- 海南骑楼微缩抓娃娃机三维设计（`src/machine/cabinet.js`）
- 全部程序化 PBR 纹理（羊毛毡法线、短绒法线、帆布法线、水磨石、石灰洗墙面、柚木纹理、榄仁树叶壁纸，`src/toys/kit/textures.js`、`assets/textures/*.png`）
- 全部 Web Audio 程序化音效（`src/audio/sfx.js`）

---

## 二、第三方开源依赖

所有运行时与构建依赖均通过 npm 本地安装并打包本地化，运行时不依赖海外 CDN（除生产环境可选启用的 Cloudflare Turnstile 官方反机器人脚本外）。

| 包名 | 用途 | 许可证 |
| :--- | :--- | :--- |
| `three` (`^0.187.0`) | WebGL 3D 渲染、PBR 材质、OrbitControls、RoomEnvironment、GLTFExporter | MIT License |
| `vite` (`^8.3.8`) | 开发服务器与生产静态资源构建 | MIT License |
| `vite-plugin-singlefile` (`^2.3.4`) | 离线单文件演示包构建 | MIT License |
| `vitest` (`^5.1.2`) | 安全层单元测试与集成测试 | MIT License |
| `playwright-core` (`^1.65.1`) | 真实浏览器自动化验收与 GLB 导出（仅开发依赖） | Apache-2.0 License |
