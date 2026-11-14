import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { describeLength, resizedLength, snapSize } from "./canvasMeasurements";
import { positionAlignStyles, type EmailBlock } from "../../services/emailBlocks";

type Props = {
  block: EmailBlock;
  rect: { x: number; y: number; w: number; h: number };
  layerRef: React.RefObject<HTMLElement>;
  zoom: number;
  onPatch: (patch: Partial<EmailBlock>) => void;
  onPreview: () => void;
  onBeginDrag: (id: string, x: number, y: number) => void;
  onContextMenu: (id: string, x: number, y: number) => void;
};
/** Transient DOM preview; a completed gesture produces one undoable document edit. */
export default function TransformControls({ block, rect, layerRef, zoom, onPatch, onPreview, onBeginDrag, onContextMenu }: Props) {
  const [liveStyles,setLiveStyles] = useState<Record<string,string> | null>(null);
  const [snapped,setSnapped] = useState(false);
  const [snapReference,setSnapReference] = useState<{label:string;rect?:{x:number;y:number;w:number;h:number}} | null>(null);
  const movedRef = useRef(false);
  const cancelRef = useRef<(() => void) | null>(null);
  const [guide, setGuide] = useState<{x:number;y:number;height:number;label:string} | null>(null);

  useEffect(() => () => cancelRef.current?.(), []);
  const node = () => layerRef.current?.querySelector<HTMLElement>(`[data-ee-block-id="${CSS.escape(block.id)}"]`);
  const length = (pixels:number, axis:"width"|"height") => {
    const target=node(), parent=target?.parentElement;
    const css=target?getComputedStyle(target):null;
    const parentCss=parent?getComputedStyle(parent):null;
    const reference=axis==="width" ? (parent?.clientWidth||rect.w)-parseFloat(parentCss?.paddingLeft||"0")-parseFloat(parentCss?.paddingRight||"0") : parent?.clientHeight||rect.h;
    return resizedLength(pixels,block.styles?.[axis],reference,parseFloat(css?.fontSize||"16"),parseFloat(getComputedStyle(document.documentElement).fontSize),{width:window.innerWidth,height:window.innerHeight});
  };
  const sizePatch = (width: number): Partial<EmailBlock> => {
    const value=length(width,"width");
    return block.type === "image"
      ? {width:String(width),styles:{...block.styles,width:value,maxWidth:block.styles?.maxWidth||"100%",height:"auto",boxSizing:"border-box"}}
      : {styles:{...block.styles,width:value,maxWidth:block.styles?.maxWidth||"100%",boxSizing:"border-box"}};
  };
  const heightPatch = (height: number): Partial<EmailBlock> => ({styles:{...block.styles,height:length(height,"height"),boxSizing:"border-box",...(block.type === "image"?{objectFit:block.styles?.objectFit||"contain"}:{})}});
  const start = (event: React.PointerEvent, action: "resize" | "align", handle = "e") => {
    if (event.button !== 0) return;
    movedRef.current=false;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const captureTarget = event.currentTarget;
    const pointerId = event.pointerId;
    const target = node(); if (!target?.parentElement) return;
    cancelRef.current?.();
    const original = target.getAttribute("style");
    const parent = target.parentElement;
    const parentStyle = getComputedStyle(parent);
    const available = parent.clientWidth - parseFloat(parentStyle.paddingLeft || "0") - parseFloat(parentStyle.paddingRight || "0");
    const initialWidth = target.getBoundingClientRect().width / zoom;
    const initialBox = target.getBoundingClientRect();
    const aspect = initialBox.width / Math.max(1, initialBox.height);
    const siblings=Array.from(parent.children).filter(el=>el!==target && el.hasAttribute("data-ee-block-id")).map(el=>({node:el,box:el.getBoundingClientRect()}));
    const snap=(value:number,axis:"width"|"height",disabled:boolean)=>{
      const candidates=axis==="width"?[{value:available,label:"Ancho del contenedor"},{value:available/2,label:"50 % del contenedor"}]:[];
      for(const sibling of siblings)candidates.push({value:sibling.box[axis]/zoom,label:`Misma medida que ${sibling.node.textContent?.trim().slice(0,45)||sibling.node.getAttribute("data-ee-block-kind")}`});
      const result=snapSize(value,candidates.map(item=>item.value),disabled?0:6/zoom);
      setSnapped(result.snapped);
      const match=result.snapped?candidates.find(item=>item.value===result.value):undefined;
      const sibling=siblings.find(item=>item.box[axis]/zoom===result.value);
      const layerBox=layerRef.current!.getBoundingClientRect();
      setSnapReference(match?{label:match.label,rect:sibling?{x:(sibling.box.left-layerBox.left)/zoom,y:(sibling.box.top-layerBox.top)/zoom,w:sibling.box.width/zoom,h:sibling.box.height/zoom}:undefined}:null);
      return result.value;
    };
    const startX = event.clientX;
    const startY = event.clientY;
    let patch: Partial<EmailBlock> | undefined;
    let horizontal = false;
    const restore = () => original === null ? target.removeAttribute("style") : target.setAttribute("style", original);
    const finish = (save: boolean) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("blur", cancel);
      cancelRef.current = null;
      restore(); setGuide(null); setLiveStyles(null);setSnapped(false);setSnapReference(null);
      if(save && patch) onPatch(patch);
      onPreview();
    };
    const move = (pointer: PointerEvent) => {
      if(Math.hypot(pointer.clientX-startX,pointer.clientY-startY)<3 && !patch)return;
      movedRef.current=true;
      if(action === "align" && !horizontal) {
        const dx=Math.abs(pointer.clientX-startX),dy=Math.abs(pointer.clientY-startY);
        if(Math.max(dx,dy)<6)return;
        if(dy>dx) {
          finish(false);
          if(captureTarget.hasPointerCapture(pointerId))captureTarget.releasePointerCapture(pointerId);
          onBeginDrag(block.id,pointer.clientX,pointer.clientY);
          return;
        }
        horizontal=true;
      }
      if(action === "resize") {
        const dx=(pointer.clientX-startX)/zoom*(handle.includes("w")?-1:1);
        const dy=(pointer.clientY-startY)/zoom*(handle.includes("n")?-1:1);
        if(handle === "n" || handle === "s") {
          const height=Math.round(Math.max(16,snap(initialBox.height/zoom+dy,"height",pointer.altKey)));
          patch=heightPatch(height);
          Object.assign(target.style,{height:patch.styles?.height,boxSizing:"border-box",...(block.type === "image"?{objectFit:block.styles?.objectFit||"contain"}:{})});
        } else {
          const delta=handle.length===2 && block.type === "image" && Math.abs(dy*aspect)>Math.abs(dx)?dy*aspect:dx;
          const width=Math.round(Math.max(16,Math.min(available,snap(initialWidth+delta,"width",pointer.altKey))));
          patch=sizePatch(width);
          if(handle.length===2 && block.type !== "image")patch.styles={...patch.styles,height:length(Math.round(Math.max(16,snap(initialBox.height/zoom+dy,"height",pointer.altKey))),"height")};
          if(handle.length===1 && block.type === "image")patch.styles={...patch.styles,height:block.styles?.height||"auto",objectFit:block.styles?.objectFit||"contain"};
          Object.assign(target.style,patch.styles);
        }

      } else {
        const box=parent.getBoundingClientRect();
        const left=box.left + (parent.clientLeft+parseFloat(parentStyle.paddingLeft||"0"))*zoom;
        const right=left+available*zoom;
        const center=(left+right)/2;
        // Follow the object's centre, retaining the point where the drag began.
        const proposedCenter=(initialBox.left+initialBox.right)/2 + pointer.clientX-startX;
        const half=initialBox.width/2;
        const anchors=[{position:"left",center:left+half,line:left,label:"Izquierda"},
          {position:"center",center,line:center,label:"Centro"},
          {position:"right",center:right-half,line:right,label:"Derecha"}];
        const anchor=anchors.reduce((best,item)=>Math.abs(item.center-proposedCenter)<Math.abs(best.center-proposedCenter)?item:best);
        patch={styles:{...block.styles,...positionAlignStyles(anchor.position as "left"|"center"|"right",block.type,block.styles?.display)}};
        Object.assign(target.style,patch.styles);
        const layerBox=layerRef.current!.getBoundingClientRect();
        setGuide({x:(anchor.line-layerBox.left)/zoom,y:(box.top-layerBox.top)/zoom,height:box.height/zoom,label:anchor.label});

      }
      setLiveStyles(patch?.styles ?? null);
      onPreview();
    };
    const up = () => finish(true);
    const cancel = () => finish(false);
    const key = (event: KeyboardEvent) => {if(event.key==="Escape"){event.preventDefault();event.stopPropagation();cancel();}};
    cancelRef.current=cancel;
    window.addEventListener("pointermove",move);
    window.addEventListener("pointerup",up);
    window.addEventListener("pointercancel",cancel);
    window.addEventListener("keydown",key,true);
    window.addEventListener("blur",cancel);
  };
  const displayStyles=liveStyles||block.styles||{};
  const widthValue=displayStyles.width || (block.type === "image" && block.width ? `${block.width}px` : undefined);
  const measuredNode=node();
  const computed=measuredNode ? getComputedStyle(measuredNode) : null;
  const margins={top:parseFloat(computed?.marginTop||"0")||0,right:parseFloat(computed?.marginRight||"0")||0,bottom:parseFloat(computed?.marginBottom||"0")||0,left:parseFloat(computed?.marginLeft||"0")||0};
  const measurementSlot=measuredNode?.closest(".ee-workspace")?.querySelector(".ee-workspace-tip");
  const measurements=(<div className="ee-transform-measurements" role="status" >
      <span>Ancho: {describeLength(widthValue)} · Alto: {describeLength(displayStyles.height)}</span>
      <span>Margen: {displayStyles.marginTop||displayStyles.margin||"0"} / {displayStyles.marginRight||displayStyles.margin||"0"} / {displayStyles.marginBottom||displayStyles.margin||"0"} / {displayStyles.marginLeft||displayStyles.margin||"0"} · Interior: {describeLength(displayStyles.padding||"0px")}</span>
      {snapped && <strong>{snapReference?.label} · Alt para ignorar</strong>}
    </div>);
  return <div className="ee-transform-controls" style={{left:rect.x,top:rect.y,width:rect.w,height:rect.h}} onClick={event=>event.stopPropagation()}>
    {margins.top>0 && <div className="ee-transform-margin" style={{left:0,top:-margins.top,width:"100%",height:margins.top}}/>}
    {margins.bottom>0 && <div className="ee-transform-margin" style={{left:0,top:"100%",width:"100%",height:margins.bottom}}/>}
    {margins.left>0 && <div className="ee-transform-margin" style={{left:-margins.left,top:0,width:margins.left,height:"100%"}}/>}
    {margins.right>0 && <div className="ee-transform-margin" style={{left:"100%",top:0,width:margins.right,height:"100%"}}/>}
    {measurementSlot ? createPortal(measurements,measurementSlot) : null}
    {snapped && <div className="ee-transform-size-guide" />}
    {snapReference?.rect && <div className="ee-transform-size-guide" style={{left:snapReference.rect.x-rect.x,top:snapReference.rect.y-rect.y,width:snapReference.rect.w,height:snapReference.rect.h}} />}
    {guide && <div className="ee-transform-guide" data-alignment={guide.label} style={{left:guide.x-rect.x,top:guide.y-rect.y,height:guide.height}}><span>{guide.label}</span></div>}
    {<button type="button" className="ee-transform-drag-surface" aria-label={block.type === "image" ? "Mover imagen para alinear" : "Mover bloque para alinear"} title="Arrastra horizontalmente para alinear o verticalmente para cambiar de posición" onClick={event=>{
      event.stopPropagation();
      if(movedRef.current)return;
      const surface=event.currentTarget;
      surface.style.pointerEvents="none";
      const target=document.elementFromPoint(event.clientX,event.clientY);
      surface.style.pointerEvents="";
      if(target && target!==surface)target.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,clientX:event.clientX,clientY:event.clientY,shiftKey:event.shiftKey}));
    }} onDoubleClick={event=>{
      event.preventDefault();event.stopPropagation();
      const surface=event.currentTarget;
      surface.style.pointerEvents="none";
      const target=document.elementFromPoint(event.clientX,event.clientY);
      surface.style.pointerEvents="";
      if(target && target!==surface)target.dispatchEvent(new MouseEvent("dblclick",{bubbles:true,cancelable:true,clientX:event.clientX,clientY:event.clientY}));
    }} onPointerDown={event=>start(event,"align")} onContextMenu={event=>{event.preventDefault();event.stopPropagation();onContextMenu(block.id,event.clientX,event.clientY);}} onKeyDown={event=>{
      const position=event.key==="ArrowLeft"?"left":event.key==="ArrowRight"?"right":event.key==="Home"?"center":null;
      if(position){event.preventDefault();event.stopPropagation();onPatch({styles:{...block.styles,...positionAlignStyles(position,block.type,block.styles?.display)}});}
    }} />}
    {([['w','izquierda'],['e','derecha'],['n','arriba'],['s','abajo'],['nw','esquina superior izquierda'],['ne','esquina superior derecha'],['sw','esquina inferior izquierda'],['se','esquina inferior derecha']] as const).map(([handle,label])=><button key={handle} type="button" className={`ee-transform-resize handle-${handle}`} aria-label={`Redimensionar desde ${label}`} title="Lados: ancho o alto. Esquinas: ambos ejes. Flechas: 1 px; Mayús: 10 px. Escape cancela."
      onPointerDown={event=>start(event,"resize",handle)} onKeyDown={event=>{
        if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key))return;
        event.preventDefault();event.stopPropagation();
        const vertical=handle==="n"||handle==="s";
        const next=Math.max(16,Math.round((vertical?rect.h:rect.w)+(["ArrowRight","ArrowDown"].includes(event.key)?1:-1)*(event.shiftKey?10:1)));
        onPatch(vertical?heightPatch(next):sizePatch(next));
      }} />)}

  </div>;
}
