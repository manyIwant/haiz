const fs = require('node:fs');

const input = JSON.parse(fs.readFileSync('assets/walk/campus.json', 'utf8'));
const sports = JSON.parse(fs.readFileSync('data/campus-sports.json', 'utf8'));
input.sports = sports.areas.map(area => {
  const footprint = input.lawns.find(lawn => lawn.id === area.sourceLawn);
  if (!footprint) throw new Error('Missing legacy sports footprint: ' + area.sourceLawn);
  return {...area, rect: footprint.rect.slice()};
});
input.meta.sportsReview = {revision: sports.revision, reference: sports.reference};
fs.writeFileSync('assets/walk/campus.json', JSON.stringify(input) + '\n');
const output = `/* Generated from campus.json for file:// and offline fallback. */\nwindow.CAMPUS_DATA = ${JSON.stringify(input)};\n`;
fs.writeFileSync('assets/walk/campus-data.js', output);
