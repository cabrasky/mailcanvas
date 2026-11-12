import React, { useRef, useState } from "react";
import type { EmailBlock, InlineNode } from "../../services/emailBlocks";
import { tableRowGroups } from "../../services/tableRows";

type Props = {
  blocks: EmailBlock[]; selectedIds: Set<string>;
  onSelect: (id: string, additive: boolean) => void; onSelectTableField: (id: string, field: string) => void;
  onMove: (id: string, delta: -1 | 1) => void; onDelete: (id: string) => void;
  onReorder: (movingId: string, targetId: string, after: boolean) => void; onContextMenu: (id: string, x: number, y: number) => void;
};
const typeName: Record<EmailBlock["type"], string> = {
  component:"Componente vinculado",
  html: "HTML protegido", heading: "Título", paragraph: "Texto", rich: "Texto", variable: "Dato", button: "Botón", image: "Imagen",
  divider: "Separador", spacer: "Espaciador", table: "Tabla", container: "Contenedor", loop: "Repetir", if: "Condición",
};
const glyph: Record<EmailBlock["type"], string> = { component: "◇", html: "<>", heading: "T", paragraph: "¶", rich: "¶", variable: "ƒ", button: "↗", image: "▧", divider: "—", spacer: "↕", table: "▦", container: "▱", loop: "⟳", if: "◇" };
const inlineText = (nodes: InlineNode[]): string => nodes.map(node => node.type === "text" ? node.text : node.type === "variable" ? `\${${node.expression}}` : node.tag === "br" ? " · " : inlineText(node.children)).join("");
const name = (block: EmailBlock): string => block.type === "component" ? `◇ ${block.name}` : block.type === "heading" || block.type === "paragraph" ? block.text : block.type === "rich" ? inlineText(block.children) || "Texto" : block.type === "variable" ? block.expression : block.type === "table" || block.type === "loop" ? block.collection : block.type === "if" ? block.variable : block.type === "button" ? block.text : block.type === "image" ? block.alt || "Imagen" : block.type === "container" ? block.className || (block.styles?.display === "flex" ? "Fila" : "Grupo") : typeName[block.type];
const childrenOf = (block: EmailBlock): EmailBlock[] => block.type === "container" || block.type === "loop" || block.type === "if" ? block.children : [];
const flatten = (blocks: EmailBlock[]): EmailBlock[] => blocks.flatMap(block => [block, ...flatten(childrenOf(block))]);
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function LayerPanel({ blocks, selectedIds, onSelect, onSelectTableField, onMove, onDelete, onReorder, onContextMenu }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const all = flatten(blocks);
  const matches = (block: EmailBlock): boolean => normalize(`${name(block)} ${typeName[block.type]} ${block.type === "table" ? block.fields.join(" ") : ""}`).includes(normalize(query.trim()));
  const visible = (block: EmailBlock): boolean => matches(block) || childrenOf(block).some(visible);
  const isCollapsed = (block: EmailBlock) => !query.trim() && collapsed.has(block.id);
  const [dragging, setDragging] = useState<string | null>(null);
  const dragBlocked=useRef(false);
  const [dropTarget, setDropTarget] = useState<{ id: string; after: boolean } | null>(null);
  const render = (items: EmailBlock[], depth = 0, loopId?: string): React.ReactNode => items.map((block, index) => !visible(block) ? null : <React.Fragment key={block.id}>
    <div draggable data-ee-layer-id={block.id} className={`ee-layer-row ee-layer-draggable ${dragging===block.id?"dragging":""} ${selectedIds.has(block.id) ? "selected" : ""} ${dropTarget?.id === block.id ? (dropTarget.after ? "drop-after" : "drop-before") : ""}`} style={{ paddingLeft: 6 + depth * 14 }}
      onPointerDown={event=>{dragBlocked.current=!!(event.target as HTMLElement).closest(".ee-tree-actions,.ee-layer-disclosure");}}
      onDragStart={event=>{
        if(dragBlocked.current){event.preventDefault();return;}
        event.dataTransfer.setData("application/x-email-layer",block.id);event.dataTransfer.effectAllowed="move";setDragging(block.id);
      }}
      onDragEnd={()=>{setDragging(null);setDropTarget(null);}}
      onDragOver={event => {
        if (!dragging || dragging === block.id) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        setDropTarget({ id: block.id, after: event.clientY > rect.top + rect.height / 2 });
      }}
      onDragLeave={() => setDropTarget(current => current?.id === block.id ? null : current)}
      onContextMenu={event => { event.preventDefault(); event.stopPropagation(); onSelect(block.id, false); onContextMenu(block.id, event.clientX, event.clientY); }}
      onDrop={event => {
        event.preventDefault();
        const source = event.dataTransfer.getData("application/x-email-layer");
        if (source && source !== block.id) onReorder(source, block.id, dropTarget?.after ?? false);
        setDragging(null); setDropTarget(null);
      }}>
      <button className="ee-layer-grip" aria-label={`Arrastrar ${name(block)} para reordenar`} title="Puedes arrastrar desde cualquier parte de la fila" onClick={event=>onSelect(block.id,event.shiftKey)}>⠿</button>
      {(block.type === "container" || block.type === "loop" || block.type === "if" || block.type === "table") ? <button className="ee-layer-disclosure" aria-label={`${isCollapsed(block) ? "Expandir" : "Contraer"} ${name(block)}`} aria-expanded={!isCollapsed(block)} disabled={!!query.trim()}
          onClick={event => { event.stopPropagation(); setCollapsed(current => { const next = new Set(current); if (next.has(block.id)) next.delete(block.id); else next.add(block.id); return next; }); }}>
          {isCollapsed(block) ? "›" : "⌄"}
        </button> : <span className="ee-layer-disclosure" />}
      <button className="ee-layer-select" aria-pressed={selectedIds.has(block.id)} onClick={event => onSelect(block.id, event.shiftKey)} title={`${typeName[block.type]} · ${name(block)}`}>
        <span className={`ee-tree-glyph glyph-${block.type}`}>{glyph[block.type]}</span><span className="ee-tree-name">{name(block)}</span>
      </button>
      <div className="ee-tree-actions">
        <button aria-label="Mover arriba" title="Subir" disabled={!index} onClick={() => onMove(block.id, -1)}>↑</button>
        <button aria-label="Mover abajo" title="Bajar" disabled={index === items.length - 1} onClick={() => onMove(block.id, 1)}>↓</button>
        <button aria-label="Eliminar" title="Eliminar" onClick={() => onDelete(block.id)}>×</button>
      </div>
    </div>
    {block.type === "table" && !isCollapsed(block) && block.fields.map(field => <button key={`${block.id}-cell-${field}`} className="ee-layer-row ee-layer-structural" style={{ paddingLeft: 6 + (depth + 1) * 14 }}
      onClick={() => onSelectTableField(block.id, field)} title={`Seleccionar columna ${field}`}>
      <span className="ee-layer-grip">⌞</span><span className="ee-tree-glyph">▦</span><span className="ee-tree-name">{block.columnLabels?.[field] || field} <small>· {block.columnFormats?.[field]?.type === "currency" ? "Moneda" : block.columnFormats?.[field]?.type === "number" ? "Número" : "Original"}</small></span>
    </button>)}
    {block.type === "table" && !isCollapsed(block) && tableRowGroups(block).map((row,index)=><div className="ee-table-layer-group" key={row.id} style={{paddingLeft:12+(depth+1)*14}}>
      <button className="ee-layer-select" onClick={()=>onSelect(block.id,false)} title="Editar las fuentes y valores en Diseño de tabla"><span className="ee-tree-glyph">{row.type === "repeat" ? "⟳" : "−"}</span><span className="ee-tree-name">{index+1}. {row.type === "repeat" ? `Repetir · ${row.collection}` : "Fila única"}</span></button>
      {block.fields.map(field=><button className="ee-table-layer-cell" key={field} onClick={()=>onSelectTableField(block.id,field)} title={`${block.columnLabels?.[field] || field}: ${row.cells[field]?.value ?? "Vacío"}`}>{block.columnLabels?.[field] || field} ← {row.cells[field]?.mode === "expression" ? "ƒ " : ""}{row.cells[field]?.value || "Vacío"}</button>)}
    </div>)}
    {(block.type === "container" || block.type === "loop" || block.type === "if") && !isCollapsed(block) && render(block.children, depth + 1, block.type === "loop" ? block.id : loopId)}
  </React.Fragment>);
  return <section className="ee-layers-panel" aria-label="Capas">
    <div className="ee-library-intro"><strong>Estructura del correo</strong><p>Selecciona una capa para editarla en el lienzo.</p></div>
    <div className="ee-panel-search"><span aria-hidden="true">⌕</span><input type="search" aria-label="Buscar capas" placeholder="Buscar texto, tipo o variable…" value={query} onChange={event => setQuery(event.target.value)} /></div>
    <div className="ee-layer-tools"><span>{all.length} capas</span><button disabled={!!query.trim()} onClick={() => setCollapsed(new Set())}>Expandir todo</button><button disabled={!!query.trim()} onClick={() => setCollapsed(new Set(all.filter(block => childrenOf(block).length || block.type === "table").map(block => block.id)))}>Contraer todo</button></div>
    <div className="ee-layer-tree">{!blocks.length ? <p className="ee-empty-hint">El lienzo todavía está vacío. Añade un bloque desde Insertar.</p> : !blocks.some(visible) ? <p className="ee-empty-hint">No hay capas para «{query}».</p> : render(blocks)}</div>
    <footer className="ee-layers-footer">{query.trim() ? `${all.filter(matches).length} coincidencias` : selectedIds.size ? `${selectedIds.size} seleccionadas · Mayús + clic para añadir` : "Arrastra cualquier fila para reordenar"}</footer>
  </section>;
}
