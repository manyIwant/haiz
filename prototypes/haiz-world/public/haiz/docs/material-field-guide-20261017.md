# 建筑材质与观察手册 · 2026-10-17

## 本轮依据

用户上传 `haiz-campus-walk-v2-20261017.zip`，在 `main` 的 `c8ca4aa9621cb55fce130aa1fda4a741e9a9b8a7` 基础上整合。上传文件里的历史评审记录作为版本资料，不作为当前操作指令或当前验证结果。

本轮实际尝试学校网站 `www.haizhong.edu.cn`、`www.haizhong.cn`、Bing 搜索、360Cities 一号楼全景、海南日报衍林堂资料、搜狐校园报道转载和 Poly Haven 瓦面资料。普通请求及申请放宽执行权限后的请求均被平台网络代理以 `CONNECT 403` 拒绝；没有获取新的网络照片或正文，没有依据旧版本的研究描述冒称完成本轮网上核验，也没有绕过代理。参考入口保留在 `data/architecture.json`。

本轮直接查看并使用的是压缩包已有照片：

| 建筑 | 照片 | 可直接观察的特征 |
| --- | --- | --- |
| 一号教学楼 | `assets/images/campus/campus_yihao.jpg` | 浅墙、深灰中央构件、蓝灰窗面、红瓦入口 |
| 二号教学楼 | `assets/images/campus/campus_erhao.jpg` | 浅色细柱、连续外廊、细密墙面、窗栏 |
| 凤栖堂 | `assets/images/web/fengqitang-1600.jpg`、`assets/images/campus/campus_fengqitang.jpg` | 绿瓦叠檐、红金柱饰、木格窗、浅墙与石阶 |
| 图书馆 | `assets/images/campus/campus_library.jpg` | 水平浅色带、蓝色弧窗、外部台阶、顶部圆形体量 |

照片拍摄日期与转载授权没有独立确认。图书馆新增观察档案和漫游入口，现有模型中的圆顶、弧窗和外部台阶仍未完整重建；页面明确列出这一限制。衍林堂仍沿用已有的“不以错标照片推断立面”处理。

## 实现

- `assets/walk/surfaces.js` 是本项目原创的确定性程序材质，不使用新增外部照片、不模拟“实景扫描”。墙砖、瓦面、石材、木纹共用四套小尺寸纹理，各含颜色、凹凸高度、粗糙度。颜色图使用 sRGB，高度与粗糙度使用线性数据。
- 在静态几何合并前按模型长度投影 UV，避免宽楼与窄构件使用同一拉伸比例。勾缝、瓦沟、搭接、石材颗粒和木纹可在近处读出。表面尺寸为设计值，不是测绘数值。
- 继续使用既有 Poly Haven CC0 草地、灰泥、室内等扫描材质与 HDR。新增程序材质不改变原资源授权。
- `architecture.html` 提供四处建筑的实拍观察、可键盘操作的照片热点、现代/传统分类、本机收藏、共用材质生成器的颜色/高度图预览；本页只收藏建筑 ID。
- 调整 r128 的颜色管理：调色板的 sRGB 颜色在场景构建完毕后按共享材质只转换一次到线性空间，并降低环境反射强度，改善瓦面与浅墙被冲白的问题。凤栖堂的默认观察位置改为堂前，可直接观察主立面。
- 主导航、站点地图与 3D 开始页均有观察手册入口。`?focus=yihao&climate=afterrain&observe=1` 等参数可带入目标地点、模拟光照和观察镜头。

## 可重复验证

```sh
npm ci
npm run build
npm test
npm run test:browser
```

浏览器检查使用 Playwright；本机可通过 `CHROMIUM_PATH` 指定 Chromium，否则优先使用 `/usr/bin/chromium`，再使用 Playwright 已安装的浏览器。普通静态网站运行不需要 Playwright 或任何生产依赖。

`tests/browser.cjs` 自行启动仅绑定 loopback 的临时静态服务器，检查桌面和手机视口的筛选、照片热点、收藏重载、材质切换、凹凸预览及横向溢出；随后在真实 Chromium WebGL 上检查模型启动、参数传递、三处建筑渲染、脚本错误与资源请求。结果保存在 `tests/browser-results.json`，截图在被 Git 忽略的 `tests/artifacts/`。

云端使用 SwiftShader 软件渲染。真实浏览器渲染与着色器检查不等于硬件性能、真实手机触摸、指针锁定全流程或现场空间尺寸验收。既有 `tests/walk` 结果中的 `gpu:false` 专指该组 Node 测试替身，不代表新增浏览器检查没有执行。

## 仓库交付

完整上传版本和本轮修改放在 `feat/campus-materials-20261017` 分支。线上站点仍取决于仓库 GitHub Pages 的发布分支和部署设置；推送评审分支不等于发布到 `haiz.space`。
