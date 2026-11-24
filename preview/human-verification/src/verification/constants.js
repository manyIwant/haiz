/**
 * HAIZ Human Verification — Core Constants, States & Theme Tokens
 * Zero external dependencies.
 */

export const VerificationState = Object.freeze({
  IDLE: 'IDLE',
  WAKING: 'WAKING',
  SEEKING: 'SEEKING',
  DESCENDING: 'DESCENDING',
  GRASPING: 'GRASPING',
  LIFTING: 'LIFTING',
  CARRYING: 'CARRYING',
  DROPPING: 'DROPPING',
  VERIFYING: 'VERIFYING',
  SUCCESS: 'SUCCESS',
  RETRY_HINT: 'RETRY_HINT',
  ERROR: 'ERROR',
  CLOSED: 'CLOSED'
});

export const THEMES = Object.freeze({
  porcelain: {
    id: 'porcelain',
    label: 'Porcelain',
    labelZh: '素瓷',
    backdrop: 'rgba(18, 22, 28, 0.52)',
    cardBg: '#F9F9F7',
    cardBorder: 'rgba(20, 24, 31, 0.08)',
    cardShadow: '0 28px 72px rgba(15, 23, 36, 0.24), 0 4px 16px rgba(15, 23, 36, 0.08)',
    textPrimary: '#1A1D23',
    textSecondary: '#666E7A',
    textMuted: '#8F97A3',
    surfaceSubtle: '#EFEFEF',
    surfaceWell: '#E8E9EC',
    pillActiveBg: '#FFFFFF',
    pillActiveShadow: '0 1px 4px rgba(16, 20, 28, 0.10)',
    accent: '#E25B4A',
    accentHover: '#D34B3A',
    accentGlow: 'rgba(226, 91, 74, 0.28)',
    success: '#1F9D68',
    successBg: '#E7F6EE',
    successBorder: '#B7E4CE',
    stageBg: 0xF3F2EE,
    stageFloor: 0xEAE8E2,
    cabinetFrame: 0xE2E0DA,
    metalTint: 0xD8DDE3,
    ambientHex: 0xFFFBF5,
    keyLightHex: 0xFFF8EE,
    rimLightHex: 0xDDEEFF,
    chuteGlow: 0x1F9D68
  },
  obsidian: {
    id: 'obsidian',
    label: 'Obsidian',
    labelZh: '黑曜',
    backdrop: 'rgba(6, 8, 12, 0.72)',
    cardBg: '#16181D',
    cardBorder: 'rgba(255, 255, 255, 0.09)',
    cardShadow: '0 32px 84px rgba(0, 0, 0, 0.62), 0 2px 12px rgba(0, 0, 0, 0.40)',
    textPrimary: '#F2F3F5',
    textSecondary: '#A1A7B3',
    textMuted: '#6D7482',
    surfaceSubtle: '#22252D',
    surfaceWell: '#1D2027',
    pillActiveBg: '#2E323C',
    pillActiveShadow: '0 1px 6px rgba(0, 0, 0, 0.35)',
    accent: '#E06753',
    accentHover: '#EE7662',
    accentGlow: 'rgba(224, 103, 83, 0.34)',
    success: '#34C386',
    successBg: 'rgba(52, 195, 134, 0.14)',
    successBorder: 'rgba(52, 195, 134, 0.36)',
    stageBg: 0x1F222A,
    stageFloor: 0x262A34,
    cabinetFrame: 0x2F3440,
    metalTint: 0xC6CCD6,
    ambientHex: 0xD8DFEE,
    keyLightHex: 0xFFEED8,
    rimLightHex: 0x8EB8E5,
    chuteGlow: 0x34C386
  },
  ocean: {
    id: 'ocean',
    label: 'Ocean',
    labelZh: '南海',
    backdrop: 'rgba(10, 24, 36, 0.58)',
    cardBg: '#F3F7FA',
    cardBorder: 'rgba(22, 62, 92, 0.11)',
    cardShadow: '0 28px 72px rgba(10, 34, 56, 0.28), 0 4px 16px rgba(10, 34, 56, 0.09)',
    textPrimary: '#13283B',
    textSecondary: '#4E6A82',
    textMuted: '#7B95AB',
    surfaceSubtle: '#E3EDF4',
    surfaceWell: '#DAE6EF',
    pillActiveBg: '#FFFFFF',
    pillActiveShadow: '0 1px 4px rgba(16, 48, 76, 0.10)',
    accent: '#D95D48',
    accentHover: '#C64D39',
    accentGlow: 'rgba(217, 93, 72, 0.28)',
    success: '#178F7A',
    successBg: '#E1F4F0',
    successBorder: '#A9DFD4',
    stageBg: 0xE8F1F7,
    stageFloor: 0xDCE8F0,
    cabinetFrame: 0xCFDDE8,
    metalTint: 0xD4DFE8,
    ambientHex: 0xF0F7FF,
    keyLightHex: 0xFFFBF2,
    rimLightHex: 0x9ED4F5,
    chuteGlow: 0x178F7A
  }
});

export const CABINET_BOUNDS = Object.freeze({
  minX: -2.25,
  maxX: 2.25,
  chuteX: -1.88,
  chuteRadius: 0.62,
  floorY: -1.32,
  railY: 1.62,
  restClawY: 1.02,
  grabMinY: -0.78
});

export const DEFAULT_OPTIONS = Object.freeze({
  theme: 'porcelain',
  soundEnabled: true,
  reducedMotion: false,
  timeoutMs: 120000,
  locale: 'zh-CN',
  closeOnBackdrop: false
});
