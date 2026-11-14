import { useEffect, useMemo, useRef, useState } from "react";
import { previewDocument, PREVIEW_SANDBOX } from "../../services/previewDocument";
import type { EmailBlock } from "../../services/emailBlocks";
import { describeLength } from "./canvasMeasurements";

type Issue = {id:string;label:string;width:number;available:number};
type Props = {
  style?: React.CSSProperties; html:string; warnings:string[];
  viewport:"desktop"|"mobile"; onViewportChange:(viewport:"desktop"|"mobile")=>void;
  selected?:EmailBlock; onSelectBlock?:(id:string)=>void;
};

export default function LivePreview({style,html,warnings,viewport,onViewportChange,selected,onSelectBlock}:Props) {
  const documentHtml=useMemo(()=>previewDocument(html),[html]);
  const selectRef=useRef(onSelectBlock);
  selectRef.current=onSelectBlock;
  const frame=useRef<HTMLIFrameElement>(null);
  const [issues,setIssues]=useState<Issue[]>([]);
  const [size,setSize]=useState<{width:number;height:number}|null>(null);
  const [loaded,setLoaded]=useState(0);
  useEffect(()=>{
    const doc=frame.current?.contentDocument;
    if(!doc?.body)return;
    const measure=()=>{
      const available=doc.documentElement.clientWidth;
      const nodes=Array.from(doc.querySelectorAll<HTMLElement>('[data-ee-block-id]'));
      const overflowing=nodes.filter(node=>{
        const box=node.getBoundingClientRect();
        return box.right>available+1 || box.left < -1;
      });
      const nextIssues=overflowing.filter(node=>!overflowing.some(child=>child!==node && node.contains(child))).map(node=>({
        id:node.dataset.eeBlockId!,label:node.textContent?.trim().slice(0,55)||node.getAttribute('alt')||node.dataset.eeBlockKind||"Bloque",
        width:Math.round(node.getBoundingClientRect().width),available,
      }));
      setIssues(previous=>JSON.stringify(previous)===JSON.stringify(nextIssues)?previous:nextIssues);
      let selectedNode:HTMLElement|undefined;
      for(const node of nodes){
        node.style.outline=node.dataset.eeBlockId===selected?.id?'2px solid #7564ff':'';
        node.style.outlineOffset='2px';
        if(node.dataset.eeBlockId===selected?.id)selectedNode=node;
      }
      const box=selectedNode?.getBoundingClientRect();
      const nextSize=box?{width:Math.round(box.width),height:Math.round(box.height)}:null;
      setSize(previous=>JSON.stringify(previous)===JSON.stringify(nextSize)?previous:nextSize);
    };
    const click=(event:MouseEvent)=>{
      const node=(event.target as Element).closest<HTMLElement>('[data-ee-block-id]');
      if(node?.dataset.eeBlockId)selectRef.current?.(node.dataset.eeBlockId);
    };
    const observer=typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(doc.body);
    doc.defaultView?.addEventListener("resize",measure);
    doc.addEventListener('click',click);
    doc.addEventListener('load',measure,true);
    measure();
    return ()=>{observer?.disconnect();doc.defaultView?.removeEventListener("resize",measure);doc.removeEventListener('click',click);doc.removeEventListener('load',measure,true);};
  },[loaded,selected,viewport]);
  return <section className="ee-preview-pane" style={style} aria-label="Vista previa">
    <div className="ee-preview-toolbar"><span className="ee-eyebrow">VISTA PREVIA</span>
      <div className="ee-device-picker" role="group" aria-label="Tamaño de vista previa">
        <button className={viewport==='desktop'?'selected':''} aria-pressed={viewport==='desktop'} onClick={()=>onViewportChange('desktop')}>▰ 600px</button>
        <button className={viewport==='mobile'?'selected':''} aria-pressed={viewport==='mobile'} onClick={()=>onViewportChange('mobile')}>▯ 375px</button>
      </div>
    </div>
    {selected && size && <div className="ee-preview-measurements" role="status">Selección · {describeLength(selected.styles?.width||(selected.type==='image'&&selected.width?`${selected.width}px`:undefined))} → {size.width} × {size.height} px en {viewport==='mobile'?'móvil':'escritorio'}</div>}
    {issues.length>0 && <div className="ee-preview-warnings"><strong>Bloques que desbordan</strong>{issues.map(issue=><button className="ee-btn" type="button" key={issue.id} onClick={()=>onSelectBlock?.(issue.id)}>{issue.label} · {issue.width} px / vista de {issue.available} px</button>)}</div>}
    <div className="ee-preview-stage"><div className={`ee-device ee-device-${viewport}`}>
      <div className="ee-device-top"><i/><i/><i/><span>{viewport==='desktop'?'600 px':'375 px'}</span></div>
      {html?<iframe ref={frame} title="Correo renderizado localmente" sandbox={`allow-same-origin ${PREVIEW_SANDBOX}`} srcDoc={documentHtml} onLoad={()=>setLoaded(value=>value+1)}/>:<div className="ee-preview-placeholder">Todavía no hay contenido para mostrar.</div>}
    </div></div>
    {warnings.length>0 && <div className="ee-preview-warnings"><strong>Datos sin muestra</strong><span>{warnings.slice(0,4).join(' · ')}</span></div>}
  </section>;
}
