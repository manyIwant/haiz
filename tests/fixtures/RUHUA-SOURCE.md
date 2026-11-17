# 入画天气测试数据

- `ruhua-archive-20261103.json`：Open-Meteo Historical Weather API（ERA5）2026-11-03 至 11-04 海南中学府城校区锚点逐小时数据，原样保存（CC BY 4.0，Weather data by Open-Meteo.com）。与正式页面所用的预报接口同一 JSON 结构（缺 `visibility` 与 `current`）。用于验证插值、积水与干燥模型。
- `ruhua-forecast-limit.json`：开发环境请求预报接口时收到的真实限流回应，用于验证失败回退。
