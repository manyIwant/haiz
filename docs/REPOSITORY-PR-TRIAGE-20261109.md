# HAIZ 42 个旧 Draft PR：逐项整理与有凭据的关闭记录

> 2026-11-09 审计快照。**关闭旧 PR 不代表已经合入主分支**；所有原始 HEAD 分支均保留。列表中“关闭”只用于移走重复的串行审查入口。

## 审查标准

- Git 提交图已验证：待关闭 PR 的 HEAD 是其后继 PR HEAD 的**祖先**（完全包含提交），不是凭标题猜测。
- 逐个保留原 HEAD SHA、base 与 successor；没有删除任何开放 PR 的 head/base 分支。
- 后继 PR 仍是 Draft、未被合入 main；不能在未来直接合并子 PR 而忽视父分支上的必要提交。必要时将整条链整合成新的 PR 以 main 为 base。
- 关闭可以恢复；未纳入后继 PR 或仍有独立提交的 PR 必须保留。

| PR | 原标题 | 原 head SHA | head → base | 初步决定 |
| --- | --- | --- | --- | --- |
| [#1](https://github.com/manyIwant/haiz/pull/1) | HAIZ Flow：教师跨端草稿接力与经确认的教室公开摘要 | `5e53933720ed` | `feat/haiz-flow-handoff` → `feat/haiz-round02-classroom` | 关闭旧版审查入口（由 [#20](https://github.com/manyIwant/haiz/pull/20) 作为后继） |
| [#2](https://github.com/manyIwant/haiz/pull/2) | HAIZ Flow: isolated HTTPS pilot, field conflicts and offline STILLROOM | `9990fbcfd6d3` | `feat/haiz-pilot-hardening` → `feat/haiz-flow-handoff` | 关闭旧版审查入口（由 [#20](https://github.com/manyIwant/haiz/pull/20) 作为后继） |
| [#3](https://github.com/manyIwant/haiz/pull/3) | Fix Android/iOS native startup recovery and replace placeholder icons | `199168705a37` | `fix/mobile-startup-icons-v040` → `feat/haiz-round02-classroom` | 关闭旧版审查入口（由 [#20](https://github.com/manyIwant/haiz/pull/20) 作为后继） |
| [#4](https://github.com/manyIwant/haiz/pull/4) | HAIZ LUCENT：修复原生入口、整合三主题图形转场与可中断玻璃导航 | `15793e3b7244` | `feat/haiz-lucent-integration` → `feat/haiz-pilot-hardening` | 关闭旧版审查入口（由 [#20](https://github.com/manyIwant/haiz/pull/20) 作为后继） |
| [#5](https://github.com/manyIwant/haiz/pull/5) | Fix Android emulator QA shell parsing without weakening startup checks | `e1baa21546a4` | `fix/haiz-android-qa-shell-script-20261024` → `fix/mobile-startup-icons-v040` | 保留：尚无经提交图证明的完整后继审查入口 |
| [#6](https://github.com/manyIwant/haiz/pull/6) | HAIZ Motion Identity 01 — kinetic brand morph and glass dock prototype | `16beefa51953` | `feat/haiz-motion-identity-01` → `fix/mobile-startup-icons-v040` | 关闭旧版审查入口（由 [#8](https://github.com/manyIwant/haiz/pull/8) 作为后继） |
| [#7](https://github.com/manyIwant/haiz/pull/7) | HAIZ Editorial 02 — mature student/teacher UI, restrained motion and dock | `643eca2074f2` | `feat/haiz-editorial-refinement-02` → `feat/haiz-motion-identity-01` | 关闭旧版审查入口（由 [#8](https://github.com/manyIwant/haiz/pull/8) 作为后继） |
| [#8](https://github.com/manyIwant/haiz/pull/8) | HAIZ Fieldnotes 03 — editorial mobile UI, shared work surface and refined dock | `f829893e2859` | `feat/haiz-fieldnotes-03` → `feat/haiz-editorial-refinement-02` | 保留：尚无经提交图证明的完整后继审查入口 |
| [#9](https://github.com/manyIwant/haiz/pull/9) | Integrate Fieldnotes 03 with HAIZ Flow/Study — real navigation, shared theme, native asset gates | `f5b29227ee4c` | `feat/haiz-cross-system-bridge-20261024` → `feat/haiz-lucent-integration` | 保留：尚无经提交图证明的完整后继审查入口 |
| [#10](https://github.com/manyIwant/haiz/pull/10) | Privacy-safe contact page, English project overview and security baseline | `5f22cec470c3` | `chore/security-hygiene-20261025` → `main` | 保留：尚无经提交图证明的完整后继审查入口 |
| [#11](https://github.com/manyIwant/haiz/pull/11) | Fix LUCENT iOS IPA scheme and diagnose Android 35 WebView timeouts | `ccffac61b432` | `fix/lucent-ci-scheme-and-webview-20261025` → `feat/haiz-lucent-integration` | 关闭旧版审查入口（由 [#19](https://github.com/manyIwant/haiz/pull/19) 作为后继） |
| [#12](https://github.com/manyIwant/haiz/pull/12) | STILLROOM adaptive ambient quality + Dream Road APK architecture study | `884217d14f5e` | `feat/stillroom-adaptive-quality-20261025` → `fix/lucent-ci-scheme-and-webview-20261025` | 关闭旧版审查入口（由 [#19](https://github.com/manyIwant/haiz/pull/19) 作为后继） |
| [#13](https://github.com/manyIwant/haiz/pull/13) | HAIZ cinematic climate: rainbreak gold and tropical monsoon | `33cd1372d0e4` | `feat/campus-cinematic-light-20261025` → `feat/stillroom-adaptive-quality-20261025` | 关闭旧版审查入口（由 [#19](https://github.com/manyIwant/haiz/pull/19) 作为后继） |
| [#14](https://github.com/manyIwant/haiz/pull/14) | HAIZ INNER WORLD — walk-in cinematic classroom and study handoff | `959da9a75152` | `feat/immersive-classroom-20261025` → `feat/campus-cinematic-light-20261025` | 关闭旧版审查入口（由 [#19](https://github.com/manyIwant/haiz/pull/19) 作为后继） |
| [#15](https://github.com/manyIwant/haiz/pull/15) | INNER WORLD V2 — GPU instancing, grounded surfaces, tropical foliage and Android capture reliability | `956da5145998` | `feat/immersive-material-depth-and-instancing-20261025` → `feat/immersive-classroom-20261025` | 关闭旧版审查入口（由 [#19](https://github.com/manyIwant/haiz/pull/19) 作为后继） |
| [#16](https://github.com/manyIwant/haiz/pull/16) | HAIZ ATLAS — cinematic spatial campus with real WebGL place connections | `c6cebfbbd213` | `feat/openui-campus-console-20261025` → `feat/immersive-classroom-20261025` | 保留：尚无经提交图证明的完整后继审查入口 |
| [#17](https://github.com/manyIwant/haiz/pull/17) | INNER WORLD V3 — authored hero furniture and static window bounce | `85468a1d8395` | `feat/innerworld-hero-assets-v3-20261025` → `feat/immersive-material-depth-and-instancing-20261025` | 关闭旧版审查入口（由 [#19](https://github.com/manyIwant/haiz/pull/19) 作为后继） |
| [#18](https://github.com/manyIwant/haiz/pull/18) | INNER WORLD V4 — authored UV2 ambient occlusion and architectural PBR detail | `7b85f5acc6b7` | `feat/innerworld-architectural-lightmaps-v4-20261025` → `feat/innerworld-hero-assets-v3-20261025` | 关闭旧版审查入口（由 [#19](https://github.com/manyIwant/haiz/pull/19) 作为后继） |
| [#19](https://github.com/manyIwant/haiz/pull/19) | INNER WORLD V5 — lived-in room, rainy glass and frame-rate-independent weather | `cf025d5b6212` | `feat/innerworld-human-scale-details-v5-20261025` → `feat/innerworld-architectural-lightmaps-v4-20261025` | 保留：尚无经提交图证明的完整后继审查入口 |
| [#20](https://github.com/manyIwant/haiz/pull/20) | 校园作业实用性优化：版本冲突恢复、教师筛选与教室回执 | `70562734759c` | `feat/haiz-campus-operations` → `feat/haiz-lucent-integration` | 保留：尚无经提交图证明的完整后继审查入口 |
| [#21](https://github.com/manyIwant/haiz/pull/21) | feat: Academic v1.4 权威作业、修订与持久同步基础 | `b308312a8f5d` | `feat/academic-backend-v1.4` → `preview/haiz-academic-v1.3` | 关闭旧版审查入口（由 [#26](https://github.com/manyIwant/haiz/pull/26) 作为后继） |
| [#22](https://github.com/manyIwant/haiz/pull/22) | feat: 学生本机数据按账号隔离与安全迁移（v1.4 Phase 1） | `a1f52f4e6dac` | `feat/student-data-isolation-v1.4` → `preview/haiz-academic-v1.3` | 保留：尚无经提交图证明的完整后继审查入口 |
| [#23](https://github.com/manyIwant/haiz/pull/23) | test: independent v1.4 QA — FAIL, P0 migration data loss | `7310b82b66a9` | `qa/haiz-v1.4-verification` → `preview/haiz-academic-v1.3` | 关闭旧版审查入口（由 [#26](https://github.com/manyIwant/haiz/pull/26) 作为后继） |
| [#24](https://github.com/manyIwant/haiz/pull/24) | feat(teacher): Academic v1.4 One Publish 教师工作台 | `c610dc9a9f69` | `feat/teacher-one-publish-v1.4` → `feat/academic-backend-v1.4` | 保留：尚无经提交图证明的完整后继审查入口 |
| [#26](https://github.com/manyIwant/haiz/pull/26) | test(v1.4): green independent QA regression retest on integrated backend and student app | `ecef0249b4cf` | `integration/v14-regression-green-20261028` → `qa/haiz-v1.4-verification` | 保留：尚无经提交图证明的完整后继审查入口 |
| [#27](https://github.com/manyIwant/haiz/pull/27) | feat(app): website optical glass + editorial campus UI preview | `3e87b9cd5200` | `feat/app-editorial-parity-20261028` → `qa/haiz-v1.4-verification` | 保留：尚无经提交图证明的完整后继审查入口 |
| [#29](https://github.com/manyIwant/haiz/pull/29) | feat(app): 自动接收指定班群通知并转为待办候选 | `262dc173ce28` | `feat/authorized-message-intake-20261029` → `feat/app-functional-workflows-20261029` | 保留：尚无经提交图证明的完整后继审查入口 |
| [#31](https://github.com/manyIwant/haiz/pull/31) | feat(app): strengthen optical refraction, glass rims and Android fallback | `e19f2ee3f943` | `feat/optical-lens-v2-20261029` → `feat/authorized-message-intake-20261029` | 保留：尚无经提交图证明的完整后继审查入口 |
| [#34](https://github.com/manyIwant/haiz/pull/34) | feat(academic): add localhost-only manyiwant student login demo | `365dc1f5091b` | `feat/academic-local-login-demo-20261029` → `preview/haiz-academic-v1.3` | 保留：尚无经提交图证明的完整后继审查入口 |
| [#35](https://github.com/manyIwant/haiz/pull/35) | Add HAIZ Academic Supabase portal preview | `f4a20e18f59f` | `feat/academic-supabase-portal-20261029` → `main` | 保留：尚无经提交图证明的完整后继审查入口 |
| [#38](https://github.com/manyIwant/haiz/pull/38) | feat(HAIZ Pocket): opt-in WeChat school-group notifications → reviewable tasks | `17eb1ac0cbe3` | `feat/message-intake-wechat-20261029` → `feat/authorized-message-intake-20261029` | 保留：尚无经提交图证明的完整后继审查入口 |
| [#41](https://github.com/manyIwant/haiz/pull/41) | feat(HAIZ Pocket): iOS user-share inbox for WeChat content (no fake background monitoring) | `6f15c2ad110f` | `feat/ios-wechat-share-intake-20261029` → `feat/message-intake-wechat-20261029` | 保留：尚无经提交图证明的完整后继审查入口 |
| [#44](https://github.com/manyIwant/haiz/pull/44) | feat(HAIZ Pocket): mobile class task relay + opt-in evidence-based AI parsing | `da362dd5e641` | `feat/mobile-class-task-relay-20261029` → `feat/message-intake-wechat-20261029` | 关闭旧版审查入口（由 [#45](https://github.com/manyIwant/haiz/pull/45) 作为后继） |
| [#45](https://github.com/manyIwant/haiz/pull/45) | feat(HAIZ): one-key free OpenRouter LLM + Cloudflare Qwen + local Ollama | `da869a277e6d` | `feat/free-open-model-inference-20261030` → `feat/mobile-class-task-relay-20261029` | 保留：尚无经提交图证明的完整后继审查入口 |
| [#46](https://github.com/manyIwant/haiz/pull/46) | feat(ClassIsland): unified v0.2 evening study auto-display preview | `e4d83ebd9a73` | `feat/classisland-unified-evening-v1-20261030` → `preview/haiz-academic-v1.3` | 关闭旧版审查入口（由 [#49](https://github.com/manyIwant/haiz/pull/49) 作为后继） |
| [#47](https://github.com/manyIwant/haiz/pull/47) | feat(ClassIsland): guided one-link classroom onboarding in settings | `4b4e3465086f` | `feat/classisland-guided-setup-20261030` → `feat/classisland-unified-evening-v1-20261030` | 关闭旧版审查入口（由 [#49](https://github.com/manyIwant/haiz/pull/49) 作为后继） |
| [#48](https://github.com/manyIwant/haiz/pull/48) | feat(pocket): original Aceternity Lamp web & native WebView entrance | `971090532547` | `feat/pocket-lamp-entry-20261030` → `main` | 关闭旧版审查入口（由 [#51](https://github.com/manyIwant/haiz/pull/51) 作为后继） |
| [#49](https://github.com/manyIwant/haiz/pull/49) | feat(ClassIsland): show HAIZ homework only during final two study periods, with no top-bar component | `353d2a6f4f67` | `feat/classisland-automation-only-20261030` → `feat/classisland-guided-setup-20261030` | 保留：尚无经提交图证明的完整后继审查入口 |
| [#50](https://github.com/manyIwant/haiz/pull/50) | HAIZ Pocket V1: integrate automatic WeChat notifications, iOS share and class task relay (QA candidate) | `22eab64b3c5b` | `integration/pocket-auto-tasks-v1-20261030` → `main` | 保留：尚无经提交图证明的完整后继审查入口 |
| [#51](https://github.com/manyIwant/haiz/pull/51) | feat(pocket): verified Supabase auth, secure sessions and owner-scoped cloud records | `8e60809b9cb4` | `feat/pocket-auth-rls-20261031` → `feat/pocket-lamp-entry-20261030` | 保留：尚无经提交图证明的完整后继审查入口 |
| [#69](https://github.com/manyIwant/haiz/pull/69) | feat: HAIZ Sense V1 — review-first smart task capture | `7b1e46e342f7` | `feat/haiz-sense-v1-20261101` → `main` | 保留：尚无经提交图证明的完整后继审查入口 |
| [#70](https://github.com/manyIwant/haiz/pull/70) | design: HAIZ 8pt foundations and functional UI consistency | `779d39cdc774` | `design/8pt-ui-foundations-20261101` → `main` | 保留：尚无经提交图证明的完整后继审查入口 |

## 执行与保留事项

- 标记可关闭 19 项、保留 23 项。需要逐项发表可恢复说明后再将 state 改为 closed。
- 所有旧 PR head 分支保留；后继 PR 可以继续讨论。以新功能整合 main 之前必须重新评估父分支依赖，避免只合并增量差异。
- 真正删除 HEAD 分支、更新 PR base、合并入 main 或清理历史都需要另外的依赖/测试评审。

## 2026-11-09 执行结果

19 个候选旧 Draft PR 均已在 GitHub 关闭，历史分支保留且未合入 main。每个关闭动作在 PR 中留有后继 PR 和恢复说明。其他 23 个 PR 保留开放状态。
