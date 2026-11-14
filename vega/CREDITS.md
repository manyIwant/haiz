# 来源、授权与署名

这是一份私人、非商业的赠礼。下面列出页面里每一样不是自己画的东西，以及每一条有出处的事实。

## 图像

| 用在哪里 | 文件 | 来源与署名 | 说明 |
|---|---|---|---|
| 第四页贴着的照片 | `img/vega-disk-hubble.jpg` | **NASA, ESA, CSA, STScI, S. Wolff (University of Arizona), K. Su (University of Arizona), A. Gáspár (University of Arizona)**。发布页：<https://science.nasa.gov/asset/hubble/hubble-and-webb-observations-of-vega-circumstellar-disk/>，2024-11-01 发布 | 哈勃空间望远镜 STIS 仪器拍摄的织女一尘埃盘；记录的是尘埃反射的星光，中央恒星被遮挡，颜色为后期指定，并非肉眼所见。本页所用为该发布图中哈勃一侧的裁切（去掉了标注、比例尺与罗盘），缩放至 900×900，未作其他改动。文件取自旧版（第四版）页面内嵌的同一图像。 |
| 第三页的银版 | 纯 CSS 绘制 | 原创 | **示意图**。不是 1850 年的原件，不是任何馆藏的复制品，页面上已注明。 |
| 第一页关灯后的星图 | Canvas 实时绘制 | 数据见下 | 是按星表坐标画的准确星图；**不是**任何时刻、任何地点的实时天空。页面不请求定位。 |
| 封面、稿纸、蓝晒纸、开关、红笔、胶带、“阅”字章、纪念页 | CSS / SVG / Canvas | 原创 | `img/grain.webp`、`img/wash.webp` 为代码生成的纸纹。 |

NASA 图像依其媒体使用准则用于个人、非商业、信息性用途：<https://www.nasa.gov/nasa-brand-center/images-and-media/>。
页面未使用 NASA 标识；使用其图像不代表 NASA、ESA、CSA、STScI 或亚利桑那大学认可本页面，页面内已写明。

资料包 `assets/original/` 里的原创 SVG / PNG 草图本作品**没有使用**。

## 数据

| 数据 | 文件 | 来源 |
|---|---|---|
| 星位、星等、色指数 | `js/sky-data.js` | XHIP（Extended Hipparcos Compilation，Anderson & Francis 2012）星表，经 d3-celestial 数据集；由旧版的 `tools/build_sky.py` 生成，以织女一为中心作立体投影（J2000）。本版只截取了页面画得到的天区。 |
| 天琴座连线 | 同上 | d3-celestial 星座连线数据 |

已抽查：织女一到天津四 23.85°、到河鼓二 34.20°、到渐台二 6.04°，与公认角距一致。

## 事实与出处

| 页面上的说法 | 出处 | 写法上的保留 |
|---|---|---|
| 织女一 = Vega = 天琴座 α，距地球约 25 光年 | NASA DART：<https://www.nasa.gov/missions/dart/nasas-dart-captures-one-of-night-skys-brightest-stars/>；NASA Photojournal（Spitzer）：<https://science.nasa.gov/photojournal/tiny-particles-so-far-away/> | 一律写“大约二十五光年”“大约二〇五一年”。刻度线内部按 25.04 年换算光点位置。 |
| 1850 年，织女一的光被留在银版上 | 哈佛大学档案馆 HUA 19018：<https://hollisarchives.lib.harvard.edu/catalog/hua19018>；Smarthistory：<https://smarthistory.org/john-whipple-william-bond-and-george-bond-the-moon-no-37/> | 写作“人类最早拍下的恒星之一”，不争优先权；不写具体曝光秒数（未核实）。 |
| 2024 年发布的哈勃 / 韦布观测；看清尘埃盘要遮住恒星 | NASA：<https://science.nasa.gov/missions/hubble/nasas-hubble-webb-probe-surprisingly-smooth-disk-around-vega/> | 写“二〇二四年发布”，不写“二〇二四年拍摄”（观测更早）。 |
| 没有人能购买或命名恒星 | 通识；页面两处声明 | 纪念页页脚也写明“没有谁买下或命名这颗星”。 |

**核查说明：** 以上链接与事实来自资料包 `research/` 中已核实的清单。制作本版时的运行环境无法访问
nasa.gov、harvard.edu 等域名，因此**没有在本次制作中重新打开这些页面复核**；正式送出前如需万无一失，
请人工点开上表链接再看一眼署名行。

## 字体

| 字体 | 用途 | 授权 | 来源 |
|---|---|---|---|
| 霞鹜文楷 LXGW WenKai（Regular） | 所有手写的字 | SIL Open Font License 1.1，见 `fonts/OFL-LXGWWenKai.txt` | <https://github.com/lxgw/LxgwWenKai> |
| 思源宋体 Noto Serif SC | 印刷的字（封面、栏名、图注） | SIL Open Font License 1.1，见 `fonts/OFL-NotoSerifSC.txt` | <https://github.com/google/fonts/tree/main/ofl/notoserifsc> |

`fonts/*.woff2` 是用 `tools/build-fonts.py` 从上述字体裁出的网页子集。霞鹜文楷的授权文本明确允许“仅为网页字体投放而作的子集化与 WOFF2 转换”继续使用其保留字体名，且不得作为可安装的桌面字体分发——本项目只把它们当网页字体使用；思源宋体的授权没有保留字体名条款。
页面里把它们叫作 “Vega Hand” / “Vega Print” 只是 CSS 里的别名。

## 音乐与声音

没有。这件作品是静音的。

## 代码

全部为本作品原创，未使用任何第三方库或框架。
