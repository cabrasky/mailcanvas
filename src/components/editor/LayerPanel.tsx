import {useEffect,useMemo,useRef,useState} from "react";
import type {EmailBlock} from "../../services/emailBlocks";
import {tableRowGroups} from "../../services/tableRows";
import {blockChildren,canDropLayer,layerGlyphs,layerIndex,layerName,layerTypes} from "../../editor/selectionModel";
import SelectionPath from "./SelectionPath";

type Props={
 blocks:EmailBlock[];selectedIds:Set<string>;
 onSelect:(id:string,additive:boolean)=>void;onSelectTableField:(id:string,field:string)=>void;
 onMove:(id:string,delta:-1|1)=>void;onDelete:(id:string)=>void;
 onReorder:(movingId:string,targetId:string,after:boolean)=>void;
 onMoveInto?:(movingId:string,parentId:string)=>void;
 onContextMenu:(id:string,x:number,y:number)=>void;
};
type Drop={id:string;edge:"before"|"after"|"into"};
const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export default function LayerPanel(props:Props) {
 const {blocks,selectedIds,onSelect,onMove,onDelete,onSelectTableField,onReorder,onMoveInto,onContextMenu}=props;
 const index=useMemo(()=>layerIndex(blocks),[blocks]);
 const [collapsed,setCollapsed]=useState<Set<string>>(new Set());
 const [query,setQuery]=useState("");
 const [moving,setMoving]=useState<string|null>(null);
 const [drop,setDrop]=useState<Drop|null>(null);
 const tree=useRef<HTMLDivElement>(null);
 const blocked=useRef(false);
 const selectionKey=[...selectedIds].join("|");
 useEffect(()=>{
   setCollapsed(current=>{
    const next=new Set(current);
    for(const id of selectedIds)for(const ancestor of index.get(id)?.path.slice(0,-1) || [])next.delete(ancestor);
    return next.size===current.size?current:next;
   });
 },[selectionKey,index]);
 const matches=(block:EmailBlock)=>normalize(`${layerName(block)} ${layerTypes[block.type]} ${block.type==="table"?block.fields.join(" "):""}`).includes(normalize(query.trim()));
 const visible=(block:EmailBlock):boolean=>matches(block)||blockChildren(block).some(visible);
 const expanded=(block:EmailBlock)=>!!query.trim() || !collapsed.has(block.id);
 const toggle=(id:string)=>setCollapsed(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next;});
 const clearDrag=()=>{setMoving(null);setDrop(null);};
 const focus=(id:string|undefined)=>{if(id)tree.current?.querySelector<HTMLElement>(`[data-ee-layer-id="${CSS.escape(id)}"]`)?.focus();};
 const keyboard=(event:React.KeyboardEvent<HTMLDivElement>,block:EmailBlock)=>{
   if(event.target!==event.currentTarget)return;
   const entry=index.get(block.id)!;
   const rows=Array.from(tree.current?.querySelectorAll<HTMLElement>('[role="treeitem"]') || []);
   const position=rows.indexOf(event.currentTarget);
   if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Enter"," ","Home","End"].includes(event.key)){event.preventDefault();event.stopPropagation();}
   switch(event.key){
    case "ArrowUp":rows[position-1]?.focus();break;
    case "ArrowDown":rows[position+1]?.focus();break;
    case "ArrowRight":if(!expanded(block))toggle(block.id);else focus(blockChildren(block)[0]?.id);break;
    case "ArrowLeft":if(blockChildren(block).length && expanded(block))toggle(block.id);else focus(entry.parentId || undefined);break;
    case "Enter":case " ":onSelect(block.id,event.shiftKey);break;
    case "Home":rows[0]?.focus();break;
    case "End":rows.at(-1)?.focus();break;
   }
 };
 const render=(items:EmailBlock[]):React.ReactNode=>items.filter(visible).map(block=>{
   const entry=index.get(block.id)!;
   const children=blockChildren(block);
   const hasChildren=children.length>0 || block.type === "table";
   const selected=selectedIds.has(block.id);
   return <div className="ee-layer-node" key={block.id}>
    <div role="treeitem" aria-label={`${layerTypes[block.type]} · ${layerName(block)}`} aria-level={entry.depth+1} aria-selected={selected}
      aria-expanded={hasChildren?expanded(block):undefined} aria-posinset={entry.index+1} aria-setsize={entry.siblingCount}
      tabIndex={selected || !selectedIds.size && entry.index===0 && entry.depth===0?0:-1}
      draggable data-ee-layer-id={block.id} style={{paddingLeft:6+entry.depth*14}}
      className={`ee-layer-row ee-layer-draggable ${selected?"selected":""} ${moving===block.id?"dragging":""} ${drop?.id===block.id?`drop-${drop.edge}`:""}`}
      onKeyDown={event=>keyboard(event,block)}
      onPointerDown={event=>{blocked.current=!!(event.target as HTMLElement).closest('.ee-tree-actions,.ee-layer-disclosure');}}
      onDragStart={event=>{event.stopPropagation();if(blocked.current){event.preventDefault();return;}event.dataTransfer.setData("application/x-email-layer",block.id);event.dataTransfer.effectAllowed="move";setMoving(block.id);onSelect(block.id,false);}}
      onDragEnd={clearDrag}
      onDragOver={event=>{
        event.stopPropagation();if(!moving || !canDropLayer(index,moving,block.id))return;
        event.preventDefault();const box=event.currentTarget.getBoundingClientRect();const y=(event.clientY-box.top)/box.height;
        setDrop({id:block.id,edge:onMoveInto && ["container","if","loop"].includes(block.type) && y>0.25 && y<0.75?"into":y<0.5?"before":"after"});
      }}
      onDragLeave={event=>{if(!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget))setDrop(current=>current?.id===block.id?null:current);}}
      onDrop={event=>{event.preventDefault();event.stopPropagation();const source=event.dataTransfer.getData("application/x-email-layer");if(drop?.id===block.id && canDropLayer(index,source,block.id)){if(drop.edge==="into")onMoveInto?.(source,block.id);else onReorder(source,block.id,drop.edge==="after");}clearDrag();}}
      onContextMenu={event=>{event.preventDefault();event.stopPropagation();onSelect(block.id,false);onContextMenu(block.id,event.clientX,event.clientY);}}>
      <button type="button" className="ee-layer-grip" aria-label={`Arrastrar ${layerName(block)} para reordenar`} onClick={event=>onSelect(block.id,event.shiftKey)}>⠿</button>
      {hasChildren?<button type="button" className="ee-layer-disclosure" aria-label={`${expanded(block)?"Contraer":"Expandir"} ${layerName(block)}`} aria-expanded={expanded(block)} disabled={!!query.trim()} onClick={()=>toggle(block.id)}>{expanded(block)?"⌄":"›"}</button>:<span className="ee-layer-disclosure"/>}
      <button type="button" className="ee-layer-select" aria-pressed={selected} title={`${layerTypes[block.type]} · ${layerName(block)}`} onClick={event=>onSelect(block.id,event.shiftKey)}><span className={`ee-tree-glyph glyph-${block.type}`}>{layerGlyphs[block.type]}</span><span className="ee-tree-name">{layerName(block)}<small>{layerTypes[block.type]}</small></span></button>
      <div className="ee-tree-actions"><button type="button" aria-label="Mover arriba" disabled={entry.index===0} onClick={()=>onMove(block.id,-1)}>↑</button><button type="button" aria-label="Mover abajo" disabled={entry.index===entry.siblingCount-1} onClick={()=>onMove(block.id,1)}>↓</button><button type="button" aria-label="Eliminar" onClick={()=>onDelete(block.id)}>×</button></div>
    </div>
    {block.type === "table" && expanded(block) && <div className="ee-layer-table-structure" style={{paddingLeft:18+(entry.depth+1)*14}}>
      {block.fields.map(field=><button type="button" key={field} className="ee-layer-structural" onClick={()=>onSelectTableField(block.id,field)}>▦ {block.columnLabels?.[field] || field} · {block.columnFormats?.[field]?.type || "text"}</button>)}
      {tableRowGroups(block).map((row,rowIndex)=><details key={row.id} className="ee-layer-source"><summary>{rowIndex+1}. {row.type === "repeat"?`Repetir · ${row.collection}`:"Fila única"}</summary>{block.fields.map(field=><button type="button" key={field} onClick={()=>onSelectTableField(block.id,field)}>{block.columnLabels?.[field] || field} ← {row.cells[field]?.value || "Vacío"}</button>)}</details>)}
    </div>}
    {expanded(block) && render(children)}
   </div>;
 });
 return <section className="ee-layers-panel" aria-label="Capas">
   <div className="ee-library-intro"><strong>Estructura del correo</strong></div>
   <SelectionPath blocks={blocks} selectedIds={selectedIds} onSelect={onSelect}/>
   <div className="ee-panel-search"><span aria-hidden="true">⌕</span><input type="search" aria-label="Buscar capas" placeholder="Buscar texto, tipo o variable…" value={query} onChange={event=>setQuery(event.target.value)}/></div>
   <div className="ee-layer-tools"><span>{index.size} capas</span><button type="button" disabled={!!query.trim()} onClick={()=>setCollapsed(new Set())}>Expandir todo</button><button type="button" disabled={!!query.trim()} onClick={()=>setCollapsed(new Set([...index.values()].filter(entry=>blockChildren(entry.block).length || entry.block.type==="table").map(entry=>entry.block.id)))}>Contraer todo</button></div>
   <div className="ee-layer-tree" ref={tree} role="tree" aria-label="Árbol de capas" aria-multiselectable="true">{blocks.some(visible)?render(blocks):<p className="ee-empty-hint">{blocks.length?`No hay capas para «${query}».`:"Añade un bloque desde Insertar."}</p>}</div>
   <footer className="ee-layers-footer" aria-live="polite">{drop && index.has(drop.id)?`${drop.edge==="into"?"Dentro de":drop.edge==="before"?"Antes de":"Después de"} ${layerName(index.get(drop.id)!.block)}`:query?`${[...index.values()].filter(entry=>matches(entry.block)).length} coincidencias`:`${selectedIds.size} seleccionadas · Mayús + clic para añadir`}</footer>
 </section>;
}
