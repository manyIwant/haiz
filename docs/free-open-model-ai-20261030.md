# HAIZ 智能消息转待办 · 免费开源模型接入（2026-10-30）

本分支在原有 `semanticExtract()` 上新增 **Cloudflare Workers AI** 和 **Ollama** 两种提供方。默认仍然禁用 AI：没有用户知情同意和服务端正确配置时，不会上传消息。无需在手机端保存密钥。

## 最推荐：Cloudflare Workers AI + Qwen3-30B-A3B

使用 **Qwen/Qwen3-30B-A3B** 的开源权重（Apache-2.0），由 Cloudflare Workers AI 提供推理。选择固定的 `@cf/qwen/qwen3-30b-a3b-fp8` 模型，后端调用 Cloudflare 受信任的官方 HTTPS 端点（不会接受来自微信聊天内容的任意 URL，也不会从手机接收自定义推理端点）。

官方模型页：https://developers.cloudflare.com/workers-ai/models/qwen3-30b-a3b-fp8/

官方 Qwen 模型页：https://huggingface.co/Qwen/Qwen3-30B-A3B

**免费限制**：Cloudflare Workers AI Free 计划含每天 10,000 Neurons 免费额度，超过时免费计划请求失败（模型消耗不同，不能保证每天多少次成功调用）。即使模型权重开源，Cloudflare 作为推理提供方依然处理脱敏后的通知正文，需经过相应数据处理同意。不要认为可以无限制免费调用。

### 服务器管理员配置

1. 登录 Cloudflare 仪表盘，进入 **Workers AI → Use REST API**。
2. 复制 Account ID；创建具有最低必要 **Account / Workers AI - Read** 权限的专用 API Token（如控制台模板权限有所不同，应审核授权范围）。
3. 在运行 **HAIZ Academic** 的服务器上设置私密环境变量。**不要放入 GitHub、网页、Flutter App、.env 公共示例或聊天截图里**。

```bash
export HAIZ_AI_ENABLE=1
export HAIZ_AI_PROVIDER=cloudflare
export HAIZ_CF_ACCOUNT_ID='32位CloudflareAccountID'
export HAIZ_CF_API_TOKEN='由Cloudflare生成的私有WorkersAIToken'
# 其余 HAIZ Academic 数据库、admin 密码和 HTTPS 部署仍按原 README 配置
node services/academic/server.mjs
```

Android/iPhone 均通过已有 HAIZ Academic 登录的服务端 `POST /api/ai/extract` 访问模型。服务端固定使用官方模型 `@cf/qwen/qwen3-30b-a3b-fp8`，**不需要 OpenAI Key 或自行购买 GPU**。但 HAIZ Academic 本身仍需要长期可用的 HTTPS 服务托管；Cloudflare 免费推理不等于整个后端免部署。

## 完全自有的开源推理：Ollama

如果有独立的始终在线的主机（学校获准服务器/自有设备），用 Ollama 本地运行 Qwen3.5 2B。Apache-2.0 模型：https://huggingface.co/Qwen/Qwen3.5-2B

官方模型目录：https://ollama.com/library/qwen3.5

在**HAIZ Academic 同一主机**安装 Ollama，拉取小模型（约 2–3GB 模型文件；运行时需额外内存；按官方实际标签体积为准）：

```bash
ollama pull qwen3.5:2b
# 可选择更小的模型：ollama pull qwen3.5:0.8b
```

启动 Ollama 的本地服务（默认 `127.0.0.1:11434`），在 HAIZ Academic 进程设置：

```bash
export HAIZ_AI_ENABLE=1
export HAIZ_AI_PROVIDER=ollama
export HAIZ_OLLAMA_URL=http://127.0.0.1:11434
export HAIZ_OLLAMA_MODEL=qwen3.5:2b
node services/academic/server.mjs
```

此模式**不用外部推理 API Key，也不按请求付费**，通知内容发送到同主机的回环接口。HAIZ 拒绝把 Ollama 配置指向公网地址，禁止公开无认证的 `11434` 端口。机器关机或断网后不可用，不建议用学生随身 Mac 当生产推理节点。

## 接口行为及安全边界

- 只有已加入获核准班级的 HAIZ 学生账号，且手机端用户明确开启「AI 语义理解」，才能触发分析。
- 服务端检查长度（5～2800字符）、时间、频次（每位学生每小时 25 次）及响应结构（最多 8 条），屏蔽常见电话号码、邮箱、网址；**不保证完全匿名化**。
- 对每条 AI 候选，必须给出可在脱敏后输入中逐字找到的 `evidence`，核对标题、科目、日期；不确定日期标记为待审。
- AI 不会自动创建/发布班级任务；学生审阅结构化候选，教师再确认后才对全班发布。
- Cloudflare 免费额度耗尽（HTTP 429/402）或 Ollama 不可用时，原消息和本机规则提取继续可用；不会丢失或强制上传到其他付费提供方。
- 仍无法在 iPhone 后台监听微信；Android 微信完全关闭通知后也没有普通 App 可直接读取私人聊天的官方接口。
- **目前属于开发分支**，尚未配置真实 Cloudflare Token 或 Ollama 模型做真实质量测试，也未验证 iOS/Android 真机运行；不代表已上线。

## 回归测试

```bash
cd services/academic
npm ci
npm test
```

`tests/intelligence.test.mjs` 使用虚构通知和模拟网络响应验证官方 Cloudflare 地址、固定 Qwen3 模型 ID、专用 Token、Ollama 回环地址、拒绝恶意 URL、免费额度错误以及原文证据。没有测试真实账户消费，不能据此声明已有成功的线上推理。
