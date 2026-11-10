import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { check } from './errors.mjs';
const derive = promisify(scrypt);
const options = { N: 65536, r: 8, p: 2, maxmem: 96 * 1024 * 1024 };
const dummy = 'scrypt$' + '00'.repeat(16) + '$' + '00'.repeat(64);
export const hash = value => createHash('sha256').update(value).digest('hex');
export const secret = () => randomBytes(32).toString('base64url');
export function validPassword(password) { check(typeof password === 'string' && password.length >= 12 && Buffer.byteLength(password) <= 256, 400, '密码须为至少 12 个字符，且不超过 256 字节'); }
export function passwords({ maxConcurrent = 4 } = {}) {
  check(Number.isInteger(maxConcurrent) && maxConcurrent >= 1 && maxConcurrent <= 4, 500, '登录服务配置无效');
  let active = 0;
  const work = async callback => {
    check(active < maxConcurrent, 503, '登录服务繁忙，请稍后重试');
    active++;
    try { return await callback(); } finally { active--; }
  };
  return {
    create: password => work(async () => {
      validPassword(password);
      const salt = randomBytes(16).toString('hex');
      const key = await derive(password, salt, 64, options);
      return `scrypt$${salt}$${key.toString('hex')}`;
    }),
    verify: (password, encoded) => work(async () => {
      check(typeof password === 'string' && Buffer.byteLength(password) <= 256, 400, '密码格式无效');
      const [, salt, expected] = (encoded || dummy).split('$');
      const actual = await derive(password, salt, 64, options);
      return timingSafeEqual(actual, Buffer.from(expected, 'hex')) && Boolean(encoded);
    }),
  };
}

export function rateLimiter() {
  const buckets = new Map();
  function clean() { const now = Date.now(); for (const [key, value] of buckets) if (value.until <= now) buckets.delete(key); }
  return {
    take(key, max, ms = 60000) {
      if (buckets.size >= 10000) { clean(); check(buckets.size < 10000 || buckets.has(key), 429, '请求过多，请稍后重试'); }
      const now = Date.now(); let bucket = buckets.get(key);
      if (!bucket || bucket.until <= now) { bucket = { count: 0, until: now + ms }; buckets.set(key, bucket); }
      bucket.count++; check(bucket.count <= max, 429, '请求过于频繁，请稍后重试');
    }, clean,
  };
}
