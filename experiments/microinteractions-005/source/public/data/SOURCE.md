# 年轮的数据从哪来

`climate.bin` / `climate.json` 是 HAIZ「年轮」（`lanren/rings/`）使用的逐日天气档案：
自 1940-01-01 起，校园锚点（19.996°N, 110.347°E，取自 `assets/walk/campus.json`）所在位置每天一行。

| 项目 | 说明 |
| --- | --- |
| 来源 | **ERA5 再分析**（Copernicus Climate Change Service / ECMWF），经 [Open-Meteo Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api) 获取，`models=era5`，按 Asia/Shanghai 日界汇总 |
| 字段 | 最高/最低气温（°C）、降水量（mm）、最大风速与最大阵风（km/h）、主导风向（°）、平均云量（%）、WMO 天气代码 |
| 生成 | `node scripts/rings/fetch-climate.mjs`（全量）；`--update` 重读最近 120 天并追加。GitHub Actions `rings-climate.yml` 每周运行一次 |
| 格式 | 见 `lanren/rings/codec.js`：按字段分列、小端；类型最大值表示缺测 |

## 必须如实说明的事

- **这是模式再分析，不是观测。** ERA5 网格约 25 km，覆盖的是包含校园的一片区域，不是校内气象站，也不是海口气象站的记录。
- **极端值通常被低估。** 例如 2014-07-18「威马逊」在档案中为阵风 120 km/h、降水 211 mm；公开的实测记录更强。档案里的年降水量也普遍低于海口站的气候值。
- **逐日数据，不含一天之内的变化。** 年轮里「过完这一天」时，风雨全天按同一强度呈现。
- **最近约 5 天没有数据**（再分析的发布滞后）；1940-01-01 的降水、风向、云量缺测；1923–1939 年没有数据，年轮上留白。
- 全程只用 ERA5 一个模式，是为了让 1940 年和今天可以相互比较；它不是每个年代可获得的最高分辨率产品。

## 许可与署名

- Open-Meteo 提供的数据：CC BY 4.0（Weather data by Open-Meteo.com）。
- ERA5：Hersbach, H. et al. (2023). ERA5 hourly data on single levels from 1940 to present. Copernicus Climate Change Service (C3S) Climate Data Store. DOI 10.24381/cds.adbb2d47。本档案包含经修改的 Copernicus Climate Change Service 信息；欧盟委员会与 ECMWF 对其使用不承担责任。
- 本目录的数据文件不适用仓库根目录的 PolyForm Noncommercial 许可，按上述来源许可使用。
