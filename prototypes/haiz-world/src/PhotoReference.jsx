import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,ImageSquare,X} from '@phosphor-icons/react';
import {getPhotoReference} from './photoReferences.js';

export function PhotoReference({place,onClose,triggerRef}){
  const dialog=useRef(null),closeButton=useRef(null);
  const [failed,setFailed]=useState(false);
  const photo=getPhotoReference(place);
  useEffect(()=>{
    const previous=triggerRef.current||document.activeElement;
    closeButton.current.focus();
    return()=>{if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[triggerRef]);
  function keys(e){
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();}
    if(e.key==='Tab'){
      const items=[...dialog.current.querySelectorAll('button,a[href]')],first=items[0],last=items.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  }
  return <div className="modal-backdrop reference-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section ref={dialog} className="reference-dialog" role="dialog" aria-modal="true" aria-labelledby="reference-title" onKeyDown={keys} data-photo-status={photo.status}>
      <header className="reference-heading"><div><span>实景对照</span><h2 id="reference-title">{place.name}</h2></div><button ref={closeButton} className="icon-button" aria-label="关闭实景对照" onClick={onClose}><X size={22}/></button></header>
      <div className="reference-layout">
        <figure className="reference-figure">
          {photo.image&&!failed?<img src={photo.image} alt={photo.alt} decoding="async" onError={()=>setFailed(true)}/>:<div className="reference-empty" role="status"><ImageSquare size={32} weight="light"/><p>{failed?'照片暂时无法读取':'这处地点还没有可靠的对照照片'}</p>{failed&&<button className="reference-retry" onClick={()=>setFailed(false)}>重试加载</button>}</div>}
          <figcaption>{photo.image?'照片与实时模型分开展示，未做机位标定。':'保留原模型，不以其他地点的图片替代。'}</figcaption>
        </figure>
        <div className="reference-notes">
          <span className="reference-status">{photo.label}</span>
          {photo.features.length>0&&<div className="reference-observations"><h3>照片中可见</h3><ul>{photo.features.map(text=><li key={text}>{text}</li>)}</ul></div>}
          <p className="reference-limit">{photo.limit}</p>
          {photo.image&&<dl className="reference-metadata"><div><dt>拍摄时间</dt><dd>{photo.date||'待核实'}</dd></div><div><dt>摄影</dt><dd>{photo.author||'原署名见照片，尚待核实'}</dd></div><div><dt>许可</dt><dd>{photo.license||'未确认再分发授权'}</dd></div></dl>}
          {photo.rights&&<p className="reference-rights">{photo.rights}</p>}
          {photo.source&&<a className="reference-source" href={photo.source} target="_blank" rel="noreferrer">{photo.sourceName}<ArrowUpRight size={16}/></a>}
          {photo.links?.length>0&&<div className="reference-links"><h3>相关资料线索</h3><p>不是此照片的原始出处，页面配图尚待复核。</p>{photo.links.map(link=><a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.title}<ArrowUpRight size={16}/></a>)}</div>}
        </div>
      </div>
    </section>
  </div>;
}
