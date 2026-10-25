# HAIZ LUCENT 验证状态

更新：2026-10-25。候选版本0.5.0-preview.1/build7。此文不是发行成功证明。

|范围|状态|证据/限制|
|原生资源同步与逐文件SHA核对|PASS，本地|verify-assets.mjs，Android/iOS资源副本一致|
|版本一致性|PASS，本地|verify-version.mjs|
|弹簧中断、减少动效、真实路径形变|PASS，3项|lucent/tests/motion.test.mjs|
|自习室独立初始化、跳过、重复与私人笔记|PASS，浏览器|evidence/cinema/results.json|
|连续5次视频失败恢复与减少动效|PASS，浏览器|同上；不等于完整影片播放通过|
|旧APK目录入口重定向缺陷|已复现，路由契约模拟|evidence/old-apk；不是真机复现|
|Android API35，8b79b1b|PASS，模拟器|CI 40079375580|
|Android API33，8b79b1b|FAIL，测试重载竞态|已提交e85bf09修订，等待新CI|
|iOS，8b79b1b|FAIL，测试构建exit70|具体构建原因尚待新日志|
|本轮全部代码的APK/IPA|未通过最终门禁|不得发布为已修复|
|Android/iPhone物理设备、希沃/ClassIsland实机|NOT_TESTED|没有设备及学校部署授权|

新CI：https://github.com/manyIwant/haiz/actions/runs/40149556899 。最终结果以对应提交的工作流为准，旧提交通过不能覆盖未提交改动。

内存/CPU、端到端同步延迟、系统键盘和真实触屏丝滑度尚未完成设备性能验收。未签名IPA不能直接安装。未配置稳定签名时APK使用临时debug证书，不保证覆盖安装旧发行包。应用不会擅自清除本机私人数据。

## 后续证据（e85bf09）

CI 40149556899：web-assets、android-build、Android API33均PASS。API35失败发生在KVM权限检查，未执行应用测试；新增udevadm settle后等待重新验收。iOS明确因生成测试目标缺少PRODUCT_NAME而输出空名称的.xctest路径，build-for-testing失败；9c1ed4d已设置产品及模块名。上述新修订尚未形成通过全部门禁的发行版。

本地真实页面新增20次快速中断点击、8次拖动回归已通过，共8组检查，0个pageerror。Flow/pilot服务器和运动逻辑共6项测试通过。原main365个文件字节完全保留，见evidence/original-preservation.json。

三主题Remotion影片已实际导出：1080×1920、30fps、168帧、5.6秒、H.264/yuv420p，无音轨；探测记录在world/cinema/media/*.probe.json。空间输入为720×1280低采样概念镜头，美术尚待深化。17项核心测试与2项服务器测试也已重新通过。

三套完整MP4已在实际打包Web界面逐一播放至ended并进入已初始化工具，PASS；跳过/重复/连续五次媒体失败/减少动效也PASS，0个pageerror。未剪辑浏览器录像：evidence/cinema/integrated-three-theme-playback.webm。

## 完整集成提交87578d7

CI 40150157883：Android API33和API35均PASS；iOS的WKWebView导航、笔记输入、前后台、强制重开、同包重装保留记录均PASS。iOS随后在arm64打包阶段失败：显式生成HAIZQA后，不能依赖自动生成的App scheme。现增加只含应用的共享HAIZDevice scheme，待新CI验证。并行PR任务的API35出现一次CDP Runtime.evaluate超时，保留失败记录，不抹为全部稳定通过。移除该集成分支重复push触发，保留PR与手动/复用工作流，降低重复模拟器任务。

## 发行门禁失败（6b0bfb3）

标签haiz-v0.5.0-preview.1的CI 40168247866：资源和APK编译核验PASS，但Android API33/API35都出现CDP Runtime.evaluate超时，发布被阻止。iOS仍排队。不能将旧运行通过替代本次失败。新的排查修订将调试连接限定到完成目录跳转的/world/index.html实际页面，避免连接根入口的短暂调试目标；同步求值关闭awaitPromise，记录页面生命周期、JS对话框及超时命令。尚需重跑证明，不能预先宣布修复。
