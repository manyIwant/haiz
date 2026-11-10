import { DurableObject } from 'cloudflare:workers';
import { createCloudRepository } from './sqlite.mjs';
import { createCloudApi } from './api.mjs';
import { createCloudRooms } from './rooms.mjs';
import { createGateway } from './gateway.mjs';
import { hash } from '../auth.mjs';

export class HaizBackend extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env); this.ctx = ctx;
    ctx.blockConcurrencyWhile(async () => {
      const repository = createCloudRepository(ctx.storage);
      this.database = { call: async (operation, args = {}) => repository.run(operation, args) };
      // Cloud production starts empty. No local development database is uploaded.
      if (/^[\w-]{43}$/.test(env.BOOTSTRAP_INVITE || '')) {
        repository.run('bootstrap', { tokenHash: hash(env.BOOTSTRAP_INVITE), inviteMs: 24 * 3600000 });
      } else if (repository.run('metrics', {}).users === 0) {
        throw new Error('Cloud administrator bootstrap is not configured');
      }
      this.rooms = createCloudRooms(this.database);
      this.api = createCloudApi({ database: this.database, env, rooms: this.rooms });
      if (await ctx.storage.getAlarm() === null) await ctx.storage.setAlarm(Date.now() + 3600000);
    });
  }
  fetch(request) { return this.api.fetch(request); }
  async alarm() {
    await this.database.call('cleanup');
    await this.ctx.storage.setAlarm(Date.now() + 3600000);
  }
}

export default {
  async fetch(request, env) {
    try {
      const backend = env.HAIZ_DB.getByName('haiz-global-v1');
      return await createGateway({ backend, assets: env.ASSETS, origin: env.PUBLIC_ORIGIN, development: env.DEV === '1' })(request);
    } catch {
      return Response.json({ error: '服务暂时不可用，请稍后重试' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '2' } });
    }
  },
};
