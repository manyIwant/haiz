/* A small shared place archive: consumed by the walk and the static reading page. */
(function(root){'use strict';
const archive={title:'树荫下的三次停留',notice:'模型内步行路线；不是实地导航。气候与光照为艺术模拟，非实时天气。',places:[
{id:'beimen',name:'北门',subtitle:'把城市留在身后',image:'assets/images/campus/campus_fucheng_gate.jpg',observation:'四柱三间，中央屋檐高、两侧低；浅色门柱、绿瓦与金色纹样。',memory:'海南日报记载，1988 年学校更名后，校门按原有风貌扩建，商承祚应邀题写校名。',source:'https://news.hndaily.cn/h5/html5/2023-10/30/content_58477_16668430.htm',sourceName:'海南日报 · 2023-10-30',confidence:'报道记载 / 照片观察',limit:'门柱进深、屋檐高度为照片比例推断，尚无立面测量。'},
{id:'lanshu',name:'百年榄仁树',subtitle:'在横枝下停一会儿',image:'assets/images/web/lanshu-1600.jpg',observation:'粗大的树干在低处分叉，横枝向两侧伸展，树冠覆盖楼前步道。',memory:'这条路线指向一号教学楼前的榄仁树，须与北门入口附近的另一株区分。海南日报的百年校庆报道以校园里的百年榄仁树开篇。',source:'https://news.hndaily.cn/h5/html5/2023-10/30/content_58477_16668430.htm',sourceName:'海南日报 · 2023-10-30；树位沿用项目资料',confidence:'报道记载 / 既有树位待现场核对',limit:'枝干姿态为参考照片的艺术重建，树龄没有独立年轮测定。'},
{id:'yanchi',name:'砚池',subtitle:'让楼影落进水里',image:'assets/images/campus/campus_yanchi.jpg',observation:'近岸叠石与热带植被围合水面，背景建筑有连续走廊；水景并非孤立的规则水盆。',memory:'保留现存水景的观察，不生成虚构的过去。可通过公开全景资料继续比较岸线、树木与建筑关系；其拍摄年代不能代表当前状态。',source:'https://www.360cities.net/zh/image/hkaxiong-hnzx-yc',sourceName:'360Cities · hkaxiong 的砚池全景入口',confidence:'照片观察 / 年代待核实',limit:'池岸细节为近似表达；沿用原始矩形空间边界，未完成测绘校准。'}],photoNotice:'照片沿用项目现有资产，版权归原作者；原项目标注来源为海南中学等公开资料，尚未独立确认转载授权。新增外部影像仅保留参考链接。'};
if(typeof module==='object'&&module.exports)module.exports=archive;else root.CampusMemory=archive;
})(typeof window==='undefined'?globalThis:window);
