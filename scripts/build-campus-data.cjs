const fs = require('node:fs');

const input = JSON.parse(fs.readFileSync('assets/walk/campus.json', 'utf8'));
const output = `/* Generated from campus.json for file:// and offline fallback. */\nwindow.CAMPUS_DATA = ${JSON.stringify(input)};\n`;
fs.writeFileSync('assets/walk/campus-data.js', output);
