# HAIZ LUCENT 0.5.0-preview.1 · 测试候选版

这是新的集成分支产物，不是旧0.4.0 APK/IPA改名。基于round02、Flow/Pilot以及PR3的启动修复候选，保留校园漫游与原有学习记录。

- 原生打包入口与逐文件SHA清单；模块缺失诊断、手动重试和保留数据的导出。
- Obsidian、Porcelain、Ocean与跟随系统，实体内容表面和浮动玻璃导航；可中断透镜、拖动、搜索、减少动效与低耗电。
- 原创HAIZ字形构件连续路径插值，概念学习空间预渲染镜头；实际自习工具独立初始化，跳过/失败直接使用。建筑是原创概念空间，不是真实校园还原；美术质量限制见源码docs/haiz-cinema。
- Android13/15使用同一构建APK做WebView交互与笔记保留检查；iOS使用真正的WKWebView XCTest交互。发行工作流只在必须项通过后发布，不重新生成一个未经测试的APK。

Android签名类型与指纹见ANDROID-SIGNATURE.txt。iOS为unsigned arm64 IPA，不能直接安装。BUILD-INFO.json及包内build-info.json标明实际源码SHA与版本，SHA256SUMS.txt标明下载文件哈希。

模拟器PASS不等于真机PASS：vivo S10、iPhone、希沃/ClassIsland、校方授权、公网正式服务与Apple分发签名均需独立验收。旧版不同签名覆盖升级不作保证，先导出并保留数据。查看QA-RESULTS.md、INSTALL.zh-CN.md和native-qa-evidence.zip。没有质量门禁通过时，不应存在标记“已修复”的正式发行。
