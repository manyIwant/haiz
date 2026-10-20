// The static host always serves index.html. Keep one cinematic source of truth,
// and retain the editorial home at journal.html rather than redirecting visitors.
const fs=require('node:fs');
for(const file of fs.readdirSync('.').filter(p=>p.endsWith('.html')&&p!=='index.html')){
  let html=fs.readFileSync(file,'utf8');
  if(!html.includes('assets/css/experience.css'))html=html.replace('</head>','<link rel="stylesheet" href="assets/css/experience.css?v=9"><script defer src="assets/js/experience.js?v=9"></script></head>');
  html=html.replace(/assets\/(css\/experience\.css|js\/experience\.js)\?v=\d+/g,'assets/$1?v=12');
  if(!html.includes('assets/css/atelier-ui.css'))html=html.replace('</head>','<link rel="stylesheet" href="assets/css/atelier-ui.css?v=10"><script defer src="assets/js/atelier-ui.js?v=10"></script></head>');
  html=html.replace(/assets\/(css\/atelier-ui\.css|js\/atelier-ui\.js|js\/journal\.js)\?v=\d+/g,'assets/$1?v=12');
  html=html.replace(/assets\/js\/journal\.js\?v=\d+/g,'assets/js/journal.js?v=24');
  if(file==='campus-3d.html'&&!html.includes('assets/walk/sports.js'))html=html.replace(/(<script defer src="assets\/walk\/world\.js)/,'<script defer src="assets/walk/sports.js?v=24"></script>\n  <script defer src="assets/walk/map.js?v=24"></script>\n  $1');
  html=html.replace(/assets\/walk\/(surfaces|architecture|atelier|app|climate|reflections|world|landscape|review|interiors|movement|decor|sports|map|campus-data)\.js\?v=\d+/g,'assets/walk/$1.js?v=24');
  html=html.replace(/assets\/js\/director\.js\?v=\d+/g,'assets/js/director.js?v=24');
  html=html.replace(/assets\/cinematic\/descent\.js\?v=\d+/g,'assets/cinematic/descent.js?v=21');
  html=html.replace(/assets\/walk\/style\.css\?v=\d+/g,'assets/walk/style.css?v=12');
  fs.writeFileSync(file,html);
}
fs.copyFileSync('descent.html','index.html');
console.log('Cinematic index.html ready; editorial home preserved at journal.html.');
