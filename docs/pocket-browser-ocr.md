# HAIZ Pocket：浏览器本地 OCR（预览）

本分支支持 Flutter Web 的用户主动图片导入与本地 Tesseract.js 识别。原生 Android/iOS 保留 ML Kit。代码合并和构建通过不等于 iPhone 生产验收通过。

## 隐私边界

- 只对用户通过文件选择器主动提供的 PNG/JPEG 图片进行识别；验证文件魔数，大小限制为 12 MiB。
- 引擎 JS、Web Worker、WASM 及中文简体/英语模型由 HAIZ 自己的 HTTPS 地址提供，不向第三方 OCR 接口提交图片字节。
- 首次使用时按需下载 OCR 引擎和模型，正常打开 Pocket 不下载语言包。静态文件后续可被浏览器/Service Worker 缓存，但 iOS 可能清除缓存。
- 用户可取消识别，取消及账号切换时不得将旧识别结果加入待办；识别文字仍需用户校对和确认。
- 数据不会被自动上传到 GitHub。使用者仍需谨慎处理班级聊天和其他人的个人资料。

## 构建步骤

在仓库根目录执行：先在临时目录安装固定版本 Tesseract.js 7.0.0、tesseract.js-core 7.0.0，以及 @tesseract.js-data 的 eng 和 chi_sim 1.0.0 语言包。然后执行 scripts/prepare-pocket-ocr.mjs，传入依赖包 node_modules 目录，最后编译 Flutter Web 并运行 scripts/build-pocket-pwa.mjs。

GitHub Actions 的 pocket-pwa.yml 及 pocket-autopublish.yml 已加入这一过程，要求所有 JS/WASM/模型文件都存在才允许完成 PWA 打包。

## 正式验收清单

1. 真实中文+英文作业截图的文字识别；用户修改日期和科目后才能写入。
2. 浏览器开发者工具证明图片未向第三方发送，所有 OCR 资源均从 HAIZ 域名加载。
3. 无文字、错误格式、超限图片、取消识别时不发生错误数据写入。
4. 在 iPhone Safari 和已安装的主屏幕 Pocket 中，验证耗时、模型大小、内存、重启缓存与断网恢复；没有 iPhone 则不得将其标为通过。
5. 测试 Android/iOS 原生 ML Kit 未受影响。

目前这是可测试的功能分支。若 GitHub Actions 或浏览器测试未通过，不应合并到主分支或宣传为已完成生产验收。
