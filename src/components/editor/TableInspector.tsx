import { useEffect, useState } from "react";
import ValueInput from "./ValueInput";
import { singleVariable } from "../../services/valueSyntax";
import { getSampleObjectPaths } from "../../services/emailBlockActions";
import { resolveSample } from "../../services/blockPreview";
import { tableRowGroups, tableSampleRows } from "../../services/tableRows";
import type { EmailToken } from "../../services/emailTemplateRenderer";
import type { TableRowGroup } from "../../services/emailBlocks";
import type { EmailBlock } from "../../services/emailBlocks";

type TableBlock = Extract<EmailBlock, { type: "table" }>;
type Props = { block: TableBlock; onPatch: (patch: Partial<TableBlock>) => void; tokens: EmailToken[]; mode?: "content" | "design"; selectedField?: string };

export default function TableInspector({ block, onPatch: patch, tokens, mode = "content", selectedField }: Props) {
  const [customField, setCustomField] = useState("");
  const rows = tableRowGroups(block);
  const [tab,setTab]=useState<"columns"|"rows"|"result">("columns");
  const [selectedColumn,setSelectedColumn]=useState(block.fields[0]);
  const [dragging,setDragging]=useState<string|null>(null);
  const [dropColumn,setDropColumn]=useState<string|null>(null);
  useEffect(()=>{if(selectedField){setSelectedColumn(selectedField);setTab("columns");}},[selectedField]);
  const globalOptions=tokens.flatMap(token=>[{value:token.varName,label:token.label},...(!Array.isArray(token.sample)?getSampleObjectPaths(token.sample).map(path=>({value:`${token.varName}.${path}`,label:token.label})):[])]);
  const optionsFor=(row:TableRowGroup)=>[...globalOptions,...(row.type === "repeat"?getSampleObjectPaths(resolveSample(row.collection??"",tokens)).map(path=>({value:`item.${path}`,label:"Elemento actual"})):[])];
  const generated=tableSampleRows(block,tokens);
  const reorderColumn=(target:string)=>{if(!dragging||dragging===target)return;const next=block.fields.filter(field=>field!==dragging);next.splice(next.indexOf(target),0,dragging);patch({fields:next});setDragging(null);setDropColumn(null);};
  const patchRows = (next: TableRowGroup[]) => patch({rowGroups:next});
  const changeRow = (id: string, change: Partial<TableRowGroup>) => patchRows(rows.map(row=>row.id === id ? {...row,...change} : row));
  const addRow = (type: "repeat" | "single") => patchRows([...rows,{id:crypto.randomUUID(),type,collection:type === "repeat" ? tokens.find(token=>Array.isArray(token.sample))?.varName ?? "" : undefined,cells:Object.fromEntries(block.fields.map(field=>[field,{mode:type === "repeat" ? "template" as const : "text" as const,value:type === "repeat" ? `\${item.${field}}` : ""}]))}]);
  const addColumn = () => {
    const value = customField.trim();
    if (!/^[\w$]+(?:\.[\w$]+)*$/.test(value) || block.fields.includes(value)) return;
    patch({ fields: [...block.fields, value], rowGroups: rows.map(row=>({...row,cells:{...row.cells,[value]:{mode:row.type === "repeat" ? "expression" : "text",value:row.type === "repeat" ? `item.${value}` : ""}}})) });
    setCustomField("");
  };
  const moveColumn = (index: number, delta: -1 | 1) => {
    const next = [...block.fields];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    patch({ fields: next });
  };
  return <details className="ee-inspector-section" open>
    <summary>{mode === "design" ? "Apariencia de la tabla" : "Configurar tabla"}</summary>
    <div className="ee-inspector-section-body">
      {mode === "content" && <div className="ee-table-tabs" role="group" aria-label="Configuración de tabla">{([["columns","Columnas"],["rows","Filas"],["result","Resultado"]] as const).map(([value,label])=><button key={value} aria-pressed={tab===value} onClick={()=>setTab(value)}>{label}</button>)}</div>}
      <div hidden={mode !== "design"}>
      <div className="ee-row2">
        <label className="ee-field"><span>Padding</span><input className="ee-input" value={block.cellPadding ?? "8px"} onChange={event => patch({ cellPadding: event.target.value })} placeholder="8px" /></label>
        <label className="ee-field"><span>Fondo cabecera</span><input className="ee-input" type="color" value={block.headerBackground ?? "#f1f5f9"} onChange={event => patch({ headerBackground: event.target.value })} /></label>
        <label className="ee-field"><span>Texto cabecera</span><input className="ee-input" type="color" value={block.headerColor ?? "#334155"} onChange={event => patch({ headerColor: event.target.value })} /></label>
        <label className="ee-field"><span>Bordes</span><input className="ee-input" type="color" value={block.borderColor ?? "#e2e8f0"} onChange={event => patch({ borderColor: event.target.value })} /></label>
      </div>
      <label className="ee-check-row"><input type="checkbox" checked={block.header ?? false} onChange={event => patch({ header: event.target.checked })} /> Mostrar encabezado</label>
      <label className="ee-check-row"><input type="checkbox" checked={block.striped ?? false} onChange={event => patch({ striped: event.target.checked })} /> Filas alternas (zebra)</label>
      {block.striped && <label className="ee-field"><span>Color de fila alterna</span><input className="ee-input" type="color" value={block.stripeColor ?? "#f8fafc"} onChange={event => patch({ stripeColor: event.target.value })} /></label>}
      </div>
      <div hidden={mode !== "content" || tab !== "columns"}>
      <p className="ee-help-note">Arrastra ⠿ para ordenar. Abre una columna para configurar su encabezado y formato.</p>
      {block.fields.map((field, index) => <details className={`ee-column-card ${dropColumn===field ? "drop-before" : ""}`} key={field} open={selectedColumn===field}
        onDragOver={event=>{if(dragging){event.preventDefault();setDropColumn(field);}}} onDrop={event=>{event.preventDefault();reorderColumn(field);}}>
        <summary onClick={event=>{event.preventDefault();setSelectedColumn(current=>current===field?"":field);}}><button draggable className="ee-column-grip" aria-label={`Arrastrar columna ${field}`} onClick={event=>event.stopPropagation()} onDragStart={event=>{event.dataTransfer.setData("application/x-email-column",field);event.dataTransfer.effectAllowed="move";setDragging(field);}} onDragEnd={()=>{setDragging(null);setDropColumn(null);}}>⠿</button><strong>{index+1}. {block.columnLabels?.[field] || field}</strong><small>{block.columnFormats?.[field]?.type === "currency" ? "€ Moneda" : block.columnFormats?.[field]?.type === "number" ? "123 Número" : "Texto"}</small><span>⌄</span></summary>
        <div className="ee-column-editor">
        <div className="ee-column-order">
          <strong>{index + 1}</strong>
          <button disabled={!index} aria-label="Subir columna" onClick={() => moveColumn(index, -1)}>↑</button>
          <button disabled={index === block.fields.length - 1} aria-label="Bajar columna" onClick={() => moveColumn(index, 1)}>↓</button>
          <button aria-label={`Quitar columna ${field}`} onClick={() => patch({ fields: block.fields.filter(item => item !== field) })}>×</button>
        </div>
        <label className="ee-field"><span>Etiqueta</span><input className="ee-input" value={block.columnLabels?.[field] ?? field.split(".").pop() ?? field} onChange={event => patch({ columnLabels: { ...block.columnLabels, [field]: event.target.value } })} /></label>
        <label className="ee-field"><span>Alineación</span>
          <select className="ee-select" value={block.columnAlignments?.[field] ?? "left"} onChange={event => patch({ columnAlignments: { ...block.columnAlignments, [field]: event.target.value as "left" | "center" | "right" } })}>
            <option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option>
          </select>
        </label>
        <label className="ee-field"><span>Ancho</span><input className="ee-input" value={block.columnWidths?.[field] ?? ""} onChange={event => patch({ columnWidths: { ...block.columnWidths, [field]: event.target.value } })} placeholder="120px" /></label>
        <label className="ee-field"><span>Formato de valores</span><select className="ee-select" aria-label={`Formato ${field}`} value={block.columnFormats?.[field]?.type ?? "text"} onChange={event=>patch({columnFormats:{...block.columnFormats,[field]:{...block.columnFormats?.[field],type:event.target.value as "text" | "number" | "currency",decimals:event.target.value === "currency" ? 2 : 0}}})}><option value="text">Texto / original</option><option value="number">Número</option><option value="currency">Moneda (€)</option></select></label>
        {block.columnFormats?.[field]?.type && block.columnFormats[field].type !== "text" && <label className="ee-field"><span>Decimales</span><input className="ee-input" type="number" min="0" max="6" aria-label={`Decimales ${field}`} value={block.columnFormats[field].decimals ?? 0} onChange={event=>patch({columnFormats:{...block.columnFormats,[field]:{...block.columnFormats![field],decimals:Math.max(0,Math.min(6,Number(event.target.value)))}}})}/></label>}
        <label className="ee-field"><span>Prefijo</span><input className="ee-input" aria-label={`Prefijo ${field}`} value={block.columnFormats?.[field]?.prefix ?? ""} onChange={event=>patch({columnFormats:{...block.columnFormats,[field]:{type:"text",...block.columnFormats?.[field],prefix:event.target.value}}})}/></label>
        <label className="ee-field"><span>Sufijo</span><input className="ee-input" aria-label={`Sufijo ${field}`} value={block.columnFormats?.[field]?.suffix ?? (block.columnFormats?.[field]?.type === "currency" ? " €" : "")} onChange={event=>patch({columnFormats:{...block.columnFormats,[field]:{type:"text",...block.columnFormats?.[field],suffix:event.target.value}}})}/></label>
        <p className="ee-help-note" style={{gridColumn:"1 / -1"}}>Se aplica a variables y fórmulas de esta columna. El texto fijo se conserva tal como lo escribes.</p>
      </div></details>)}
      <div className="ee-add-column">
        <input className="ee-input" aria-label="Nombre del nuevo campo" value={customField} onChange={event => setCustomField(event.target.value)} placeholder="Añadir campo · sku" />
        <button className="ee-btn" onClick={addColumn}>＋ Columna</button>
      </div>
      </div><div hidden={mode !== "content" || tab !== "rows"}>
      <h4 className="ee-subsection-title">Filas y fuentes de datos</h4>
      <p className="ee-help-note">Cada grupo añade filas a la misma tabla, de arriba abajo. En los arrays, <code>item</code> es el elemento actual.</p>
      {rows.map((row,index)=><details className="ee-table-row-group" key={row.id} open={index===0}>
        <summary className="ee-table-row-heading"><strong>{index+1}. {row.type === "repeat" ? "Filas de una lista" : "Fila única"}</strong>
          <button className="ee-btn icon" aria-label={`Subir grupo ${index+1}`} disabled={!index} onClick={()=>{const next=[...rows];[next[index-1],next[index]]=[next[index],next[index-1]];patchRows(next);}}>↑</button>
          <button className="ee-btn icon" aria-label={`Bajar grupo ${index+1}`} disabled={index===rows.length-1} onClick={()=>{const next=[...rows];[next[index+1],next[index]]=[next[index],next[index+1]];patchRows(next);}}>↓</button>
          <button className="ee-btn icon" aria-label={`Eliminar grupo ${index+1}`} onClick={()=>patchRows(rows.filter(item=>item.id!==row.id))}>×</button></summary>
        {row.type === "repeat" && <div className="ee-field"><span>Array de origen</span><ValueInput allowText={false} mode="dynamic" label={`Array de origen ${index+1}`} value={row.collection ?? ""} options={globalOptions.filter(option=>Array.isArray(resolveSample(option.value,tokens)))} onChange={value=>changeRow(row.id,{collection:singleVariable(value)??value})} placeholder="${products}" /></div>}
        {block.fields.map(field=><div className="ee-table-cell-editor" key={field}>
          <div className="ee-table-cell-title"><strong>{block.columnLabels?.[field] || field}</strong><span>{row.cells[field]?.mode === "text" ? "Texto fijo" : "ƒ Dinámico"}</span></div>
          <ValueInput mode={row.cells[field]?.mode === "text" ? "text" : "dynamic"} label={`Valor ${index+1} ${field}`} value={row.cells[field]?.value ?? ""} options={optionsFor(row)} onChange={(value,mode)=>changeRow(row.id,{cells:{...row.cells,[field]:{mode:mode==="text"?"text":value.includes("${")?"template":"expression",value}}})} placeholder="Texto, ${item.campo} o ${item.quantity * item.unitPrice} €" />
          <div className="ee-cell-preview"><span>Ejemplo</span><output>{generated.find(item=>item.groupId === row.id)?.values[field] || "Sin valor en la muestra"}</output></div>
        </div>)}
        <p className="ee-help-note">Usa <code>{"${item.campo}"}</code> para insertar un valor. Puedes añadir texto alrededor: <code>{"${item.unitPrice} €"}</code>. Tab o Intro acepta una sugerencia.</p>
      </details>)}
      <datalist id={`arrays-${block.id}`}>{tokens.filter(token=>Array.isArray(token.sample)).map(token=><option key={token.varName} value={token.varName}>{token.label}</option>)}</datalist>
      <div className="ee-row2"><button className="ee-btn" onClick={()=>addRow("repeat")}>＋ Filas de array</button><button className="ee-btn" onClick={()=>addRow("single")}>＋ Fila única</button></div>
      </div><div hidden={mode !== "content" || tab !== "result"}>
        <div className="ee-generated-heading"><strong>{generated.length} filas generadas</strong><small>{block.fields.length} columnas · {rows.length} fuentes</small></div>
        <p className="ee-help-note">Muestra calculada con los datos de ejemplo actuales. Las filas vacías pueden indicar un campo o una fórmula sin valor.</p>
        <div className="ee-generated-table"><table><thead><tr>{block.fields.map(field=><th key={field}>{block.columnLabels?.[field] || field}</th>)}</tr></thead><tbody>{generated.slice(0,20).map(row=><tr key={row.key}>{block.fields.map(field=><td key={field}>{row.values[field] || "—"}</td>)}</tr>)}</tbody></table></div>
        {generated.length>20 && <p className="ee-help-note">Se muestran las primeras 20 filas.</p>}
        {!generated.length && <p className="ee-empty-hint">Sin filas. Revisa los arrays de origen o añade una fila única.</p>}
      </div>
    </div>
  </details>;
}
