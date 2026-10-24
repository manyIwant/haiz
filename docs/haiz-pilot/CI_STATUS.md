# CI与源码保全

被测功能提交：`f8e94ba4f0c300d45bec446947e9a3c4c89ee481`。后续文档提交不改变被测实现。

- [原Flow回归 40004706554](https://github.com/manyIwant/haiz/actions/runs/40004706554)：Windows、Linux均success。
- [新HTTPS/自习 40004706655](https://github.com/manyIwant/haiz/actions/runs/40004706655)：Windows与Linux Chromium均success；Linux WebKit在依赖安装阶段cancelled，未运行后续测试，不能记为通过。

CI的Windows runner是自动化虚拟机，不是学校Windows设备或希沃环境。WebKit任务即使成功也不等于iOS真机验证；临时自签证书下离线重载项明确标记待可信TLS环境验证。

main `55638e8ad1d35bc5f9e480ccf33061d33ecbc9fc`全部365个文件已逐字节比较，0缺失、0修改。旧Flow证据维持原位置；本轮重新运行的证据保存于regression，避免覆盖旧结论。分支与提交见PR #2：https://github.com/manyIwant/haiz/pull/2。
