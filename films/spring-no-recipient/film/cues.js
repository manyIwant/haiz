// 《春天没有收件人》 — single source of truth for timing.
// Shared by film.js (picture) and music/compose.py (score + sound design).
// Everything after "window.CUES =" must stay valid JSON.
window.CUES = {
  "fps": 30,
  "width": 1920,
  "height": 1080,
  "duration": 446,

  "recStartClock": "04:38:45",
  "recHeader": "Script started on 2026-11-21 04:38:45+00:00",

  "termSegments": [
    { "film": [4.0, 8.5],    "rec": [3.0, 7.5],    "label": "" },
    { "film": [8.5, 12.4],   "rec": [7.5, 11.4],   "label": "" },
    { "film": [12.4, 15.0],  "rec": [11.4, 14.0],  "label": "" },
    { "film": [15.0, 28.9],  "rec": [14.0, 69.6],  "label": "×4" },
    { "film": [28.9, 37.0],  "rec": [69.6, 69.6],  "label": "" },
    { "film": [37.0, 41.0],  "rec": [88.7, 96.7],  "label": "×2", "skip": "略过 19 秒空闲" },
    { "film": [41.0, 50.6],  "rec": [96.7, 135.2], "label": "×4" },
    { "film": [50.6, 58.0],  "rec": [135.2, 135.2], "label": "" },
    { "film": [118.0, 122.7],"rec": [155.5, 164.8],"label": "×2", "skip": "略过 20 秒空闲" },
    { "film": [122.7, 131.3],"rec": [164.8, 199.2],"label": "×4" },
    { "film": [131.3, 141.0],"rec": [199.2, 199.2],"label": "" },
    { "film": [141.0, 144.3],"rec": [222.2, 228.7],"label": "×2", "skip": "略过 23 秒空闲" },
    { "film": [144.3, 150.5],"rec": [228.7, 253.6],"label": "×4" },
    { "film": [150.5, 157.0],"rec": [253.6, 253.6],"label": "" },
    { "film": [320.0, 334.0],"rec": [255.0, 255.0],"label": "" }
  ],

  "acts": {
    "open":       [0, 58],
    "mechanism":  [58, 118],
    "things":     [118, 141],
    "sweep":      [141, 176],
    "junction":   [176, 222],
    "smallpoem":  [222, 246],
    "poem1":      [246, 320],
    "interlude":  [320, 334],
    "poem2":      [334, 418],
    "ending":     [418, 428],
    "credits":    [428, 446]
  },

  "poem1": { "title": [246, 251], "lines": [251, 256.45, 261.9, 267.35, 272.8, 278.25, 283.7, 289.15, 294.6, 300.05, 305.5], "end": 311, "page": [311, 320] },
  "poem2": { "title": [334, 340], "lines": [340, 346.5, 353, 359, 365.5, 375, 382, 388, 394.5, 401], "end": 408, "page": [408, 418] },

  "music": {
    "firstNote": 12.4,
    "processIn": 15.0,
    "mechanismIn": 58.0,
    "junctionBuild": 186.0,
    "junctionLand": 199.5,
    "smallpoem": 222.0,
    "poem1": 246.0,
    "interlude": 320.0,
    "poem2": 334.0,
    "silenceStart": 367.0,
    "silenceEnd": 375.0,
    "poem2Peak": 375.0,
    "ending": 418.0,
    "credits": 428.0
  }
};
