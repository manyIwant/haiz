// The static host always serves index.html. Keep one cinematic source of truth,
// and retain the editorial home at journal.html rather than redirecting visitors.
const fs=require('node:fs');
for(const file of fs.readdirSync('.').filter(p=>p.endsWith('.html')&&p!=='index.html')){
  let html=fs.readFileSync(file,'utf8');
  if(!html.includes('assets/css/experience.css'))html=html.replace('</head>','<link rel="stylesheet" href="assets/css/experience.css?v=9"><script defer src="assets/js/experience.js?v=9"></script></head>');
  html=html.replace(/assets\/(css\/experience\.css|js\/experience\.js)\?v=\d+/g,'assets/$1?v=9');
  fs.writeFileSync(file,html);
}
fs.copyFileSync('descent.html','index.html');
console.log('Cinematic index.html ready; editorial home preserved at journal.html.');
