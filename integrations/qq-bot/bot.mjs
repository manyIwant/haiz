import { createHmac, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';

/**
 * Official QQ Bot SDK -> HAIZ Academic pending-review queue.
 * Only GROUP_AT_MESSAGE_CREATE events are accepted. This module never reads
 * private QQ account sessions, historic conversations, or general group traffic.
 */
export function normalizeMention(msg) {
  if(!msg || msg.kind!=='group' ||
     msg.rawEventType!=='GROUP_AT_MESSAGE_CREATE' ||
     msg.senderIsBot===true)return null;
  if(typeof msg.messageId!=='string' || msg.messageId.length<1 ||
     typeof msg.groupOpenid!=='string' || msg.groupOpenid.length<1 ||
     typeof msg.content!=='string' || !msg.content.trim())return null;
  return {
    eventType:'GROUP_AT_MESSAGE_CREATE',
    mentioned:true,
    messageId:msg.messageId,
    groupOpenid:msg.groupOpenid,
    content:msg.content.trim().slice(0,3500),
  };
}
export function relaySignature(ts,raw,secret) {
  if(!secret||secret.length<32)throw Error('HAIZ_QQ_RELAY_SECRET must be >=32 characters');
  return createHmac('sha256',secret).update(String(ts)+'.'+raw).digest('hex');
}
export async function relayMention(msg,{baseUrl,secret,send=fetch,now=Date.now}){
  const event=normalizeMention(msg);
  if(!event)return {ignored:true};
  const url=new URL('/api/integrations/qq/event',baseUrl);
  const allowHttpLoopback=url.protocol==='http:'&&['127.0.0.1','localhost','::1'].includes(url.hostname);
  if(url.protocol!=='https:'&&!allowHttpLoopback)
    throw Error('QQ connector requires HTTPS for remote HAIZ Academic');
  const timestamp=String(now()),body=JSON.stringify(event);
  const response=await send(url.toString(),{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'x-haiz-timestamp':timestamp,
      'x-haiz-signature':relaySignature(timestamp,body,secret),
    },
    body,
    signal:AbortSignal.timeout(10000),
  });
  if(!response.ok)throw Error('HAIZ Academic rejected event: '+response.status);
  return await response.json();
}
async function main(){
  const appId=process.env.HAIZ_QQ_APP_ID;
  const appSecret=process.env.HAIZ_QQ_APP_SECRET;
  const relaySecret=process.env.HAIZ_QQ_RELAY_SECRET;
  const baseUrl=process.env.HAIZ_ACADEMIC_URL||'http://127.0.0.1:8780';
  if(!appId||!appSecret||!relaySecret||relaySecret.length<32)
    throw Error('Missing official QQ Bot AppID/AppSecret or HAIZ signed relay secret');
  const {QQBot}=await import('@tencent-connect/qqbot-nodejs');
  const bot=new QQBot({appId,appSecret});
  bot.on('ready',()=>console.log('[HAIZ QQ] Bot online; forwarding only @mention events'));
  bot.on('message',async (_ctx,msg)=>{
    if(!normalizeMention(msg))return;
    try{
      const result=await relayMention(msg,{baseUrl,secret:relaySecret});
      console.log('[HAIZ QQ] mention delivered to review queue:',result.accepted===true);
    }catch(error){
      console.error('[HAIZ QQ] failed to relay authorized event:',error.message);
    }
  });
  await bot.start();
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  main().catch(error=>{
    console.error('[HAIZ QQ]',error.message);
    process.exitCode=1;
  });
}
