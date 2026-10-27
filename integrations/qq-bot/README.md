# HAIZ QQ Official Bot Connector

本模块使用腾讯的官方、MIT 许可的 `@tencent-connect/qqbot-nodejs` SDK（1.0.5）。**只转发已授权 QQ 群中对机器人的 @mention 事件**，群普通聊天、私信及成员身份均不会传到 HAIZ；不存在扫码登录、账号共享或历史抓取。

首先在 QQ 开放平台由有资格的主体建立机器人并获得授权的群聊场景，以及独立的 AppID / AppSecret。机器人是否能接收群 @事件取决于腾讯审核与权限。

在经过授权的主机上设置：

```bash
export HAIZ_QQ_APP_ID='官方机器人AppID'
export HAIZ_QQ_APP_SECRET='从QQ开放平台获得的应用密钥'
export HAIZ_QQ_RELAY_SECRET='与HAIZ Academic服务端相同的至少32位随机密钥'
export HAIZ_ACADEMIC_URL='https://由授权部署的学术服务域名'
npm ci
npm start
```

服务端使用 `HAIZ_QQ_RELAY_SECRET` 对每条转发事件的原始 JSON 正文验签。教师需要先在 HAIZ Web 中绑定**正确的 group_openid**，且每条消息的默认状态为待人工审核。没有凭据时，机器人不会自动连接；`npm test` 只使用虚构数据模拟事件，不会访问 QQ。

**注意**：此模块没有也不应拥有监听任意 QQ 群所有消息的能力。不要把实际 AppSecret 写入 `.env` 后提交 Git。
