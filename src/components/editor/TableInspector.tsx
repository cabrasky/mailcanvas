import {useEffect,useState} from "react";
import type {EmailToken} from "../../services/emailTemplateRenderer";
import type {TableColumnFormat,TableRowGroup} from "../../services/emailBlocks";
import {tableRowGroups,tableSampleRows} from "../../services/tableRows";
import {resolveSample} from "../../services/blockPreview";
import {getSampleObjectPaths} from "../../services/emailBlockActions";
import {singleVariable} from "../../services/valueSyntax";
import {addColumn,newRowGroup,removeColumn,reorderColumns,type TableBlock} from "../../editor/tableModel";
import ValueInput from "./ValueInput";
import {ColorInput,LengthInput} from "./StyleInputs";

type Props={block:TableBlock;onPatch:(patch:Partial<TableBlock>)=>void;tokens:EmailToken[];mode?:"content"|"design";selectedField?:string};
export default function TableInspector({block,onPatch,tokens,mode="content",selectedField}:Props) {
  const [tab,setTab]=useState<"columns"|"rows"|"result">("columns");
  const [column,setColumn]=useState(block.fields[0] || "");
  const [draft,setDraft]=useState("");
  const [error,setError]=useState("");
  const [dragging,setDragging]=useState<string|null>(null);
  const [drop,setDrop]=useState<string|null>(null);
  const rows=tableRowGroups(block);
  const generated=tableSampleRows(block,tokens);
  const active=block.fields.includes(column)?column:block.fields[0] || "";
  const label=block.columnLabels?.[active] || active;
  const format=block.columnFormats?.[active] || {type:"text" as const};
  const options=tokens.flatMap(token=>[{value:token.varName,label:token.label},...(!Array.isArray(token.sample)?getSampleObjectPaths(token.sample).map(path=>({value:`${token.varName}.${path}`,label:token.label})):[])]);
  useEffect(()=>{setColumn(block.fields[0] || "");setTab("columns");setError("");},[block.id]);
  useEffect(()=>{if(selectedField){setColumn(selectedField);setTab("columns");}},[selectedField]);
  const changeFormat=(patch:Partial<TableColumnFormat>)=>onPatch({columnFormats:{...block.columnFormats,[active]:{...format,...patch}}});
  const changeRow=(id:string,patch:Partial<TableRowGroup>)=>onPatch({rowGroups:rows.map(row=>row.id===id?{...row,...patch}:row)});
  const moveGroup=(index:number,direction:-1|1)=>{
    const next=[...rows];const target=index+direction;
    if(target<0 || target>=rows.length)return;
    [next[index],next[target]]=[next[target],next[index]];onPatch({rowGroups:next});
  };
  const moveColumn=(direction:-1|1)=>{
    const index=block.fields.indexOf(active),target=index+direction;
    if(target<0 || target>=block.fields.length)return;
    if(direction===-1)onPatch(reorderColumns(block,active,block.fields[target]));
    else onPatch(reorderColumns(block,block.fields[target],active));
  };
  const appendColumn=()=>{
    const field=draft.trim();const patch=addColumn(block,field);
    if(!patch){setError("Usa un campo único como nombre, sku o producto.precio.");return;}
    onPatch(patch);setColumn(field);setDraft("");setError("");
  };
  const appendRow=(type:"repeat"|"single")=>onPatch({rowGroups:[...rows,newRowGroup(block,type,tokens.find(token=>Array.isArray(token.sample))?.varName || "",crypto.randomUUID())]});
  const selectColumn=(field:string)=>{setColumn(field);setTab("columns");};
  const preview=<div className="ee-table-sample" aria-label="Muestra de la tabla"><table><thead><tr>{block.fields.map(field=><th key={field}>
    <button type="button" draggable aria-label={`Seleccionar columna ${block.columnLabels?.[field] || field}`} aria-pressed={active===field}
      className={drop===field?"ee-table-drop-column":""} onClick={()=>selectColumn(field)}
      onDragStart={event=>{event.dataTransfer.setData("application/x-email-column",field);setDragging(field);}}
      onDragEnd={()=>{setDragging(null);setDrop(null);}}
      onDragOver={event=>{if(dragging){event.preventDefault();setDrop(field);}}}
      onDrop={event=>{event.preventDefault();if(dragging)onPatch(reorderColumns(block,dragging,field));setDragging(null);setDrop(null);}}>
      <span aria-hidden="true">⠿ </span>{block.columnLabels?.[field] || field}
    </button></th>)}</tr></thead><tbody>{generated.slice(0,tab==="result"?20:3).map(row=><tr key={row.key}>{block.fields.map(field=><td key={field}><button type="button" onClick={()=>selectColumn(field)} aria-label={`Editar ${field}, fila ${row.key}`}>{row.values[field] ?? ""}</button></td>)}</tr>)}</tbody></table>{!generated.length && <p className="ee-empty-hint">Sin filas en los datos de ejemplo.</p>}</div>;

  return <section className="ee-table-inspector" aria-label="Configurar tabla">
    {mode==="design"?<div className="ee-table-design ee-row2">
      <LengthInput label="Padding de celdas" value={block.cellPadding || "8px"} onChange={cellPadding=>onPatch({cellPadding})}/>
      <LengthInput label="Grosor del borde" value={block.borderWidth || "1px"} onChange={borderWidth=>onPatch({borderWidth})}/>
      <ColorInput label="Fondo cabecera" value={block.headerBackground || "#f1f5f9"} onChange={headerBackground=>onPatch({headerBackground})}/>
      <ColorInput label="Texto cabecera" value={block.headerColor || "#334155"} onChange={headerColor=>onPatch({headerColor})}/>
      <ColorInput label="Bordes" value={block.borderColor || "#e2e8f0"} onChange={borderColor=>onPatch({borderColor})}/>
      <label className="ee-check-row"><input type="checkbox" checked={!!block.header} onChange={event=>onPatch({header:event.target.checked})}/>Mostrar encabezado</label>
      <label className="ee-check-row"><input type="checkbox" checked={!!block.striped} onChange={event=>onPatch({striped:event.target.checked})}/>Filas alternas (zebra)</label>
      {block.striped && <ColorInput label="Color de fila alterna" value={block.stripeColor || "#f8fafc"} onChange={stripeColor=>onPatch({stripeColor})}/>}
    </div>:<>
      <div className="ee-table-tabs" role="group" aria-label="Configuración de tabla">{([["columns","Columnas"],["rows","Filas"],["result","Resultado"]] as const).map(([value,title])=><button type="button" key={value} aria-pressed={tab===value} onClick={()=>setTab(value)}>{title}</button>)}</div>
      <div className="ee-generated-heading"><strong>{generated.length} filas generadas</strong><small>{block.fields.length} columnas · {rows.length} fuentes</small></div>
      {preview}
      {tab==="columns" && <>
        <div className="ee-add-column"><input className="ee-input" aria-label="Nombre del nuevo campo" placeholder="Nuevo campo · sku" value={draft} onChange={event=>setDraft(event.target.value)} onKeyDown={event=>{if(event.key==="Enter")appendColumn();}}/><button type="button" className="ee-btn" onClick={appendColumn}>＋ Columna</button></div>
        {error && <p role="alert">{error}</p>}
        {active && <fieldset className="ee-table-column-properties"><legend>{label}</legend>
          <div className="ee-column-order"><button type="button" aria-label="Subir columna" disabled={block.fields.indexOf(active)===0} onClick={()=>moveColumn(-1)}>←</button><button type="button" aria-label="Bajar columna" disabled={block.fields.indexOf(active)===block.fields.length-1} onClick={()=>moveColumn(1)}>→</button><button type="button" aria-label={`Quitar columna ${active}`} onClick={()=>onPatch(removeColumn(block,active))}>Eliminar columna</button></div>
          <label className="ee-field"><span>Etiqueta</span><input className="ee-input" value={block.columnLabels?.[active] || active} onChange={event=>onPatch({columnLabels:{...block.columnLabels,[active]:event.target.value}})}/></label>
          <LengthInput label="Ancho de columna" value={block.columnWidths?.[active] || ""} onChange={width=>onPatch({columnWidths:{...block.columnWidths,[active]:width}})} placeholder="120px"/>
          <label className="ee-field"><span>Alineación de columna</span><select className="ee-select" value={block.columnAlignments?.[active] || "left"} onChange={event=>onPatch({columnAlignments:{...block.columnAlignments,[active]:event.target.value as "left"|"center"|"right"}})}><option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option></select></label>
          <label className="ee-field"><span>Formato de valores</span><select className="ee-select" aria-label={`Formato ${active}`} value={format.type} onChange={event=>changeFormat({type:event.target.value as TableColumnFormat["type"],decimals:event.target.value==="currency"?2:0})}><option value="text">Texto / original</option><option value="number">Número</option><option value="currency">Moneda (€)</option></select></label>
          {format.type!=="text" && <label className="ee-field"><span>Decimales</span><input className="ee-input" type="number" aria-label={`Decimales ${active}`} min="0" max="6" value={format.decimals ?? 0} onChange={event=>changeFormat({decimals:Math.max(0,Math.min(6,Number(event.target.value)))})}/></label>}
          <div className="ee-row2"><label className="ee-field"><span>Prefijo</span><input className="ee-input" aria-label={`Prefijo ${active}`} value={format.prefix || ""} onChange={event=>changeFormat({prefix:event.target.value})}/></label><label className="ee-field"><span>Sufijo</span><input className="ee-input" aria-label={`Sufijo ${active}`} value={format.suffix ?? (format.type==="currency"?" €":"")} onChange={event=>changeFormat({suffix:event.target.value})}/></label></div>
          <details open><summary>Valores por fuente</summary>{rows.map((row,index)=><div className="ee-table-cell-editor" key={row.id}><strong>{index+1}. {row.type==="repeat"?`Lista · ${row.collection}`:"Fila única"}</strong><ValueInput label={`Valor ${index+1} ${active}`} mode={row.cells[active]?.mode==="text"?"text":"dynamic"} value={row.cells[active]?.value || ""}
            options={[...options,...(row.type==="repeat"?getSampleObjectPaths(resolveSample(row.collection || "",tokens)).map(path=>({value:`item.${path}`,label:"Elemento actual"})):[])]}
            onChange={(value,mode)=>changeRow(row.id,{cells:{...row.cells,[active]:{value,mode:mode==="text"?"text":value.includes("${")?"template":"expression"}}})}/></div>)}</details>
        </fieldset>}
      </>}
      {tab==="rows" && <div className="ee-table-sources">
        {rows.map((row,index)=><fieldset key={row.id}><legend>{index+1}. {row.type==="repeat"?"Filas de una lista":"Fila única"}</legend>
          <div className="ee-column-order"><button type="button" aria-label={`Subir grupo ${index+1}`} disabled={index===0} onClick={()=>moveGroup(index,-1)}>↑</button><button type="button" aria-label={`Bajar grupo ${index+1}`} disabled={index===rows.length-1} onClick={()=>moveGroup(index,1)}>↓</button><button type="button" aria-label={`Eliminar grupo ${index+1}`} onClick={()=>onPatch({rowGroups:rows.filter(item=>item.id!==row.id)})}>Eliminar fuente</button></div>
          {row.type==="repeat" && <ValueInput label={`Array de origen ${index+1}`} allowText={false} mode="dynamic" value={row.collection || ""} options={options.filter(option=>Array.isArray(resolveSample(option.value,tokens)))} onChange={value=>changeRow(row.id,{collection:singleVariable(value) || value})} placeholder="${products}"/>}
          <div className="ee-table-source-fields">{block.fields.map(field=><button type="button" className="ee-btn" key={field} onClick={()=>selectColumn(field)}>{block.columnLabels?.[field] || field} ← {row.cells[field]?.value || "Vacío"}</button>)}</div>
        </fieldset>)}
        <div className="ee-row2"><button type="button" className="ee-btn" onClick={()=>appendRow("repeat")}>＋ Filas de array</button><button type="button" className="ee-btn" onClick={()=>appendRow("single")}>＋ Fila única</button></div>
      </div>}
      {tab==="result" && generated.length>20 && <p className="ee-help-note">Se muestran las primeras 20 filas.</p>}
    </>}
  </section>;
}
