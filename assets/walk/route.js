/* A* over the actual collision model. Edges are sampled, never teleported or splined through walls. */
(function(root){'use strict';
function planner(world,M){
 const buckets=new Map(),bounds=world.bounds,cache=new Map();
 for(const c of world.colliders)for(let x=Math.floor((c.minX-1)/10);x<=Math.floor((c.maxX+1)/10);x++)for(let z=Math.floor((c.minZ-1)/10);z<=Math.floor((c.maxZ+1)/10);z++){const k=x+','+z;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(c);}
 const margin=.6;
 function blocked(x,z){if(M.blocked(x,z,[],bounds,margin))return true;return (buckets.get(Math.floor(x/10)+','+Math.floor(z/10))||[]).some(c=>x>=c.minX-margin&&x<=c.maxX+margin&&z>=c.minZ-margin&&z<=c.maxZ+margin);}
 function clear(a,b){
  if(blocked(a.x,a.z)||blocked(b.x,b.z))return false;
  const candidates=new Set();
  for(let x=Math.floor(Math.min(a.x,b.x)/10);x<=Math.floor(Math.max(a.x,b.x)/10);x++)for(let z=Math.floor(Math.min(a.z,b.z)/10);z<=Math.floor(Math.max(a.z,b.z)/10);z++)for(const c of buckets.get(x+','+z)||[])candidates.add(c);
  // Slab intersection with expanded obstacles: catches even a tiny corner crossing.
  for(const c of candidates){let lo=0,hi=1;for(const [v,d,min,max] of [[a.x,b.x-a.x,c.minX-margin,c.maxX+margin],[a.z,b.z-a.z,c.minZ-margin,c.maxZ+margin]]){if(Math.abs(d)<1e-10){if(v<min||v>max){lo=2;break;}}else{const t1=(min-v)/d,t2=(max-v)/d;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));}}if(lo<=hi)return false;}
  return true;
 }
 function grid(x,z){const k=x+','+z;if(!cache.has(k))cache.set(k,blocked(x,z));return cache.get(k);}
 function snap(p){for(let r=0;r<=4;r++)for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++){const q={x:Math.round(p.x)+x,z:Math.round(p.z)+z};if(!grid(q.x,q.z)&&clear(p,q))return q;}return null;}
 function find(from,to){
  const start=snap(from),goal=snap(to);if(!start||!goal)return null;
  const key=p=>p.x+','+p.z,goalKey=key(goal),heap=[],best=new Map(),closed=new Set();
  function push(n){heap.push(n);let i=heap.length-1;while(i){let p=(i-1)>>1;if(heap[p].f<=n.f)break;heap[i]=heap[p];i=p;}heap[i]=n;}
  function pop(){const first=heap[0],end=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let k=i*2+1;if(k+1<heap.length&&heap[k+1].f<heap[k].f)k++;if(heap[k].f>=end.f)break;heap[i]=heap[k];i=k;}heap[i]=end;}return first;}
  push({...start,g:0,f:0,parent:null});best.set(key(start),0);
  while(heap.length&&closed.size<100000){const n=pop(),k=key(n);if(closed.has(k))continue;if(k===goalKey){const path=[to];for(let p=n;p;p=p.parent)path.push({x:p.x,z:p.z});path.push(from);path.reverse();const simple=[path[0]];let i=0;while(i<path.length-1){let j=Math.min(path.length-1,i+24);while(j>i+1&&!clear(path[i],path[j]))j--;simple.push(path[j]);i=j;}return simple;}
   closed.add(k);for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const x=n.x+dx,z=n.z+dz,q={x,z},qk=key(q),g=n.g+Math.hypot(dx,dz);if(closed.has(qk)||grid(x,z)||g>=(best.get(qk)??Infinity)||!clear(n,q))continue;best.set(qk,g);push({x,z,g,f:g+Math.hypot(goal.x-x,goal.z-z),parent:n});}
  }return null;
 }
 return {find,clear};
}
root.CampusRoute={planner};
})(typeof window==='undefined'?globalThis:window);
