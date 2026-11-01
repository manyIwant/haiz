# 验证记录 · 2026-10-23

本轮本机环境：Linux、Node 24.19、系统 Chromium、Playwright 1.57。所有身份、课程、记录均为虚构数据。浏览器宽度为视口模拟，不代表在实体 Android/iOS 或希沃设备运行。

| 验证 | 本轮结果 | 证据 |
|---|---|---|
| 原有核心/学习/晚修规则 | 17通过 | test-domain.txt |
| 原有服务端 | 2通过 | test-server.txt |
| Flow和HTTPS身份接口 | 3通过 | test-api.txt |
| 原Flow浏览器回归 | 14检查、0页面异常 | regression/browser-results.json |
| 新HTTPS多会话流程 | 9组检查、0页面异常 | browser-chromium.json |
| STILLROOM恢复/离线/缓存隔离 | 4检查、0页面异常、0外部请求 | stillroom-results.json |
| 320/375/390/430/768/1024/1440/1920视口 | 脚本断言无水平溢出 | world/tests/*browser.mjs、screenshots/ |

HTTPS场景覆盖一次性邀请、Cookie属性、过期/撤销、服务重启、班级与所有者隔离、跨会话草稿、字段冲突、原文件未上传、离线重载和重连、公共投影、撤回、清理与来源检查。Node接口验证临时CA；Chromium为了测试临时自签证书显式忽略该证书错误，不能照搬到真实部署。自动化UI未发现错误不等于完成安全审计。

本次同时运行多个浏览器场景，教师找资料自动化一步耗时234ms，输入一句话并保存至另一会话可见1396ms；发布到大屏观察1962ms。以上是一次本机样本，不是公网p95、真实教师节时结论或设备性能保证。无持续CPU、内存、功耗或希沃遮挡测量，未填写虚构指标。

CI配置新增Linux Chromium、Windows Chromium、Linux WebKit（Node22）。CI实际运行结论另记CI_STATUS.md，不以配置存在当作通过。WebKit离线重载因测试自签证书信任环境限制明确标为PENDING_TRUSTED_TLS_ENVIRONMENT，其余操作照常验证；不冒充iOS Safari真机结果。

已知限制：单进程JSON，非加密数据库；试用私人缓存仅标签页会话，关闭可能丢失未同步内容；多标签会话复制属于浏览器行为，退出不能擦除其他离线窗口；公开屏离线最长保留15分钟且仍受公告原过期时间限制，期间可能已撤回；课程手工/明确确认的示例导入；资料只同步名称描述；学生社团仍是示例；ClassIsland与真实校园建筑未验证；无新APK/IPA；未部署公网。

旧Flow截图保持原提交不变，本轮回归另存regression。STILLROOM截图已人工复核，并修复字体依赖移除时的CSS残片导致主题变量未生效、黑字低对比度的问题。
