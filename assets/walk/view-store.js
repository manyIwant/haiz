/* Small, validated camera records. No image data or remote service. */
(function(root){'use strict';
const key='haiz.camera.views.v1',C=root.CampusJourneyCore;
function read(bounds){
  try{const values=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(values))return [];
    return values.slice(0,8).flatMap(item=>{const view=C.camera(item,bounds);return view&&typeof item.id==='string'?[{...view,id:item.id.slice(0,80),createdAt:typeof item.createdAt==='string'?item.createdAt.slice(0,32):''}]:[];});
  }catch{return [];}
}
function write(values){localStorage.setItem(key,JSON.stringify(values));}
function add(value){const view=C.camera(value);if(!view)throw Error('这个机位暂时无法保存。');
  const record={...view,id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),createdAt:new Date().toISOString()};
  write([record,...read()].slice(0,8));return record;
}
function remove(id){write(read().filter(v=>v.id!==id));}
function clear(){localStorage.removeItem(key);}
root.CampusViews={read,add,remove,clear};
})(window);
