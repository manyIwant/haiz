// The static host always serves index.html. Keep one cinematic source of truth,
// and retain the editorial home at journal.html rather than redirecting visitors.
const fs=require('node:fs');
for(const file of fs.readdirSync('.').filter(p=>p.endsWith('.html')&&p!=='index.html')){
  let html=fs.readFileSync(file,'utf8');
  if(!html.includes('assets/css/experience.css'))html=html.replace('</head>','<link rel="stylesheet" href="assets/css/experience.css?v=8"><script defer src="assets/js/experience.js?v=8"></script></head>');
  fs.writeFileSync(file,html);
}
fs.copyFileSync('descent.html','index.html');
console.log('Cinematic index.html ready; editorial home preserved at journal.html.');
