/* Original classroom interpretation for haiz.space. Real school interiors are not surveyed.
   PBR maps: Poly Haven CC0, bundled locally. See assets/credits.json. */
(function(global){'use strict';
  const T=THREE;
  const unitBox=new T.BoxGeometry(1,1,1),unitCylinder=new T.CylinderGeometry(1,1,1,12),unitPlane=new T.PlaneGeometry(1,1);
  const roomRecords=[],fanRecords=[];
  let materials=null;
  function textureCanvas(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;return t;}
  function seed(n){return ()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};}
  async function loadMaterials(progress){
    const bank={},loader=new T.TextureLoader(),jobs=[];let done=0;
    for(const name of ['terrazzo','plaster','wood','grass','paving']){
      bank[name]={};
      for(const type of ['color','normal','rough'])jobs.push(new Promise(resolve=>{
        let settled=false;
        const timer=setTimeout(()=>finish(null),12000);
        function finish(tex){
          if(settled){if(tex)tex.dispose();return;}settled=true;clearTimeout(timer);
          if(tex){tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.anisotropy=4;if(type==='color')tex.encoding=T.sRGBEncoding;bank[name][type]=tex;}
          done++;if(progress)progress(done/16);resolve();
        }
        loader.load('assets/walk/textures/'+name+'-'+type+'.jpg',finish,undefined,()=>finish(null));
      }));
    }
    jobs.push(new Promise(resolve=>{let settled=false;const timer=setTimeout(()=>finish(null),12000);function finish(tex){if(settled){tex?.dispose();return;}settled=true;clearTimeout(timer);if(tex){tex.encoding=T.sRGBEncoding;tex.anisotropy=4;bank.foliage=tex;}done++;if(progress)progress(done/16);resolve();}loader.load('assets/walk/textures/terminalia-leaves.webp',finish,undefined,()=>finish(null));}));
    await Promise.all(jobs);return bank;
  }
  function surface(bank,key,color,roughness,repeat){
    const maps=bank[key]||{},mat=new T.MeshStandardMaterial({color,roughness,metalness:0});
    for(const [type,field] of [['color','map'],['normal','normalMap'],['rough','roughnessMap']])if(maps[type]){
      const tex=maps[type].clone();tex.needsUpdate=true;tex.repeat.set(repeat[0],repeat[1]);mat[field]=tex;
    }
    if(mat.normalMap)mat.normalScale.set(.22,.22);return mat;
  }
  function init(bank){
    roomRecords.length=fanRecords.length=0;
    materials={
      floor:surface(bank,'terrazzo','#e7e1cc',.76,[5,5]),
      wall:surface(bank,'plaster','#f5eedb',.95,[2,1]),
      plasterOutside:surface(bank,'plaster','#e8e3d1',.94,[8,2]),
      desk:surface(bank,'wood','#d3b181',.62,[.7,.7]),
      chair:surface(bank,'wood','#b4956d',.7,[.55,.55]),
      dado:new T.MeshStandardMaterial({color:'#a3b7a3',roughness:.87}),
      ceiling:new T.MeshStandardMaterial({color:'#eee9dc',roughness:1}),
      frame:new T.MeshStandardMaterial({color:'#7c8d83',roughness:.45,metalness:.35}),
      steel:new T.MeshStandardMaterial({color:'#69766f',roughness:.38,metalness:.6}),
      dark:new T.MeshStandardMaterial({color:'#444c41',roughness:.88}),
      paper:new T.MeshStandardMaterial({color:'#eee9d8',roughness:.95}),
      book:new T.MeshStandardMaterial({color:'#5d7974',roughness:.8}),
      glass:new T.MeshStandardMaterial({color:'#c3d7cc',transparent:true,opacity:.18,roughness:.2,metalness:.15,depthWrite:false}),
      fan:new T.MeshStandardMaterial({color:'#aab7b0',roughness:.55,metalness:.3}),
      door:new T.MeshStandardMaterial({color:'#667d6f',roughness:.62}),
      emissive:new T.MeshStandardMaterial({color:'#fff6df',emissive:'#fff0c5',emissiveIntensity:.5,roughness:.7})
    };
    const shade=textureCanvas(64,64,ctx=>{const gr=ctx.createRadialGradient(32,32,4,32,32,32);gr.addColorStop(0,'rgba(29,38,29,.28)');gr.addColorStop(1,'rgba(29,38,29,0)');ctx.fillStyle=gr;ctx.fillRect(0,0,64,64);});
    materials.contact=new T.MeshBasicMaterial({map:shade,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
    return materials;
  }
  function meshBox(parent,mat,w,h,d,x,y,z){const m=new T.Mesh(unitBox,mat);m.scale.set(w,h,d);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function label(parent,text,sub,w,h,x,y,z,ry=0){
    const tex=textureCanvas(768,192,(ctx)=>{ctx.fillStyle='#304c40';ctx.fillRect(0,0,768,192);ctx.strokeStyle='#c6b17e';ctx.lineWidth=2;ctx.strokeRect(10,10,748,172);ctx.fillStyle='#f1e6c9';ctx.textAlign='center';ctx.font='48px serif';ctx.fillText(text,384,83);ctx.font='23px sans-serif';ctx.fillStyle='#cad0b5';ctx.fillText(sub,384,137);});
    const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map:tex,roughness:.8}));m.position.set(x,y,z);m.rotation.y=ry;parent.add(m);return m;
  }
  function roundTop(){
    const w=.68,d=.48,r=.035,shape=new T.Shape();shape.moveTo(-w/2+r,-d/2);shape.lineTo(w/2-r,-d/2);shape.quadraticCurveTo(w/2,-d/2,w/2,-d/2+r);shape.lineTo(w/2,d/2-r);shape.quadraticCurveTo(w/2,d/2,w/2-r,d/2);shape.lineTo(-w/2+r,d/2);shape.quadraticCurveTo(-w/2,d/2,-w/2,d/2-r);shape.lineTo(-w/2,-d/2+r);shape.quadraticCurveTo(-w/2,-d/2,-w/2+r,-d/2);
    const g=new T.ExtrudeGeometry(shape,{depth:.035,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.008,bevelThickness:.006,curveSegments:3});g.rotateX(-Math.PI/2);g.translate(0,-.0175,0);return g;
  }
  const topGeometry=roundTop();
  function batcher(group){
    const groups=new Map(),dummy=new T.Object3D();
    return {
      put(key,mat,geo,x,y,z,sx,sy,sz,ry=0,rx=0){
        if(!groups.has(key))groups.set(key,{mat,geo,transforms:[]});
        dummy.position.set(x,y,z);dummy.rotation.set(rx,ry,0);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();groups.get(key).transforms.push(dummy.matrix.clone());
      },
      flush(){for(const [key,b] of groups){const im=new T.InstancedMesh(b.geo,b.mat,b.transforms.length);b.transforms.forEach((m,i)=>im.setMatrixAt(i,m));im.castShadow=key!=='contact';im.receiveShadow=true;im.userData.interiorBatch=key;im.userData.noMerge=true;group.add(im);}}
    };
  }
  const themes=[
    {title:'数学 · 函数的单调性',lines:['f(x) = x² − 2x + 1 = (x − 1)²','x < 1 : 单调递减     x > 1 : 单调递增','思考：图像的对称轴为什么是 x = 1？']},
    {title:'ENGLISH · AN ISLAND IN WORDS',lines:['Hainan — light, salt and song.','Describe a place through what you notice.','Where does a journey really begin?']},
    {title:'物理 · 运动与参照系',lines:['v = Δx / Δt       a = Δv / Δt','选择参照系，再描述运动。','观察 → 假设 → 实验 → 修正']},
    {title:'地理 · 岛屿与海洋',lines:['20°N · HAINAN','海陆热力性质差异 → 海陆风','红树林：潮汐、淤泥与生命的交会']}
  ];
  function chalkboard(parent,room,sx,zmid,core){
    const info=themes[room],board=textureCanvas(1024,512,(ctx,w,h)=>{
      ctx.fillStyle='#29483d';ctx.fillRect(0,0,w,h);const rnd=seed(room+55);
      for(let i=0;i<3200;i++){ctx.fillStyle='rgba(225,226,194,'+(rnd()*.025)+')';ctx.fillRect(rnd()*w,rnd()*h,1+rnd()*20,1);}
      ctx.strokeStyle='#c4cfb155';ctx.lineWidth=1;ctx.strokeRect(25,25,w-50,h-50);ctx.fillStyle='#e6e2c9';ctx.font='36px serif';ctx.fillText(info.title,65,102);ctx.strokeStyle='#c4cfb188';ctx.beginPath();ctx.moveTo(65,131);ctx.lineTo(950,131);ctx.stroke();ctx.font='27px serif';info.lines.forEach((line,i)=>ctx.fillText(line,65,205+i*76));
    });
    const x=sx*(core-.24),ry=sx===1?-Math.PI/2:Math.PI/2;
    const frame=meshBox(parent,materials.chair,.1,1.62,4.9,x,2.0,zmid);
    const panel=new T.Mesh(new T.PlaneGeometry(4.65,1.43),new T.MeshStandardMaterial({map:board,roughness:.94}));panel.rotation.y=ry;panel.position.set(x-sx*.06,2.0,zmid);parent.add(panel);
    meshBox(parent,materials.frame,.18,.055,4.9,x-sx*.11,1.18,zmid);
    label(parent,'尚德 · 睿智 · 唯实 · 创新','HAINAN MIDDLE SCHOOL',4.65,.32,x-sx*.07,3.17,zmid,ry);
  }
  function classroom(parent,b,o,sx,sz,core,roomIndex,roomW,roomD){
    const zmid=sz*(1.5+roomD/2),xmin=sx<0?-core:1.8,xmax=sx<0?-1.8:core;
    const detail=new T.Group();detail.userData.noMerge=true;detail.userData.interior=true;parent.add(detail);
    const name=b.id+'-'+(101+roomIndex),doorX=sx*3.2,doorZ=sz*1.5;
    // Real opening in the corridor wall. No invisible door collider.
    const lo=doorX-.78,hi=doorX+.78,wallMat=materials.wall,fh=b.floorH;
    for(const [l,r] of [[xmin,lo],[hi,xmax]])if(r>l){meshBox(parent,wallMat,r-l,fh-.13,.19,(r+l)/2,(fh+.13)/2,doorZ);meshBox(parent,materials.dado,r-l,.94,.215,(r+l)/2,.6,doorZ);}
    meshBox(parent,wallMat,1.56,fh-2.5,.19,doorX,(fh+2.5)/2,doorZ);
    // Door leaf is fixed open inside the jamb, with an actual clear doorway.
    const door=meshBox(detail,materials.door,.075,2.3,.77,lo+.08,1.29,doorZ+sz*.42);
    meshBox(detail,materials.frame,.045,.14,.11,lo+.025,1.13,doorZ+sz*.7);
    label(parent,'1'+String(roomIndex+1).padStart(2,'0')+' · 教室','想象室内 / OPEN CLASSROOM',1.18,.34,doorX,2.9,doorZ-sz*.12,sz>0?Math.PI:0);
    // Warm terrazzo underfoot, with a narrow skirting line at the walls.
    meshBox(detail,materials.floor,roomW,.09,roomD,(xmin+xmax)/2,.085,zmid);
    meshBox(detail,materials.ceiling,roomW,.1,roomD,(xmin+xmax)/2,fh-.18,zmid);
    meshBox(detail,materials.dado,.035,.12,roomD,xmin+.14,.22,zmid);meshBox(detail,materials.dado,.035,.12,roomD,xmax-.14,.22,zmid);
    chalkboard(detail,roomIndex,sx,zmid,core);
    const batches=batcher(detail),obstacles=[];
    function put(key,mat,geo,x,y,z,scale,ry=0,rx=0){batches.put(key,mat,geo,x,y,z,scale[0],scale[1],scale[2],ry,rx);}
    const columns=[-3.8,-2.65,-1.5,1.5,2.65,3.8],rows=6,ry=sx>0?-Math.PI/2:Math.PI/2;
    function local(x,z,dx,dz){return {x:x+Math.cos(ry)*dx+Math.sin(ry)*dz,z:z-Math.sin(ry)*dx+Math.cos(ry)*dz};}
    for(let row=0;row<rows;row++)for(let col=0;col<columns.length;col++){
      const x=sx*(core-3.1-row*1.32),z=zmid+columns[col]*Math.min(1,(roomD-2.0)/9.1);
      put('tabletop',materials.desk,topGeometry,x,.79,z,[1,1,1],ry);
      put('shelf',materials.dark,unitBox,x,.61,z,[.57,.035,.37],ry);
      for(const dx of [-.26,.26])for(const dz of [-.16,.16]){const p=local(x,z,dx,dz);put('steel',materials.steel,unitCylinder,p.x,.43,p.z,[.015,.7,.015]);}
      const chair=local(x,z,0,.52);put('chair',materials.chair,unitBox,chair.x,.46,chair.z,[.38,.035,.37],ry);
      const back=local(x,z,0,.70);put('chairback',materials.chair,unitBox,back.x,.77,back.z,[.38,.29,.035],ry);
      for(const dx of [-.15,.15])for(const dz of [.38,.66]){const p=local(x,z,dx,dz);put('steel',materials.steel,unitCylinder,p.x,.25,p.z,[.013,.42,.013]);}
      for(const dx of [-.16,.16]){const p=local(x,z,dx,.7);put('steel',materials.steel,unitCylinder,p.x,.66,p.z,[.012,.52,.012]);}
      if((row+col)%3===0){const p=local(x,z,.04,-.02);put('book',materials.book,unitBox,p.x,.821,p.z,[.21,.018,.28],ry+.1);put('paper',materials.paper,unitBox,p.x,.834,p.z,[.19,.008,.265],ry+.1);}
      put('contact',materials.contact,unitPlane,x-sx*.2,.138,z,[1.5,1.15,1],0,-Math.PI/2);
      // Furniture footprint, not a whole-room blocker. Main aisle stays clear.
      obstacles.push({minX:x-(sx>0?.81:.25),maxX:x+(sx>0?.25:.81),minZ:z-.36,maxZ:z+.36,id:name+':desk'});
    }
    const tx=sx*(core-1.25);
    put('teacher',materials.desk,unitBox,tx,.81,zmid,[.62,.08,1.65]);
    put('teacherbody',materials.door,unitBox,tx,.44,zmid,[.55,.7,1.48]);
    obstacles.push({minX:tx-.34,maxX:tx+.34,minZ:zmid-.85,maxZ:zmid+.85,id:name+':teacher'});
    for(const zoff of [-2.5,2.5]){
      // Long fluorescent fixture and a three-blade ceiling fan.
      put('light',materials.emissive,unitBox,sx*(core-6.1),fh-.34,zmid+zoff,[1.18,.055,.16]);
      const fan=new T.Group();fan.position.set(sx*(core-7.1),fh-.69,zmid+zoff);fan.userData.noMerge=true;detail.add(fan);
      const motor=new T.Mesh(new T.SphereGeometry(.16,12,8),materials.fan);motor.scale.y=.6;fan.add(motor);
      for(let blade=0;blade<3;blade++){const pivot=new T.Group();pivot.rotation.y=blade*Math.PI*2/3;fan.add(pivot);const plate=meshBox(pivot,materials.fan,.2,.025,.8,0,0,.39);plate.rotation.z=.1;}
      const rod=meshBox(detail,materials.frame,.045,.35,.045,fan.position.x,fh-.49,fan.position.z);
      fanRecords.push(fan);
    }
    batches.flush();
    const room={id:name,buildingId:b.id,name:b.name+' · '+(101+roomIndex)+'教室',group:detail,center:{x:o.x+(xmin+xmax)/2,z:o.z+zmid},minX:o.x+xmin,maxX:o.x+xmax,minZ:o.z+zmid-roomD/2,maxZ:o.z+zmid+roomD/2,door:{x:o.x+doorX,z:o.z+doorZ},arrival:{x:o.x+doorX,z:o.z},obstacles:obstacles.map(c=>({...c,minX:c.minX+o.x,maxX:c.maxX+o.x,minZ:c.minZ+o.z,maxZ:c.maxZ+o.z})),deskCount:rows*columns.length};
    roomRecords.push(room);return room;
  }
  function build(parent,b,o){
    const w=b.size[0],d=b.size[2],fh=b.floorH,core=Math.min(14.6,w/2-2.2),roomW=core-1.8,roomD=d/2-1.5;
    // Close the unmodelled wings; only the central ground floor is opened.
    const wingW=w/2-core;for(const sx of [-1,1]){
      meshBox(parent,materials.plasterOutside,wingW,fh,d,sx*(core+wingW/2),fh/2,0);
      meshBox(parent,materials.dado,.2,fh,d,sx*core,fh/2,0);
    }
    // Two genuine external entrances, each with a wide central opening.
    for(const sz of [-1,1]){
      const z=sz*d/2;
      for(const sx of [-1,1]){
        const cx=sx*(core+1.8)/2;
        meshBox(parent,materials.wall,roomW,.92,.23,cx,.59,z);
        meshBox(parent,materials.wall,roomW,fh-2.9,.23,cx,(fh+2.9)/2,z);
        const n=Math.max(3,Math.floor(roomW/2));
        for(let j=0;j<=n;j++){const x=sx<0?-core+j*roomW/n:1.8+j*roomW/n;meshBox(parent,materials.frame,.065,1.84,.18,x,1.98,z);}
        meshBox(parent,materials.frame,roomW,.055,.18,cx,1.15,z);meshBox(parent,materials.frame,roomW,.055,.18,cx,2.87,z);
        meshBox(parent,materials.glass,roomW-.1,1.68,.025,cx,1.99,z);
      }
      meshBox(parent,materials.wall,3.6,fh-2.75,.23,0,(fh+2.75)/2,z);
      label(parent,b.name,'首层开放 · 可步入教室',3.0,.4,0,3.1,z+sz*.16,sz>0?0:Math.PI);
      // A shallow timber entrance frame, with no ground-level sill.
      for(const sx of [-1,1])meshBox(parent,materials.frame,.09,2.75,.18,sx*1.75,1.5,z);
    }
    meshBox(parent,materials.floor,core*2,.08,3,0,.085,0);meshBox(parent,materials.floor,3.6,.08,d,0,.086,0);
    meshBox(parent,materials.ceiling,core*2,.1,d,0,fh-.15,0);
    const rooms=[];for(const [i,pair] of [[-1,-1],[1,-1],[-1,1],[1,1]].entries())rooms.push(classroom(parent,b,o,pair[0],pair[1],core,i,roomW,roomD));
    const light=new T.PointLight('#fff3da',.34,24,2);light.position.set(0,2.8,0);light.userData.indoorLight=true;parent.add(light);
    return rooms;
  }
  function currentRoom(x,z){return roomRecords.find(r=>x>r.minX&&x<r.maxX&&z>r.minZ&&z<r.maxZ)||null;}
  function tick(x,z,dt,reduced){
    for(const room of roomRecords)room.group.visible=Math.hypot(x-room.center.x,z-room.center.z)<90;
    if(!reduced)for(const fan of fanRecords)if(fan.parent.visible)fan.rotation.y+=dt*2.0;
  }
  global.CampusInteriors={loadMaterials,init,build,currentRoom,tick,get rooms(){return roomRecords;},get materials(){return materials;}};
})(window);
