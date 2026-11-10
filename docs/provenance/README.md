# HAIZ · 原创成果与来源档案

> 建档日期：2026-11-10 · 基准：[`main@2db2c87`](https://github.com/manyIwant/haiz/commit/2db2c87ac178d1ae38c0190a1b537ba0b2f631dd)

这是一份**公开、可核查、可持续更新的开发证据索引**，帮助参与者理解 HAIZ 的设计演化、技术实现、外部参考、素材来源和未核实的版权问题。

**它不是官方版权登记，也不是“谁先提交谁就拥有版权”的证明。** Git 提交、截图、模型元数据和文档能证明某些文件在某个版本中的存在及项目如何解释开发过程，但不能单独证明作品的法律作者、独创性或不侵权。AI 参与的程度尤其需要留存人类设计、修改、选择、审核的实际证据，不能从提交者用户名推断。

## 八条已建立的证据链

| 档案 | 可交叉核对的证据 | 不应直接推断 |
| --- | --- | --- |
| **V4 榄仁树** | [V4 设计实录](../lanren-homepage-v4-20261104.md)、[生成脚本](../../scripts/lanren/build_tree.py)、[`tree.json`](../../lanren/assets/tree.json)、[`tree.glb`](../../lanren/assets/tree.glb) | 树与太湖石为概念造型，不是测绘；参考摄影与生成贴图来源需分别核验 |
| **02 根脉** | [实现与史料来源记录](../lanren-roots-20261107.md)、[投影源码](../../lanren/roots/roots.js) | 史料可查不代表历史照片已经获得再分发授权 |
| **03 青春生长** | [设计和实现记录](../haiz-act3-leaves-20261107.md)、[作品树冠源码](../../lanren/canopy/canopy.js) | 演示作品不代表学生真实投稿；投稿者仍拥有自己的版权 |
| **04 地图展开** | [总平面到三维实现记录](../lanren-campus-unfold-20261106.md)、[几何展开逻辑](../../lanren/map/unfold.js) | 建筑和室内存在推测，不是精确现场测绘 |
| **05—06 电影与回望** | [电影源码](../../lanren/world/film.js)、[历史电影验证图](../lanren/world/film.jpg) | 最新美术精修属于未合入主分支的开发版本，不能当作线上成品 |
| **校园石材** | [Blender 生成器](../../scripts/build-landscape.py)、[模型元数据](../../assets/walk/models/campus-limestone.json)、[已有授权声明](../../assets/walk/models/NOTICE.md) | 已有 CC0 声明继续有效；参考照片版权不随模型被放弃 |
| **盆栽道具** | [第三方改编与署名](../../assets/walk/models/NOTICE.md)、[素材来源清单](../../assets/walk/credits.json) | 上游 CC0 / CC BY 内容并非 HAIZ 新授权的自有原创 |
| **课间窗台** | [独立 AGPL 的来源、修改和许可证](../../windowsill/SOURCE.md) | 不能以新 PolyForm NC 许可证覆盖上游 AGPL 内容 |

完整结构化记录：[**registry.json**](registry.json)，包括每项作品的关联路径、主分支基准、相关提交、资料及权属核验状态。

## 版本和创作时间线怎样查

Git commit 可以提供**由仓库记录的时间戳和修改集合**，但它可被重写或伪造，不应表述为第三方认证时间戳。以 GitHub 上实际存在的提交和材料相互交叉核对，才有更强的说明价值。

- 2026-10-19：校园石材生成器及 GLB 的重建提交 [`262f780`](https://github.com/manyIwant/haiz/commit/262f78079e9c06fd5a43f914f8a4c6616685fbf1)。
- 2026-11-04：榄仁树 V4 的迭代提交 [`6559e12`](https://github.com/manyIwant/haiz/commit/6559e1235a54a029c71ff8a37f9e5d9c925a751d)、[`9caa250`](https://github.com/manyIwant/haiz/commit/9caa250f10ba26653903d50b4cd20204303b5202)。
- 2026-11-06：第四幕校园展开实施提交 [`3ab9f4e`](https://github.com/manyIwant/haiz/commit/3ab9f4eb75184b57b201b5185e3e236ab55406a1)。
- 2026-11-07：电影、漫游交接 [`38f1e5c`](https://github.com/manyIwant/haiz/commit/38f1e5c014a63877da9dc77015368bbda71ab34a)、第二幕根脉 [`4609797`](https://github.com/manyIwant/haiz/commit/4609797c7a559174523c7b1904e0c61425722308)、第三幕作品树冠 [`5ed6731`](https://github.com/manyIwant/haiz/commit/5ed67311c6cf07b9f3368a65dff892bb8499480c)。
- 2026-11-08：六幕整合主分支的历史基准 [`155845e`](https://github.com/manyIwant/haiz/commit/155845e10c32e1363928cf7ef66b49b0399d993a)。
- 2026-11-10：此次登记基于 [`2db2c87`](https://github.com/manyIwant/haiz/commit/2db2c87ac178d1ae38c0190a1b537ba0b2f631dd)。

以上日期来自 Git 提交元数据；设计文件名中的日期是文件自身的记录标签。两者不必完全一致，不能据此推定真实创作的准确起始时间。

### 未合入的美术迭代（单列）

独立分支 [`claude/youthful-davinci-c31244`](https://github.com/manyIwant/haiz/tree/claude/youthful-davinci-c31244) 记录了 [第四轮视觉精修](https://github.com/manyIwant/haiz/blob/claude/youthful-davinci-c31244/docs/haiz-art-pass-4-20261108.md) 与 [第五轮电影美术精修](https://github.com/manyIwant/haiz/blob/claude/youthful-davinci-c31244/docs/haiz-art-pass-5-20261109.md)，包括一号教学楼参考、建筑造型、人物动作和浏览器对比图。它**尚未并入本档案基准 `main`**；将来整合后应新增对应主分支证据，不重写本次快照。

## 怎样保存新作品的创作证据

每项重要新增作品应使用 [记录模板](RECORD-TEMPLATE.md)，尽量保存**设计目标 → 参考来源 → 可审查的迭代 → 生成/实现过程 → 最终文件与校验 → 权利核查**这条链。

最低标准：

1. **标记版本：** 作品精确路径、Git commit SHA、必要时文件 SHA-256/原始资产版本；大尺寸成果保留可访问且有来源说明的 Release/提交。
2. **区分参与角色：** 谁提出创意或决定取舍，哪些部分由 AI 辅助生成，哪些经过人工选择、重写、雕刻或测试；不凭 GitHub 登录名就认定法律作者。
3. **记录外部资源：** 照片、图形学参考、字体、脚本、模型、配乐，写清来源、作者、许可与不确定性。未确定授权的项目不能暗示可复制。
4. **留下迭代而非只有成品：** 可在无个人信息前提下保留草图、前后截图、约束与关键改变；不要将包含私人对话或账户凭据的完整聊天记录公开。
5. **记下测试边界：** 软件渲染、真实 GPU、Safari、真机、照片级真实性是不同的验收条件。
6. **权利检查单独完成：** 证据已归档不等于获得第三方再分发许可；使用 [ARTWORK-LICENSING.md](../../ARTWORK-LICENSING.md) 逐项授予 CC BY-NC-SA 前须由有权授权的作者明确同意。

## 数据如何验证

`registry.json` 的 `anchors` 记录的是基准版本下文件的 **Git blob 对象 ID（SHA-1 格式）**，并非签名、SHA-256 或版权登记号。运行：

```bash
node --test tests/provenance.cjs
```

测试会核对条目结构、证据文件路径和当前文件的基准一致性；日后文件发生合理更新时会提示版本漂移，应增加新的修订记录而不是修改历史旧条目。

## 版权、商业使用与隐私

- **[LICENSING.md](../../LICENSING.md)**：PolyForm Noncommercial 对有权授权原创代码的适用范围，以及第三方例外。
- **[ARTWORK-LICENSING.md](../../ARTWORK-LICENSING.md)**：目前尚无完成权属审核并正式登记的既有美术素材，不得自动将档案中的任何资产视为 CC BY-NC-SA。
- **[CONTRIBUTING.md](../../CONTRIBUTING.md)**：贡献者保留自己的权利。商业合作必须考虑所有相关版权人，而不只项目维护者。
- **[COMMERCIAL-LICENSING.md](../../COMMERCIAL-LICENSING.md)**：商业使用联系流程。
- **[RIGHTS-REVIEW.md](RIGHTS-REVIEW.md)**：尚待核查的材料与优先级。

记录公开证据时只使用项目账号或获公开授权的署名；不要公开未成年人身份信息、私人联系方式、未授权的原始照片、聊天记录、学校内部档案或与作品无关的个人文件。

如果怀疑 HAIZ 或第三方的作品被未经授权转载，先保存**页面 URL、公开时间、相关文件版本、对方公开声称的来源、相似部分**，再评估是否联系对方、平台投诉或咨询专业法律意见。档案并不承诺自动发现侵权或自动确立赔偿责任。
