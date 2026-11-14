import { useEffect, useRef, useState } from "react";
import type { EmailBlock } from "../../services/emailBlocks";
import { LengthInput } from "./StyleInputs";

export default function SpacingInspector({ block, onChange }: {
  block: EmailBlock;
  onChange: (styles: Record<string, string>) => void;
}) {
  const [separate, setSeparate] = useState(false);
  const [reference, setReference] = useState("");
  const [objects, setObjects] = useState<{id:string;label:string}[]>([]);
  const [message, setMessage] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const styles = block.styles || {};
  const canvasNode = () => root.current?.closest('[role="region"]')?.querySelector<HTMLElement>(`[data-ee-block-id="${CSS.escape(block.id)}"]`);
  useEffect(() => {
    const selected = canvasNode();
    setReference("");
    setMessage("");
    setObjects(Array.from(selected?.parentElement?.children || [])
      .filter(element => element !== selected && element.hasAttribute("data-ee-block-id"))
      .map(element => ({id:element.getAttribute("data-ee-block-id")!,label:element.textContent?.trim().slice(0,55) || element.getAttribute("data-ee-block-kind") || "Objeto"})));
  }, [block.id]);
  const applyReference = (action: "left"|"center"|"right"|"width"|"height") => {
    const selected = canvasNode();
    const parent = selected?.parentElement;
    const target = Array.from(parent?.children || []).find(element=>element.getAttribute("data-ee-block-id")===reference) as HTMLElement | undefined;
    if (!selected || !parent || !target) return;
    const scale = selected.getBoundingClientRect().width / selected.offsetWidth || 1;
    const box = selected.getBoundingClientRect();
    const other = target.getBoundingClientRect();
    if (action === "width" || action === "height") {
      onChange({...styles,[action]:`${Math.round(other[action]/scale)}px`,boxSizing:"border-box"});
    } else {
      const parentBox = parent.getBoundingClientRect();
      const padding = parseFloat(getComputedStyle(parent).paddingLeft) || 0;
      const edge = action === "left" ? other.left : action === "right" ? other.right-box.width : (other.left+other.right-box.width)/2;
      const left = Math.max(0,(edge-parentBox.left)/scale-parent.clientLeft-padding);
      onChange({...styles,display:styles.display || "block",marginLeft:`${Math.round(left)}px`,marginRight:"0"});
    }
    setMessage("Medida aplicada en píxeles. Puedes deshacer el cambio.");
  };
  const changePadding = (padding: string) => {
    const next: Record<string,string> = {...styles,padding};
    for (const side of ["Top","Right","Bottom","Left"]) delete next[`padding${side}`];
    onChange(next);
  };
  const inheritedSide = (kind: "padding"|"margin", side: string) => {
    if (styles[`${kind}${side}`]) return styles[`${kind}${side}`];
    if (typeof document === "undefined") return "";
    const declaration = document.createElement("div").style;
    declaration.setProperty(kind, styles[kind] || "");
    return declaration.getPropertyValue(`${kind}-${side.toLowerCase()}`);
  };
  return <div ref={root} className="ee-spacing-inspector">
    <fieldset><legend>Espaciado interior</legend>
      <label className="ee-spacing-toggle"><input type="checkbox" checked={separate} onChange={event=>setSeparate(event.target.checked)} />Editar cada lado</label>
      {separate ? <div className="ee-row2">{[["Top","Arriba"],["Right","Derecha"],["Bottom","Abajo"],["Left","Izquierda"]].map(([side,label])=><LengthInput key={side} label={`Padding ${label}`} value={inheritedSide("padding",side)} placeholder="0px" onChange={value=>onChange({...styles,[`padding${side}`]:value})} />)}</div> : <LengthInput label="Espaciado interior" value={styles.padding || ""} onChange={changePadding} placeholder="0px" />}
    </fieldset>
    <details><summary>Márgenes por lado</summary><div className="ee-row2">{[["Top","Arriba"],["Right","Derecha"],["Bottom","Abajo"],["Left","Izquierda"]].map(([side,label])=><LengthInput key={side} label={`Margen ${label}`} value={inheritedSide("margin",side)} onChange={value=>onChange({...styles,[`margin${side}`]:value})} placeholder="0px" />)}</div></details>
    {objects.length>0 && <fieldset><legend>Alinear con otro objeto</legend>
      <select className="ee-select" aria-label="Objeto de referencia" value={reference} onChange={event=>setReference(event.target.value)}><option value="">Selecciona un objeto del mismo contenedor</option>{objects.map(object=><option key={object.id} value={object.id}>{object.label}</option>)}</select>
      <div className="ee-reference-actions">{([["left","Mismo borde izquierdo"],["center","Mismo centro horizontal"],["right","Mismo borde derecho"],["width","Igualar ancho"],["height","Igualar altura"]] as const).map(([action,label])=><button className="ee-btn" type="button" key={action} disabled={!reference} onClick={()=>applyReference(action)}>{label}</button>)}</div>
      {message && <small role="status">{message}</small>}
    </fieldset>}
  </div>;
}
