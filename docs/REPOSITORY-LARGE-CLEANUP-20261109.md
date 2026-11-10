# HAIZ 大型仓库清理 · 可恢复执行记录

启动：2026-11-09。基线 `main@8080abab`。此记录专门区分**已经实施**与**仍待处理**的操作；包含需要恢复时使用的原始 SHA。

## 旧 Android APK：迁移并保留哈希

- 原始路径：`releases/android/haiz-pocket-v1.4-optical-v2-arm64.apk`，大小 **40,051,087 字节**。
- SHA-256：`f19666eb4874eb570855f1e43c4797302389890a1a1cbbef7406ba09d2d12fc2`。
- 已验证上传至 [GitHub Release 旧版归档](https://github.com/manyIwant/haiz/releases/tag/haiz-pocket-v1.4-optical-v2-archive-20261109)；Release API 返回文件大小和 SHA-256 与本地完全一致。
- 更新历史 README 与 Android 更新文档链接，并从当前 Git 文件树移除 APK 及其原校验文本；README 说明迁移位置。
- 此操作不重写旧 Git 提交。历史中 APK 仍然存在，仓库服务器历史体积不会因一次 `git rm` 立刻缩小。

## 逐条核实的可删除分支

使用完整的 Git 提交图确认以下分支 HEAD **均已成为主分支历史祖先**，且不是任何当前开放 PR 的 head 或 base。删除前再次核查 SHA；删除分支指针不删除已合入 main 的代码。

| 分支 | 原始 SHA | 证明 |
| --- | --- | --- |
| `claude/beautiful-wozniak-zldp2a` | `880ce18813f5c560d0c1609a5b7e4427de79509e` | main 祖先；无开放 PR 引用 |
| `claude/haiz-continuous-spatial-world-fl9mw9` | `c093f9b8942bd8d15c852fadccb49eac2f063d49` | main 祖先；无开放 PR 引用 |
| `claude/sharp-galileo-9kzo84` | `47164fdca067b30714c08c49aa64ff707a462571` | main 祖先；无开放 PR 引用 |
| `fix/descent-arrival-surface-flicker-20261030` | `8151d018183d167ebea4cd16973c935926c51f9c` | main 祖先；无开放 PR 引用 |
| `fix/descent-final-handoff-20261030` | `4f4dfb9f00546e1a8867209e4984358ecf666e7d` | main 祖先；无开放 PR 引用 |
| `fix/descent-null-hidden-boot-20261030` | `fd3ea1cb69666bed4c918d24c20e099c68cfaa7f` | main 祖先；无开放 PR 引用 |
| `fix/descent-progressive-imagery-20261029` | `412832c06ceef1cd29b1989406935a426a07b76b` | main 祖先；无开放 PR 引用 |
| `fix/descent-smooth-hd-20261029` | `1e0903d05382cc496b8bafd70e9ef44135eb9316` | main 祖先；无开放 PR 引用 |
| `fix/descent-start-full-globe-20261030` | `6f1624f612c6faa20d61351e2a1f51602028072d` | main 祖先；无开放 PR 引用 |

保留的重要分支：`claude/youthful-davinci-c31244`（第五轮美术精修仍未进 main）、`claude/friendly-thompson-qdp9tb`、`claude/hopeful-hamilton-x676kb`、`claude/vibrant-wozniak-rsrttr`、`claude/wonderful-maxwell-ggk0pi`（六幕里程碑），以及发布/QA 分支、开放 PR 相关分支。

## Pull Request 原则

42 个旧 Draft PR 均非 main 的直接祖先，**不能只按日期批量关闭**。有些早期 PR 是后续 PR 的 base；在父分支功能未并入 main 前，直接关闭并删除父分支会导致其子 PR 无法独立合并。

关闭过时 PR 前：记录历史 HEAD、base、依赖它的子 PR 与是否被后续实现真正替代；在 PR 说明中给出结论和恢复路径，关闭不会删除代码。

## Git 历史压缩的安全门槛

当前仍有大量有独立提交的分支和 42 个相互依赖的 Draft PR。大规模改写远程 SHA 会使它们的 diff、评论、合并基准和用户已有克隆不再可信。

执行历史瘦身前必须有**完整的镜像备份**（包含所有分支、tag、原对象与对应 SHA）、可校验恢复路径、已清理或迁移的 PR 依赖链，以及明确的迁移/冻结窗口。

在未满足门槛之前，本次可以对当前 Git 树去重和建立隔离的压缩实验分支，但不采用强推覆盖公开 main。这样才真正符合“保留有用的”。

## 运行时路径保护

网页三维运行所依赖的 `assets/`、`lanren/`、以及 Pages 中仍被实际引用的应用构建资源，未经来源和渲染验证不可删，也不可简单改为 Git LFS 指针。

## 42 项 PR 的分类及关闭记录

详见 [逐项 PR 审查清册](REPOSITORY-PR-TRIAGE-20261109.md)。其中 19 项为后继 Draft PR 已完整包含其提交的早期中间审查入口，23 项保留原状态。关闭早期 PR 时，所有对应 HEAD/base 分支继续保留。
