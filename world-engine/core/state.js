// HAIZ World Engine — Authoritative World & User State Store
// Strictly separates:
//   1. `world`     — deterministic shared campus simulation state (clock, weather, phenology, entities)
//   2. `user`      — private local observer state (pose, lens, field notes, science records; never leaked)
//   3. `authority` — explicit input & camera ownership arbiter (`explore | map | lab | story | inspect`)

export const AUTHORITIES = Object.freeze(['explore', 'map', 'lab', 'story', 'inspect']);
export const VALID_LENSES = Object.freeze(['gouache', 'inkwash', 'realist', 'memory', 'nocturne', 'dream']);

const STORAGE_KEY = 'haiz.world-engine.user.v1';

function loadUserSnapshot(storage) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function createWorldState({ bus, storage = globalThis.localStorage } = {}) {
  const saved = loadUserSnapshot(storage);

  const state = {
    schema: 'haiz-world-state/1',
    authority: 'explore',
    world: {
      clockMs: Date.now(),
      clockMode: 'live',          // 'live' | 'free' | 'era'
      eraId: 'live',
      eraLabel: '海口此刻',
      haikouHour: 12,
      dayOfYear: 1,
      weatherId: 'clear',
      weatherLabel: '晴',
      weatherOrigin: 'climatology',
      temperatureC: 26,
      humidityPct: 72,
      windSpeedMs: 2.5,
      windDirDeg: 135,
      rainIntensity: 0,
      wetness: 0,
      puddle: 0,
      sunAltDeg: 45,
      sunAzDeg: 180,
      nightFactor: 0,
      phenology: {
        stage: '夏叶',
        redness: 0,
        flush: 0,
        foliage: 1,
      },
      activePlaceId: 'lanshu',
      activePlaceName: '百年榄仁树',
      activeNpcCount: 0,
      butterflyCount: 0,
      catState: 'rest',
    },
    user: {
      lens: VALID_LENSES.includes(saved?.lens) ? saved.lens : 'gouache',
      cameraMode: 'third',        // 'third' | 'first'
      locomotionMode: 'walk',     // 'walk' | 'bike' | 'board' | 'broom'
      position: [-16, -0.85, -20],
      agl: 0,
      speedMs: 0,
      headingRad: 0.52,
      visitedPlaces: Array.isArray(saved?.visitedPlaces) ? saved.visitedPlaces : ['lanshu'],
      fieldNotes: Array.isArray(saved?.fieldNotes) ? saved.fieldNotes : [],
      scienceTrials: Array.isArray(saved?.scienceTrials) ? saved.scienceTrials : [],
      soundEnabled: saved?.soundEnabled ?? true,
    },
  };

  function persistUser() {
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({
        lens: state.user.lens,
        visitedPlaces: state.user.visitedPlaces.slice(-32),
        fieldNotes: state.user.fieldNotes.slice(-40),
        scienceTrials: state.user.scienceTrials.slice(-80),
        soundEnabled: state.user.soundEnabled,
      }));
    } catch {
      // Storage quota or private browsing mode: fail silently without disrupting experience.
    }
  }

  function setAuthority(next) {
    if (!AUTHORITIES.includes(next)) {
      throw new Error(`Invalid authority "${next}"`);
    }
    if (state.authority === next) return;
    const prev = state.authority;
    state.authority = next;
    bus?.emit('authority:change', { prev, next });
  }

  function setLens(lensId, meta = {}) {
    if (!VALID_LENSES.includes(lensId)) {
      throw new Error(`Invalid art lens "${lensId}"`);
    }
    const prev = state.user.lens;
    if (prev === lensId && !meta.force) return;
    state.user.lens = lensId;
    persistUser();
    bus?.emit('lens:change', { prev, next: lensId, ...meta });
  }

  function setUserPose({ x, y, z, agl = 0, speedMs = 0, headingRad = 0, locomotionMode = state.user.locomotionMode }) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !Number.isFinite(agl) || !Number.isFinite(speedMs)) {
      throw new Error(`Illegal non-finite user pose: (${x}, ${y}, ${z})`);
    }
    if (Math.abs(x) > 1000 || Math.abs(z) > 1000 || y < -30 || y > 150) {
      throw new Error(`User pose out of campus bounds: (${x}, ${y}, ${z})`);
    }
    state.user.position = [+x.toFixed(2), +y.toFixed(2), +z.toFixed(2)];
    state.user.agl = +agl.toFixed(2);
    state.user.speedMs = +speedMs.toFixed(2);
    state.user.headingRad = +headingRad.toFixed(4);
    state.user.locomotionMode = locomotionMode;
  }

  function markPlaceVisited(placeId, placeName) {
    const changed = state.world.activePlaceId !== placeId;
    state.world.activePlaceId = placeId;
    state.world.activePlaceName = placeName || placeId;
    if (placeId && !state.user.visitedPlaces.includes(placeId)) {
      state.user.visitedPlaces.push(placeId);
      persistUser();
    }
    if (changed) {
      bus?.emit('place:enter', { id: placeId, name: state.world.activePlaceName });
    }
  }

  function addFieldNote(note) {
    const entry = {
      id: `note-${Date.now().toString(36)}`,
      at: new Date().toISOString(),
      placeId: state.world.activePlaceId,
      placeName: state.world.activePlaceName,
      lens: state.user.lens,
      weather: state.world.weatherLabel,
      text: String(note || '').slice(0, 280),
    };
    state.user.fieldNotes.unshift(entry);
    persistUser();
    bus?.emit('user:note', entry);
    return entry;
  }

  function recordScienceTrial(trial) {
    const entry = {
      id: `sci-${Date.now().toString(36)}`,
      at: new Date().toISOString(),
      ...trial,
    };
    state.user.scienceTrials.unshift(entry);
    if (state.user.scienceTrials.length > 80) state.user.scienceTrials.length = 80;
    persistUser();
    bus?.emit('lab:sample', entry);
    return entry;
  }

  function exportUserContract() {
    // Strictly privacy-preserving portable payload compatible with backend/repository-core personal_data
    return {
      schema: 'haiz-user-world-profile/1',
      updatedAt: new Date().toISOString(),
      preferences: {
        lens: state.user.lens,
        soundEnabled: state.user.soundEnabled,
      },
      visitedPlaces: [...state.user.visitedPlaces],
      fieldNotes: [...state.user.fieldNotes],
      scienceTrials: [...state.user.scienceTrials],
    };
  }

  return {
    state,
    setAuthority,
    setLens,
    setUserPose,
    markPlaceVisited,
    addFieldNote,
    recordScienceTrial,
    persistUser,
    exportUserContract,
  };
}
