// Refresh shared site assets on every page except the homepage, which loads them itself.
const fs=require('node:fs');
// raise a cache-busting ?v=N to at least v, never lower one bumped by hand
const atLeast=v=>m=>m.replace(/\?v=(\d+)$/,(x,cur)=>`?v=${Math.max(Number(cur),v)}`);
for(const file of fs.readdirSync('.').filter(p=>p.endsWith('.html')&&p!=='index.html'&&p!=='physics-lab.html'&&p!=='physics-lab-practice.html')){
  let html=fs.readFileSync(file,'utf8');
  if(!html.includes('assets/css/experience.css'))html=html.replace('</head>','<link rel="stylesheet" href="assets/css/experience.css?v=9"><script defer src="assets/js/experience.js?v=9"></script></head>');
  html=html.replace(/(assets\/(css\/experience\.css|js\/experience\.js))\?v=(\d+)/g,atLeast(13));
  if(!html.includes('assets/css/atelier-ui.css'))html=html.replace('</head>','<link rel="stylesheet" href="assets/css/atelier-ui.css?v=10"><script defer src="assets/js/atelier-ui.js?v=10"></script></head>');
  html=html.replace(/(assets\/(css\/atelier-ui\.css|js\/atelier-ui\.js|js\/journal\.js))\?v=(\d+)/g,atLeast(12));
  html=html.replace(/(assets\/js\/journal\.js)\?v=(\d+)/g,atLeast(25));
  // the reading pages' own type, layout and colour system loads last (docs/haiz-art-direction-20261105.md)
  if(['journal.html','about.html','news.html','clubs.html','life.html','admissions.html','alumni.html','contact.html'].includes(file)){
    html=html.replace(/<link rel="stylesheet" href="assets\/css\/paper\.css\?v=\d+">\n?/g,'');
    html=html.replace('</head>','<link rel="stylesheet" href="assets/css/paper.css?v=1">\n</head>');
  }
  html=html.replace(/(assets\/js\/experience\.js)\?v=(\d+)/g,atLeast(13));
  if(['about.html','director.html','campus-3d.html'].includes(file)&&!html.includes('assets/walk/atlas-details.js'))html=html.replace('<script defer','<script defer src="assets/walk/atlas-details.js?v=25"></script>\n<script defer');
  if(file==='campus-3d.html'&&!html.includes('assets/walk/sports.js'))html=html.replace(/(<script defer src="assets\/walk\/world\.js)/,'<script defer src="assets/walk/sports.js?v=24"></script>\n  <script defer src="assets/walk/map.js?v=24"></script>\n  $1');
  html=html.replace(/(assets\/walk\/(surfaces|architecture|atelier|app|climate|reflections|world|landscape|review|interiors|movement|decor|sports|map|campus-data|atlas-details)\.js)\?v=(\d+)/g,atLeast(25));
  html=html.replace(/(assets\/js\/director\.js)\?v=(\d+)/g,atLeast(25));
  html=html.replace(/(assets\/cinematic\/descent\.js)\?v=(\d+)/g,atLeast(27));
  html=html.replace(/(assets\/walk\/style\.css)\?v=(\d+)/g,atLeast(12));
  fs.writeFileSync(file,html);
}
// index.html is the hand-authored tree homepage (lanren/); the cinematic descent
// lives on at descent.html and the editorial home at journal.html.
console.log('Shared assets refreshed; tree homepage at index.html, descent at descent.html, journal at journal.html.');
