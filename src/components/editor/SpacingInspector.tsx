import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { EmailBlock } from "../../services/emailBlocks";
import { edges, readEdge, setSpacing, type Edge, type Spacing } from "../../editor/boxModel";
import { LengthInput } from "./StyleInputs";

type ReferenceAction = "left"|"center"|"right"|"width"|"height";
export default function SpacingInspector({block,onChange}:{block:EmailBlock;onChange:(styles:Record<string,string>)=>void}) {
  const root=useRef<HTMLDivElement>(null);
  const [separate,setSeparate]=useState(false);
  const [active,setActive]=useState<{kind:Spacing;side:Edge}>({kind:"padding",side:"Top"});
  const [reference,setReference]=useState("");
  const [objects,setObjects]=useState<{id:string;label:string}[]>([]);
  const [message,setMessage]=useState("");
  const styles=block.styles || {};
  const node=()=>root.current?.closest('[role="region"]')?.querySelector<HTMLElement>(`[data-ee-block-id="${CSS.escape(block.id)}"]`);
  useEffect(()=>{setReference("");setMessage("");},[block.id]);
  useLayoutEffect(()=>{
    const selected=node(),parent=selected?.parentElement;
    const refresh=()=>setObjects(Array.from(parent?.children || []).filter(element=>element!==selected && element.hasAttribute("data-ee-block-id")).map(element=>({id:element.getAttribute("data-ee-block-id")!,label:element.textContent?.trim().slice(0,55)||element.getAttribute("data-ee-block-kind")||"Objeto"})));
    refresh();
    const observer=typeof MutationObserver === "undefined"?null:new MutationObserver(refresh);
    if(parent)observer?.observe(parent,{childList:true});
    return ()=>observer?.disconnect();
  },[block.id]);
  const applyReference=(action:ReferenceAction)=>{
    const selected=node(),parent=selected?.parentElement;
    const target=Array.from(parent?.children || []).find(element=>element.getAttribute("data-ee-block-id")===reference) as HTMLElement|undefined;
    if(!selected || !parent || !target)return;
    const box=selected.getBoundingClientRect(),other=target.getBoundingClientRect();
    const scale=box.width/selected.offsetWidth || 1;
    if(action === "width" || action === "height")onChange({...styles,[action]:`${Math.round(other[action]/scale)}px`,boxSizing:"border-box"});
    else {
      const padding=parseFloat(getComputedStyle(parent).paddingLeft)||0;
      const edge=action === "left"?other.left:action === "right"?other.right-box.width:(other.left+other.right-box.width)/2;
      const left=Math.max(0,(edge-parent.getBoundingClientRect().left)/scale-parent.clientLeft-padding);
      onChange({...styles,display:styles.display || "block",marginLeft:`${Math.round(left)}px`,marginRight:"0"});
    }
    setMessage("Medida aplicada en píxeles. Puedes deshacer el cambio.");
  };
  const choose=(kind:Spacing,side:Edge)=>{setActive({kind,side});if(kind === "padding")setSeparate(true);};
  return <div ref={root} className="ee-spacing-inspector">
    <fieldset><legend>Espaciado y caja</legend>
      <div className="ee-box-map" aria-label="Diagrama de márgenes y padding">
        {edges.map(([side,label])=><button key={`margin-${side}`} type="button" className={`ee-box-edge margin edge-${side.toLowerCase()}`} aria-label={`Editar margen ${label.toLowerCase()}`} aria-pressed={active.kind === "margin" && active.side === side} onClick={()=>choose("margin",side)}>{readEdge(styles,"margin",side)||"0"}</button>)}
        <div className="ee-box-padding">
          {edges.map(([side,label])=><button key={side} type="button" className={`ee-box-edge padding edge-${side.toLowerCase()}`} aria-label={`Editar padding ${label.toLowerCase()}`} aria-pressed={active.kind === "padding" && active.side === side} onClick={()=>choose("padding",side)}>{readEdge(styles,"padding",side)||"0"}</button>)}
          <span className="ee-box-content">Contenido</span>
        </div>
      </div>
      <div className="ee-box-legend"><span>Margen exterior</span><span>Padding interior</span></div>
      <label className="ee-spacing-toggle"><input type="checkbox" checked={separate} onChange={event=>setSeparate(event.target.checked)}/>Editar cada lado</label>
      {active.kind === "margin" && <LengthInput key={`margin-${active.side}`} label={`Margen ${edges.find(([side])=>side===active.side)![1]}`} value={readEdge(styles,"margin",active.side)} placeholder="0px" onChange={value=>onChange({...styles,[`margin${active.side}`]:value})}/>}
      {separate?<div className="ee-row2">{edges.map(([side,label])=><LengthInput key={side} label={`Padding ${label}`} value={readEdge(styles,"padding",side)} placeholder="0px" onChange={value=>onChange({...styles,[`padding${side}`]:value})}/>)}</div>:<LengthInput label="Espaciado interior" value={styles.padding || ""} placeholder="0px" onChange={value=>onChange(setSpacing(styles,"padding",value))}/>}
    </fieldset>
    <details><summary>Márgenes por lado</summary><div className="ee-row2">{edges.map(([side,label])=><LengthInput key={side} label={`Margen ${label}`} value={readEdge(styles,"margin",side)} placeholder="0px" onChange={value=>onChange({...styles,[`margin${side}`]:value})}/>)}</div></details>
    {objects.length>0 && <details className="ee-reference-panel"><summary>Alinear con otro objeto</summary>
      <select className="ee-select" aria-label="Objeto de referencia" value={reference} onChange={event=>setReference(event.target.value)}><option value="">Objeto del mismo contenedor</option>{objects.map(object=><option key={object.id} value={object.id}>{object.label}</option>)}</select>
      <div className="ee-reference-actions">{([["left","Mismo borde izquierdo"],["center","Mismo centro horizontal"],["right","Mismo borde derecho"],["width","Igualar ancho"],["height","Igualar altura"]] as const).map(([action,label])=><button className="ee-btn" type="button" key={action} disabled={!reference} onClick={()=>applyReference(action)}>{label}</button>)}</div>
      {message && <small role="status">{message}</small>}
    </details>}
  </div>;
}
