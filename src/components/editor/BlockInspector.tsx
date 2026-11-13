import ValueInput from "./ValueInput";
import { singleVariable } from "../../services/valueSyntax";
import { useMemo, useRef, useState } from "react";
import type React from "react";
import type { EmailBlock } from "../../services/emailBlocks";
import { inlineTextOf, markerFor, parseInlineText, removeInlineRange, insertInlineVariable } from "../../services/inlineTextModel";
import type { EmailToken } from "../../services/emailTemplateRenderer";
import InlineSyntaxEditor from "./InlineSyntaxEditor";
import TableInspector from "./TableInspector";
import FlexLayoutInspector from "./FlexLayoutInspector";
import { getSampleObjectPaths } from "../../services/emailBlockActions";
import type { EmailComponent } from "../../services/emailComponents";
import ComponentInspector from "./ComponentInspector";
import { ColorInput, LengthInput } from "./StyleInputs";

type Props = {
  style?: React.CSSProperties;
  block?: EmailBlock; multiCount?: number; tokens: EmailToken[]; loopCollection?: string;
  components?: EmailComponent[];
  onPatch: (id: string, patch: Partial<EmailBlock>) => void; onInsertVariable: (expression: string) => void; selectedTableField?: string;
};

const typeTitle: Record<EmailBlock["type"], string> = {
  component:"Instancia de componente",
  html: "HTML protegido", heading: "Título", paragraph: "Texto", rich: "Texto enriquecido", variable: "Dato",
  button: "Botón", image: "Imagen", divider: "Separador", spacer: "Espaciador", table: "Tabla",
  container: "Contenedor", loop: "Bucle", if: "Condición",
};

export default function BlockInspector({ style, block, multiCount, tokens, loopCollection, components = [], onPatch, onInsertVariable, selectedTableField }: Props) {
  const [inspectorView,setInspectorView]=useState<{id:string;tab:"content"|"design"|"advanced"}>({id:"",tab:"content"});
  const tab=inspectorView.id===block?.id?inspectorView.tab:"content";
  const [expression, setExpression] = useState(tokens[0]?.varName ?? "nombre");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef<[number, number]>([0, 0]);
  const arrays = tokens.filter(token => Array.isArray(token.sample));
  const varOptions = useMemo(() => tokens.flatMap(token => [
    { value: token.varName, label: `${token.label} · ${token.varName}` },
    ...(Array.isArray(token.sample) ? [] : getSampleObjectPaths(token.sample).map(path => ({ value: `${token.varName}.${path}`, label: `${token.label} · ${path}` }))),
  ]).concat(loopCollection ? [
    { value: "item", label: "Elemento actual · item" },
    ...getSampleObjectPaths(tokens.find(token => token.varName === loopCollection)?.sample).map(path => ({ value: `item.${path}`, label: `Elemento actual · ${path}` })),
  ] : []), [tokens, loopCollection]);

  const patch = (value: Partial<EmailBlock>) => block && onPatch(block.id, value);
  const changeText = (value: string) => {
    if (!block) return;
    if (block.type === "rich") patch({ children: parseInlineText(value) });
    if (block.type === "paragraph") patch(value.includes("${") ? {type:"rich",tag:"p",children:parseInlineText(value)} : {text:value});
    if (block.type === "heading") patch(value.includes("${") ? {type:"rich",tag:`h${block.level??2}` as "h1"|"h2"|"h3",children:parseInlineText(value)} : {text:value});
    if (block.type === "button") patch({ text: value });
  };
  const textValue = block?.type === "rich" ? inlineTextOf(block.children) : block && "text" in block ? block.text : "";
  const insertAtCursor = () => {
    if (!block) return;
    if (block.type !== "rich") { onInsertVariable(expression); return; }
    const [start, end] = selectionRef.current;
    const marker = markerFor(expression);
    const remaining = start === end ? block.children : removeInlineRange(block.children, start, end);
    patch({ children: insertInlineVariable(remaining, start, { type: "variable", expression, fallback: expression }) });
    requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.setSelectionRange(start + marker.length, start + marker.length); });
  };

  if (multiCount && multiCount > 1) return <aside className="ee-inspector" style={style} aria-label="Inspector de propiedades">
    <div className="ee-inspector-top"><strong>{multiCount} bloques seleccionados</strong></div>
    <div className="ee-inspector-empty"><span>◈</span><p>Usa Supr para eliminarlos o el menú contextual para duplicar uno a la vez.</p></div>
  </aside>;

  if (!block) return <aside className="ee-inspector" style={style} aria-label="Inspector de propiedades">
    <div className="ee-inspector-top"><span className="ee-eyebrow">INSPECTOR</span></div>
    <div className="ee-inspector-empty"><span>◈</span><strong>Selecciona un bloque</strong><p>Elige una pieza del lienzo o de las capas para editar su contenido y apariencia.</p></div>
  </aside>;

  return <aside className="ee-inspector" style={style} aria-label="Inspector de propiedades">
    <div className="ee-inspector-top"><span className="ee-eyebrow">{typeTitle[block.type].toUpperCase()}</span><small>{block.id}</small></div>
    <div className="ee-inspector-tabs" role="tablist" aria-label="Propiedades del bloque">{([["content","Contenido"],["design","Diseño"],["advanced","Avanzado"]] as const).map(([value,label])=><button role="tab" key={value} aria-selected={tab===value} onClick={()=>setInspectorView({id:block.id,tab:value})}>{label}</button>)}</div>
    <div className="ee-inspector-scroll">
      <details className="ee-inspector-section" open hidden={tab !== "content" || block.type === "table"}>
        <summary>Contenido y datos</summary>
        <div className="ee-inspector-section-body">
          {block.type === "html" && <p className="ee-help-note">Este fragmento se conserva como HTML. Cambia a Código para editarlo.</p>}
          {block.type === "component" && <ComponentInspector block={block} components={components} options={varOptions} onPatch={patch} />}
          {(block.type === "heading" || block.type === "paragraph" || block.type === "rich" || block.type === "button") && <>
            <label className="ee-field"><span>{block.type === "button" ? "Texto del botón" : "Texto"}</span>
              <InlineSyntaxEditor ref={inputRef} value={textValue} options={varOptions} onChange={changeText}
                onSelect={event => { selectionRef.current = [event.currentTarget.selectionStart, event.currentTarget.selectionEnd]; }} />
            </label>
            {block.type === "rich" && <p className="ee-help-note">Variables: <code>{"${nombre}"}</code> · cálculos: <code>{"${item.quantity * item.price}"}</code></p>}
            {block.type === "heading" && <label className="ee-field"><span>Nivel</span>
              <select className="ee-select" value={block.level ?? 2} onChange={event => patch({ level: Number(event.target.value) as 1 | 2 | 3 })}>
                <option value={1}>Título principal · H1</option><option value={2}>Sección · H2</option><option value={3}>Subtítulo · H3</option>
              </select>
            </label>}
            <div className="ee-variable-insert">
              <div className="ee-field"><span>Conectar variable</span>
                <ValueInput allowText={false} label="Variable a insertar" value={expression} mode="dynamic" options={varOptions} onChange={value=>setExpression(singleVariable(value)??value)}/></div>
              <button className="ee-btn" onClick={insertAtCursor}>＋ Insertar en texto</button>
            </div>
          </>}
          {block.type === "variable" && <div className="ee-field"><span>Expresión</span>
            <ValueInput allowText={false} label="Expresión" value={block.expression} mode="dynamic" options={varOptions} onChange={value=>patch({expression:singleVariable(value)??value})}/></div>}
          {block.type === "button" && <div className="ee-field"><span>Enlace</span>
            <ValueInput label="Enlace del botón" value={block.href} mode={block.hrefMode??(block.href.includes("${")?"dynamic":"text")} options={varOptions} onChange={(value,mode)=>patch({href:value,hrefMode:mode})}/></div>}
          {block.type === "button" && block.textExpression && <div className="ee-dynamic-badge"><span>ƒ</span>Texto conectado a {block.textExpression}
            <button className="ee-btn" onClick={() => patch({ textExpression: undefined })}>Usar fijo</button>
          </div>}
          {block.type === "image" && <>
            <div className="ee-field"><span>URL de imagen</span><ValueInput label="URL de imagen" value={block.src} mode={block.srcMode??(block.src.includes("${")?"dynamic":"text")} options={varOptions} onChange={(value,mode)=>patch({src:value,srcMode:mode})}/></div>
            <label className="ee-field"><span>Texto alternativo</span><input className="ee-input" value={block.alt} onChange={event => patch({ alt: event.target.value })} /></label>
            <label className="ee-field"><span>Ancho (px)</span><input className="ee-input" type="number" value={block.width} onChange={event => patch({ width: event.target.value })} /></label>
          </>}
          {block.type === "spacer" && <label className="ee-field"><span>Alto (px)</span><input className="ee-input" type="number" value={block.height} onChange={event => patch({ height: event.target.value })} /></label>}
          {block.type === "divider" && <label className="ee-field"><span>Color</span><input className="ee-input" type="color" value={block.color} onChange={event => patch({ color: event.target.value })} /></label>}
          {block.type === "loop" && <div className="ee-field"><span>Lista</span>
            <ValueInput allowText={false} label="Lista de repetición" value={block.collection} mode="dynamic" options={arrays.map(token=>({value:token.varName,label:token.label}))} onChange={value=>patch({collection:singleVariable(value)??value})}/></div>}
          {block.type === "if" && <>
            <div className="ee-field"><span>Variable</span>
              <ValueInput allowText={false} label="Variable de condición" value={block.variable} mode="dynamic" options={varOptions} onChange={value=>patch({variable:singleVariable(value)??value})}/></div>
            <label className="ee-field"><span>Condición</span>
              <select className="ee-select" value={block.operator} onChange={event => patch({ operator: event.target.value as typeof block.operator })}>
                <option value="hasValue">Tiene valor</option><option value="equals">Es igual a</option><option value="different">Es distinto de</option>
              </select>
            </label>
            {block.operator !== "hasValue" && <label className="ee-field"><span>Valor</span><input className="ee-input" value={block.expected} onChange={event => patch({ expected: event.target.value })} /></label>}
          </>}

        </div>
      </details>

      {block.type === "table" && tab !== "advanced" && <TableInspector key={block.id} block={block} onPatch={patch} tokens={tokens} mode={tab === "design" ? "design" : "content"} selectedField={selectedTableField} /> }
      {(block.type === "container" || block.type === "loop") && tab === "design" && <FlexLayoutInspector styles={block.styles ?? {}} onChange={styles => onPatch(block.id, { styles })} />}

      <details className="ee-inspector-section" open hidden={tab !== "design"}>
        <summary>Apariencia</summary>
        <div className="ee-inspector-section-body">

          <div className="ee-row2">
            <div className="ee-field"><span>Texto</span><ColorInput label="Color del texto" value={block.styles?.color ?? ""} onChange={color => patch({ styles: { ...block.styles, color } })} placeholder="#172033" /></div>
            <div className="ee-field"><span>Fondo</span><ColorInput label="Color del fondo" value={block.styles?.backgroundColor ?? ""} onChange={backgroundColor => patch({ styles: { ...block.styles, backgroundColor } })} /></div>
            <LengthInput label="Tamaño del texto" value={block.styles?.fontSize ?? ""} onChange={fontSize => patch({ styles: { ...block.styles, fontSize } })} placeholder="16px" />
            <LengthInput label="Espaciado interior" value={block.styles?.padding ?? ""} onChange={padding => patch({ styles: { ...block.styles, padding } })} />
            <LengthInput label="Radio de las esquinas" value={block.styles?.borderRadius ?? ""} onChange={borderRadius => patch({ styles: { ...block.styles, borderRadius } })} placeholder="8px" />
            <LengthInput label="Ancho máximo" value={block.styles?.maxWidth ?? ""} onChange={maxWidth => patch({ styles: { ...block.styles, maxWidth } })} placeholder="600px" />
          </div>
          <div className="ee-field"><span>Alineación</span>
            <div className="ee-alignment-control" role="group" aria-label="Alineación del texto">
              {([["left", "⇤", "Izquierda"], ["center", "↔", "Centrar"], ["right", "⇥", "Derecha"]] as const).map(([value, icon, name]) =>
                <button key={value} className={block.styles?.textAlign === value ? "selected" : ""} aria-label={name} aria-pressed={block.styles?.textAlign === value}
                  type="button" title={name} onClick={() => onPatch(block.id, { styles: { ...block.styles, textAlign: value } })}><span aria-hidden="true">{icon}</span><span>{name}</span></button>)}
            </div>
          </div>

        </div>
      </details>

      <details className="ee-inspector-section" hidden={tab !== "advanced"}>
        <summary>Atributos HTML</summary>
        <div className="ee-inspector-section-body">
          {Object.entries(block.attributes ?? {}).map(([name, value]) => <div className="ee-attribute-row" key={name}>
            <input className="ee-input" aria-label="Nombre del atributo" value={name} onChange={event => {
              const attributes = { ...block.attributes }; delete attributes[name]; if (event.target.value) attributes[event.target.value] = value; patch({ attributes });
            }} />
            <input className="ee-input" aria-label="Valor del atributo" value={value} onChange={event => patch({ attributes: { ...block.attributes, [name]: event.target.value } })} />
            <button aria-label="Eliminar atributo" onClick={() => { const attributes = { ...block.attributes }; delete attributes[name]; patch({ attributes }); }}>×</button>
          </div>)}
          <button className="ee-btn" onClick={() => patch({ attributes: { ...block.attributes, "data-custom": "" } })}>＋ Añadir atributo</button>
        </div>
      </details>
      <details className="ee-inspector-section" open hidden={tab !== "advanced"}>
        <summary>Clases y estilos CSS</summary>
        <div className="ee-inspector-section-body">
          <label className="ee-field"><span>Clase CSS</span><input className="ee-input" value={block.className ?? ""} onChange={event => patch({ className: event.target.value })} /></label>
          <label className="ee-field"><span>CSS en línea</span>
            <textarea className="ee-textarea" value={Object.entries(block.styles ?? {}).map(([name, value]) => `${name.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}: ${value}`).join(";\n")}
              onChange={event => onPatch(block.id, { styles: Object.fromEntries(event.target.value.split(";").flatMap(row => {
                const colon = row.indexOf(":"); if (colon < 1) return [];
                const key = row.slice(0, colon).trim(); const value = row.slice(colon + 1).trim();
                return /^[\w-]+$/.test(key) && !/[{}<>]/.test(value) ? [[key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), value]] : [];
              })) })} placeholder="border-radius: 8px" />
          </label>
          <label className="ee-field"><span>CSS de clase</span>
            <textarea className="ee-textarea" value={Object.entries(block.classStyles ?? {}).map(([name, value]) => `${name.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}: ${value}`).join(";\n")}
              onChange={event => patch({ classStyles: Object.fromEntries(event.target.value.split(";").flatMap(row => {
                const colon = row.indexOf(":"); if (colon < 1) return [];
                const key = row.slice(0, colon).trim(); const value = row.slice(colon + 1).trim();
                return /^[\w-]+$/.test(key) && !/[{}<>]/.test(value) ? [[key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), value]] : [];
              })) })} placeholder=".mi-bloque { ... }" />
          </label>
          <p className="ee-help-note">Atributos de evento y directivas Thymeleaf se mantienen fuera del inspector.</p>
        </div>
      </details>
    </div>
  </aside>;
}
