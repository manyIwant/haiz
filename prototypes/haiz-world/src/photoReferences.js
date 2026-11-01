const CAMPUS='/haiz/assets/images/campus/';
const PENDING_RIGHTS='交接包已有实拍；摄影者、拍摄时间与再分发授权尚待核实。';
export const REVIEWED_PHOTOS={
  beimen:{image:'/haiz/assets/images/verified/gate-2013/display.jpg',status:'verified-historical',label:'历史实拍 · 来源已核实',date:'2013-09-22',author:'Anna Frodesiak',license:'CC0 1.0',source:'https://commons.wikimedia.org/wiki/File:Hainan_Middle_School_-_main_entrance_-_01.JPG',sourceName:'Wikimedia Commons 原图与许可',alt:'海南中学主入口的历史照片，绿瓦牌楼、石狮及后方教学楼',features:['绿瓦、浅色柱身与金黄色装饰线。','门洞后可见教学楼入口与太湖石，外观与项目北门参考照片吻合。'],limit:'原页面称海南中学正门；照片不能独立确定绝对方位，也不代表当前校门状态。',rights:'本轮已核实原图作者、拍摄日期与 CC0 1.0 许可。'},
  yihao:{image:CAMPUS+'campus_yihao.jpg',alt:'一号教学楼正面，浅色外墙、深灰入口构件与浅红瓦檐',features:['浅灰白墙面、蓝灰窗面及中央深灰竖向构件。','入口是较浅的红瓦门廊，不是整栋建筑的大坡顶。'],links:[{title:'一号教学楼全景线索 · 2013',url:'https://www.360cities.net/zh/image/hkaxiong-hnzx-jxl1'}]},
  erhao:{image:CAMPUS+'campus_erhao.jpg',alt:'项目二号教学楼庭院实拍，连续楼板与开放走廊',features:['连续水平楼板、浅色细柱与开放走廊。','照片含一次校园活动，不据此复制横幅、人员或推断当前布置。']},
  library:{image:CAMPUS+'campus_library.jpg',alt:'图书馆实拍，圆顶、蓝色弧形窗面、水平外廊与室外台阶',features:['顶部圆顶与蓝色弧形窗面是可辨识的轮廓。','浅色水平外廊、栏杆及外部台阶；前景树木遮挡部分立面。']},
  fengqitang:{image:'/haiz/assets/images/web/fengqitang-1600.jpg',alt:'凤栖堂绿瓦叠檐、红金柱、木格窗与堂前雕像实拍',features:['绿瓦叠檐、暖红柱体与细金线。','白墙、深木色门窗及较暗的台阶；保留原照片完整署名。'],links:[{title:'海南日报凤栖堂照片线索 · 2023',url:'https://news.hndaily.cn/html/2023-10/30/content_58478_16668439.htm'}]},
  yanchi:{image:CAMPUS+'campus_yanchi.jpg',alt:'砚池石题字、池岸叠石与周围教学楼实拍',features:['石面“砚池”题字、池岸叠石与热带植物。','小尺度校园水景，不是大面积前景湖。'],links:[{title:'海南中学砚池公开全景线索',url:'https://www.360cities.net/ru/image/hkaxiong-hnzx-yc?pano_detail=true&portfolio_view=false'}]},
  kexue:{image:CAMPUS+'campus_kexue.jpg',alt:'项目科学馆照片，浅色墙面与长水平外廊',features:['浅色小尺度墙砖、长水平外廊与金属窗栏。','不从这张照片推断室内平面，也不将其复制为化学实验楼照片。']},
  yundong:{image:CAMPUS+'campus_playground.jpg',alt:'项目运动场入口照片，可见入口立柱与周边树木',features:['该照片只覆盖运动场入口及周边植被。','未覆盖完整跑道，不用于推断操场尺寸、看台或当前设施。']},
};
export const WITHHELD_PHOTOS={
  yanlintang:'原“衍林堂”图片实际为亭子，已排除；目前不展示未经确认的主体照片。',
  fengqitang_ting:'原映射使用陶然亭照片，不能确认是凤栖亭，暂不展示。',
  yanlintang_ting:'原映射使用陶然亭照片，不能确认是衍林亭，暂不展示。',
  chem:'原映射与科学馆共用一张照片，不能证明是化学实验楼，暂不展示。',
};
export function getPhotoReference(place){
  const id=place.id;
  if(Object.hasOwn(WITHHELD_PHOTOS,id))return {status:'withheld',label:'照片对应待核实',image:null,features:[],limit:WITHHELD_PHOTOS[id]};
  if(Object.hasOwn(REVIEWED_PHOTOS,id)){
    const photo=REVIEWED_PHOTOS[id];
    return {status:'bundled-reviewed',label:'项目实拍 · 来源待核',date:null,author:null,license:null,rights:PENDING_RIGHTS,limit:'已逐图查看可见特征，但尚未独立确认拍摄时间和原始出处；不代表当前现场或测绘精度。',links:[],...photo};
  }
  const candidate=typeof place.image==='string'&&/^assets\/images\/(campus|web)\/[\w.-]+\.(jpg|png|webp)$/.test(place.image)&&!/(meilun|yanlintang)/i.test(place.image);
  return {status:candidate?'candidate':'missing',label:candidate?'照片对应待核实':'尚缺可靠照片',image:null,features:[],limit:candidate?'项目有候选照片，但尚未逐图确认校区与建筑对应，本轮不作为实景展示或建模依据。':'尚无可以确认对应此地点的外观照片，不使用其他建筑或生成图补位。'};
}
