import {useMemo} from "react";
import type {EmailBlock} from "../../services/emailBlocks";
import {layerIndex,layerName} from "../../editor/selectionModel";
export default function SelectionPath({blocks,selectedIds,onSelect,onClear}:{blocks:EmailBlock[];selectedIds:Set<string>;onSelect:(id:string,additive:boolean)=>void;onClear?:()=>void}) {
 const index=useMemo(()=>layerIndex(blocks),[blocks]);
 const selected=selectedIds.size===1?index.get([...selectedIds][0]):undefined;
 return <nav className="ee-selection-path" aria-label="Ruta de selección">
  <button type="button" onClick={onClear} disabled={!onClear}>Correo</button>
  {selected?selected.path.map((id,position)=>{
    const entry=index.get(id)!;const name=layerName(entry.block);
    return <span key={id}><span aria-hidden="true">›</span><button type="button" title={name} aria-current={position===selected.path.length-1?"location":undefined} onClick={()=>onSelect(id,false)}>{name}</button></span>;
  }):<span>{selectedIds.size?`${selectedIds.size} seleccionados`:"Sin selección"}</span>}
 </nav>;
}
