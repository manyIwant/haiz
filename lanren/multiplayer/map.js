import { FRAME_ID, wrapYaw } from './protocol.js';

/** The frame comes from geo.js makeFrame/buildGeo; it must describe the incoming world. */
export function projectPlayer(player, frame) {
  const { x, z } = frame.toCampus(player.x, player.z);
  const { originPx, scale } = frame.transform;
  return Object.freeze({
    ...player,
    campus: Object.freeze({ x, z, yaw: wrapYaw(player.yaw - frame.rotation) }),
    plan: Object.freeze({ px: originPx[0] + x / scale, py: originPx[1] - z / scale }),
  });
}

export function createMapAccess(client, frame) {
  return Object.freeze({
    frameId: FRAME_ID,
    project: player => projectPlayer(player, frame),
    getPlayers: opts => client.getPlayers(opts).map(player => projectPlayer(player, frame)),
    getPlayer(id, opts) {
      const player = client.getPlayer(id, opts);
      return player ? projectPlayer(player, frame) : null;
    },
    subscribe: (event, callback) => client.subscribe(event, event === 'connection' ? callback :
      event => callback(Object.freeze({ ...event, player: projectPlayer(event.player, frame) }))),
    getConnection: () => client.getConnection(),
  });
}
