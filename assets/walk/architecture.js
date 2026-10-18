/* Photo-informed additions. Proportions are interpreted, never surveyed. */
(function(root){'use strict';
const records={
 yanlintang:{image:null,observation:'该地点尚缺与当前状态对应、身份已确认的外观照片。可先阅读报道中的历史影像。',limit:'现有模型只表达大致体量；未把历史照片当作今天的建筑。',source:'https://news.hndaily.cn/html/2012-04/23/content_15_1.htm',sourceName:'海南日报 · 2012 年衍林堂历史影像'},
 yihao:{image:'assets/images/campus/campus_yihao.jpg',observation:'正面照片可见浅色墙体、深灰中央构件、蓝灰窗面和较浅的红色门廊檐口。',limit:'立面模数与高度沿用原模型；室内平面没有测绘。',source:'https://www.360cities.net/zh/image/hkaxiong-hnzx-jxl1',sourceName:'一号楼公开全景 · 2013；模型另参照仓库正面照片'},
 erhao:{image:'assets/images/campus/campus_erhao.jpg',observation:'仓库庭院照片可见浅色水平楼板、连续外廊、细柱和金属窗栏；不应所有教学楼都套同一大坡顶。',limit:'照片含活动布置，本模型不复制横幅、人员或当时排期；楼层与占地未重新测量。',source:'https://hi.people.com.cn/n2/2019/1211/c231190-33622877.html',sourceName:'人民网校园报道 · 2019；外观另参照仓库庭院照片'},
 fengqitang:{image:'assets/images/web/fengqitang-1600.jpg',observation:'近景可辨绿瓦叠檐、暖红色柱体与金色细节、白墙、木门窗和深色台阶。',limit:'照片机位与年代未标定；柱距与檐口尺寸为近似表达。',source:'https://www.hainan.gov.cn/hainan/5309/202311/506488b9d6b84f5a8e1b965f26dcfeb2.shtml',sourceName:'海南省政府网百年校庆报道；外观参照仓库完整照片'},
 kexue:{image:'assets/images/campus/campus_kexue.jpg',observation:'照片中可见细密浅色墙面、长水平外廊、金属窗栏与遮阴形成的层次。',limit:'未依据单张照片推断楼内房间布局。',source:'https://hi.people.com.cn/n2/2019/1211/c231190-33622877.html',sourceName:'人民网校园报道；外观另参照仓库照片'}
};
function box(g,m,w,h,d,x,y,z){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o;}
function facade(g,b,m){
 const w=b.size[0],h=b.size[1],d=b.size[2],fh=b.floorH;
 if(b.id==='yihao'){
  const face=d/2;
  // Photograph's entrance composition: narrow full-height piers, two stone towers,
  // deep window reveals and a stepped, projecting central white cornice.
  for(const x of [-w*.16,-w*.085,w*.085,w*.16]){
    box(g,m.wallGrey,.34,h-1.2,.42,x,(h+1.2)/2,face+.14);
    box(g,m.wallPutty,.56,.18,.62,x,h-.3,face+.22);
  }
  for(const x of [-w*.105,w*.105]){
    const height=h*.56;
    box(g,m.baseStone,2.8,height,.18,x,height/2,face+.23);
    for(const sign of [-1,1])box(g,m.baseStone,.42,height,.34,x+sign*1.19,height/2,face+.42);
    for(let floor=0;floor<3;floor++){
      const cy=1.9+floor*3.15,wh=1.3;
      box(g,m.glassTeal,1.4,wh,.045,x,cy,face+.35);
      for(const side of [-1,1]){box(g,m.frame,.065,wh,.10,x+side*.7,cy,face+.43);box(g,m.baseStone,1.9,.16,.35,x,cy+side*(wh/2+.10),face+.45);}
      box(g,m.frame,.045,wh,.09,x,cy,face+.43);
    }
    box(g,m.baseStone,3.6,.25,1.35,x,height+.1,face+.25);
    box(g,m.wallPutty,3.8,.13,1.5,x,height+.29,face+.24);
    box(g,m.wallLight,.28,h-height-1.0,.48,x,height+(h-height-1.0)/2+.5,face+.25);
  }
  const crown=w*.27;
  for(let level=0;level<3;level++)box(g,m.wallLight,crown+level*.8,.18,1.65+level*.28,0,h+.2+level*.23,face+.22);
  for(const sign of [-1,1]){
    box(g,m.wallLight,.65,1.1,1.9,sign*(crown/2-.4),h+.62,face+.18);
    for(let i=0;i<3;i++)box(g,m.wallLight,2.1-i*.35,.20,1.5,sign*(crown/2+1.0),h-.3+i*.24,face+.1);
  }
  for(let i=-5;i<=5;i++)box(g,m.wallPutty,.25,.36,.70,i*crown/12,h-.12,face+.53);
  // Thin outer roof edge and recessed shadow slot, not a blank white slab.
  box(g,m.wallGrey,crown,.09,.35,0,h+.05,face+.82);
  g.userData.photographicEntrance='stepped-cornice-stone-piers';
 }
 if(['yihao','erhao'].includes(b.id)){
  // Slender shade rails along the existing external gallery. No new floorplan.
  const n=Math.max(5,Math.round(w/4));
  for(let floor=1;floor<b.floors;floor++)for(let i=0;i<=n;i++)box(g,m.frame,.035,.62,.035,-w/2+i*w/n,floor*fh+.53,-d/2-1.94);
 }
 g.userData.architectureEvidence=records[b.id]?'photo-informed':'representative';
}
function heritage(g,w,d,m){
 const red=m.column.clone();red.color.set('#8f3d2b');
 const gold=m.goldLine.clone();gold.color.set('#b79550');
 const columns=[];g.traverse(o=>{if(o.isMesh&&o.geometry.type==='CylinderGeometry')columns.push(o);});
 for(const o of columns){o.material=red;const p=o.position;
  for(const y of [1.1,4.7]){const ring=new THREE.Mesh(new THREE.CylinderGeometry(.455,.455,.08,12),gold);ring.position.set(p.x,y,p.z);g.add(ring);}
  for(const xoff of [-.18,.18])box(g,gold,.028,3.3,.035,p.x+xoff,2.9,p.z+.43);
 }
 // Timber window crossbars, visible in the close photograph.
 const n=Math.max(4,Math.round(w/3.6));
 for(let i=1;i<n;i++){const x=-w/2+i*w/n;if(Math.abs(x)<2.2)continue;
  for(const y of [1.7,2.5,3.3])box(g,m.beam,1.5,.055,.08,x,y,d/2+.17);
 }
}
root.CampusArchitecture={records,facade,heritage};
})(window);
