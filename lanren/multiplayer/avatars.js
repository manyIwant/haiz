/**
 * Three.js-facing presentation only. A replacement avatar needs
 * { root, update(speed, airborne, dt, state), dispose?() }.
 */
export function createRemotePlayers({ scene, createAvatar, maxAvatars = 6, far = 120,
  onError = error => console.error(error) }) {
  const records = new Map();
  let disposed = false;
  function dispose(avatar) {
    avatar.root.removeFromParent?.();
    avatar.dispose?.();
  }
  function drop(id, record) {
    records.delete(id);
    if (record.avatar) dispose(record.avatar);
  }
  function start(id) {
    const record = { avatar: null, accumulated: 0, failedAt: 0 };
    records.set(id, record);
    Promise.resolve().then(() => createAvatar(id)).then(avatar => {
      if (disposed || records.get(id) !== record) { dispose(avatar); return; }
      record.avatar = avatar;
      avatar.root.visible = false; // attach without flashing at origin
      scene.add(avatar.root);
    }).catch(error => {
      if (disposed || records.get(id) !== record) return;
      record.failedAt = performance.now();
      onError(error);
    });
    return record;
  }
  return {
    update(players, position, dt) {
      if (disposed) return;
      const nearby = players.filter(player => !player.isLocal && player.source !== 'npc' && player.source !== 'ecosystem')
        .map(player => ({ player, distance: Math.hypot(player.x - position.x, player.z - position.z) }))
        .filter(({ player, distance }) => distance <= far + (records.has(player.id) ? 8 : 0))
        .sort((a, b) => (a.distance - (records.has(a.player.id) ? 4 : 0)) -
          (b.distance - (records.has(b.player.id) ? 4 : 0)))
        .slice(0, maxAvatars);
      const wanted = new Set(nearby.map(({ player }) => player.id));
      for (const [id, record] of records) if (!wanted.has(id)) drop(id, record);
      for (const { player, distance } of nearby) {
        let record = records.get(player.id);
        if (!record || (record.failedAt && performance.now() - record.failedAt > 8000)) record = start(player.id);
        const avatar = record.avatar;
        if (!avatar) continue;
        const first = !avatar.root.visible;
        avatar.root.position.set(player.x, player.y, player.z);
        avatar.root.rotation.y = player.yaw;
        avatar.root.visible = true;
        record.accumulated += dt;
        if (first || distance < 45 || record.accumulated >= 1 / 15) {
          avatar.update(player.speed, player.motion === 'jump', Math.min(record.accumulated, 0.12), player);
          record.accumulated = 0;
        }
      }
    },
    destroy() {
      disposed = true;
      for (const [id, record] of records) drop(id, record);
    },
    get count() { return [...records.values()].filter(r => r.avatar?.root.visible).length; },
  };
}
