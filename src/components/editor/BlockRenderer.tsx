import { tableSampleRows, resolveCellTemplate } from "../../services/tableRows";
import { componentHtml, expandComponents, type EmailComponent } from "../../services/emailComponents";
import { buildSampleContext, renderThymeleaf } from "../../services/emailTemplateRenderer";
import React, { useEffect, useRef } from "react";
import { safeUrl, type EmailBlock, type InlineNode } from "../../services/emailBlocks";
import { markerFor } from "../../services/inlineTextModel";
import { resolveSample, formatSample } from "../../services/blockPreview";
import { sanitizeHtmlForDisplay, isInlineHtmlRoot } from "../../services/htmlSanitize";
import { useCanvasContext, type CanvasContextValue } from "../email-editor/canvasContext";
import type { EmailToken } from "../../services/emailTemplateRenderer";
import { armThresholdDrag } from "../email-editor/dragThreshold";

type Props = { blocks: EmailBlock[]; locals?: Record<string, unknown>; loopId?: string };

/** All canvas HTML uses the same component expansion, sample context and sanitizer. */
function renderPreviewHtml(
  source: string,
  tokens: EmailToken[],
  locals: Record<string, unknown>,
  components: EmailComponent[] = [],
): string {
  const expanded = expandComponents(source, components);
  const context = { ...buildSampleContext(tokens), ...locals };
  return sanitizeHtmlForDisplay(renderThymeleaf(expanded, context).html);
}


function useInlineEditable(node: HTMLElement | null, isEditing: boolean, onCommit: (html: string) => void) {
  const originalRef = useRef<string>("");
  useEffect(() => {
    if (!node || !isEditing) return;
    originalRef.current = node.innerHTML;
    node.contentEditable = "true";
    node.focus();
    const selection = window.getSelection();
    if (selection) { selection.selectAllChildren(node); selection.collapseToEnd(); }
    const finish = (save: boolean) => {
      node.contentEditable = "false";
      if (!save) node.innerHTML = originalRef.current;
      else if (node.innerHTML !== originalRef.current) onCommit(node.innerHTML);
      node.removeEventListener("blur", onBlur);
      node.removeEventListener("keydown", onKeyDown);
    };
    const onBlur = () => finish(true);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); finish(false); node.blur(); }
      else if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); node.blur(); }
    };
    node.addEventListener("blur", onBlur);
    node.addEventListener("keydown", onKeyDown);
    return () => { node.removeEventListener("blur", onBlur); node.removeEventListener("keydown", onKeyDown); };
  }, [node, isEditing]);
}

function Editable({ id, kind, tag, html, className, style, ctx, blockProps }: {
  id: string; kind: string; tag: "h1" | "h2" | "h3" | "p" | "span"; html: string; className?: string; style?: React.CSSProperties;
  ctx: ReturnType<typeof useCanvasContext>;
  blockProps?: React.HTMLAttributes<HTMLElement>;
}) {
  const [node, setNode] = React.useState<HTMLElement | null>(null);
  const isEditing = ctx.editingId === id;
  useInlineEditable(node, isEditing, nextHtml => ctx.onCommitEdit(id, kind, nextHtml));
  const frozenHtml = useRef(html);
  const wasEditing = useRef(isEditing);
  // Freeze the DOM-owned html while editing starts (so React never overwrites what the user is
  // typing), but still capture the edit-mode variant exactly once, at the start-editing transition.
  if (!isEditing || !wasEditing.current) frozenHtml.current = html;
  wasEditing.current = isEditing;
  const Tag = tag;
  return React.createElement(Tag, {
    ...blockProps,
    ref: setNode,
    className,
    style,
    suppressContentEditableWarning: true,
    onDoubleClick: (event: React.MouseEvent) => { event.stopPropagation(); if (!isEditing) ctx.onStartEdit(id); },
    dangerouslySetInnerHTML: { __html: frozenHtml.current },
  });
}

const escapeHtmlText = (value: string) => value.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));

function inlineNodeDisplay(node: InlineNode, tokens: ReturnType<typeof useCanvasContext>["tokens"], locals: Record<string, unknown>, key: number, editMode = false): string {
  if (node.type === "text") return escapeHtmlText(node.text);
  if (node.type === "variable") {
    // In edit mode, show the raw {{expr}} / {{= formula}} marker as plain editable text — not a
    // locked chip — so typing over it and committing re-parses it via parseInlineText, same as if
    // the user had typed the marker by hand. Outside edit mode, show the resolved sample value.
    if (editMode) return escapeHtmlText(markerFor(node.expression));
    const value = resolveSample(node.expression, tokens, locals);
    const shown = escapeHtmlText(value === undefined ? node.fallback : formatSample(value));
    return `<span data-ee-inline-expression="${escapeHtmlText(node.expression).replace(/"/g, "&quot;")}" contenteditable="false">${shown}</span>`;
  }
  // br is a void element: </br> is parsed as another line break by browsers.
  if (node.tag === "br") return "<br>";
  const inner = node.children.map((child, index) => inlineNodeDisplay(child, tokens, locals, index, editMode)).join("");
  const escapeAttr = (value: string) => safeUrl(value).replace(/"/g, "&quot;");
  const hrefExpression = node.href?.match(/^\$\{([^{}]+)\}$/)?.[1];
  const hrefValue = hrefExpression ? formatSample(resolveSample(hrefExpression, tokens, locals)) : node.href;
  const href = node.tag === "a" && hrefValue ? ` href="${escapeAttr(hrefValue)}"` : "";
  const css = Object.entries(node.styles ?? {}).filter(([, value]) => !/expression\s*\(|javascript:/i.test(value))
    .map(([property, value]) => `${property.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}:${value}`).join(";");
  const style = css ? ` style="${escapeHtmlText(css).replace(/"/g, "&quot;")}"` : "";
  return `<${node.tag}${href}${style}>${inner}</${node.tag}>`;
}

function blockStyle(block: EmailBlock): React.CSSProperties {
  return (block.styles ?? {}) as React.CSSProperties;
}

export default function BlockRenderer({ blocks, locals = {}, loopId }: Props) {
  return <>{blocks.map(block => <BlockNode key={block.id} block={block} locals={locals} loopId={loopId} />)}</>;
}

function resolveCollection(expression: string, tokens: EmailToken[], locals: Record<string, unknown>): unknown[] {
  const value = resolveSample(expression, tokens, locals);
  return Array.isArray(value) && value.length ? value : [undefined];
}

type CommonBlockProps = React.HTMLAttributes<HTMLElement> & { "data-ee-block-id": string; "data-ee-block-kind": string };

function BlockNode({ block, locals, loopId }: { block: EmailBlock; locals: Record<string, unknown>; loopId?: string }) {
  const ctx = useCanvasContext();
  const selected = ctx.selectedIds.has(block.id);
  const hovered = ctx.hoverId === block.id;
  const isDragSource = ctx.drag?.payload.type === "move" && ctx.drag.payload.id === block.id;

  const common: CommonBlockProps = {
    "data-ee-block-id": block.id,
    "data-ee-block-kind": block.type,
    className: `ee-block ${selected ? "ee-block-selected" : ""} ${hovered ? "ee-block-hovered" : ""}`.trim(),
    style: isDragSource ? { opacity: 0.4 } : undefined,
    onClick: (event: React.MouseEvent) => { event.stopPropagation(); ctx.onSelect(block.id, event.shiftKey); },
    onContextMenu: (event: React.MouseEvent) => { event.preventDefault(); event.stopPropagation(); ctx.onSelect(block.id, false); ctx.onContextMenu(block.id, event.clientX, event.clientY); },
    onMouseEnter: (event: React.MouseEvent) => { event.stopPropagation(); ctx.onHover(block.id); },
    onMouseLeave: () => ctx.onHover(null),
    onPointerDown: (event: React.PointerEvent) => {
      if ((event.target as HTMLElement).closest("[contenteditable='true'],[data-ee-table-resize]")) return;
      if (event.button !== 0) return;
      armThresholdDrag(event, (x, y) => ctx.onBeginDrag(block.id, x, y));
    },
  };

  return <BlockNodeBody block={block} locals={locals} loopId={loopId} common={common} ctx={ctx} />;
}

function BlockNodeBody({ block, locals, loopId, common: props, ctx }: {
  block: EmailBlock; locals: Record<string, unknown>; loopId?: string;
  common: CommonBlockProps; ctx: ReturnType<typeof useCanvasContext>;
}) {
  if (block.type === "component") {
    const definition=ctx.components?.find(item=>item.key===block.componentKey);
    const html = renderPreviewHtml(componentHtml(block, definition), ctx.tokens, locals, ctx.components);
    return <div {...props} className={`${props.className} ee-component-instance`} title={`Instancia de ${definition?.name??block.name}`}><span className="ee-component-tag">◇ {definition?.name??block.name}</span><div dangerouslySetInnerHTML={{__html:html}}/></div>;
  }

  if (block.type === "html") {
    const safeHtml = renderPreviewHtml(block.html, ctx.tokens, locals, ctx.components);
    return <div {...props} style={{ ...blockStyle(block), display: isInlineHtmlRoot(block.html) ? "inline" : undefined }}
      className={`${props.className} ee-block-protected-live`} title="HTML protegido · edítalo en modo Código"
      dangerouslySetInnerHTML={{ __html: safeHtml }} />;
  }
  if (block.type === "heading") {
    const level = block.level ?? 2;
    const html = escapeHtmlText(block.text);
    return <div {...props}>
      <Editable id={block.id} kind="heading" tag={`h${level}` as "h1" | "h2" | "h3"} html={html} style={blockStyle(block)} className={block.className} ctx={ctx} />
    </div>;
  }
  if (block.type === "paragraph") {
    const html = escapeHtmlText(block.text);
    return <div {...props}>
      <Editable id={block.id} kind="paragraph" tag="p" html={html} style={blockStyle(block)} className={block.className} ctx={ctx} />
    </div>;
  }
  if (block.type === "rich") {
    const editMode = ctx.editingId === block.id;
    const html = block.children.map((node, index) => inlineNodeDisplay(node, ctx.tokens, locals, index, editMode)).join("");
    return <Editable id={block.id} kind="rich" tag={block.tag} html={html} style={blockStyle(block)} className={props.className} ctx={ctx} blockProps={props} />;
  }
  if (block.type === "variable") {
    return <VariableBlockNode block={block} locals={locals} props={props} ctx={ctx} />;
  }
  if (block.type === "button") {
    const text = block.textExpression ? formatSample(resolveSample(block.textExpression, ctx.tokens, locals)) || block.text : resolveCellTemplate(block.text,ctx.tokens,locals);
    return <a {...props} className={`${props.className} ee-render-button`} href="#button"
      onClick={event => { event.preventDefault(); props.onClick?.(event); }}
      style={{ display: "inline-block", padding: "12px 22px", background: "#315ee8", borderRadius: 6, color: "#fff", textDecoration: "none", fontWeight: 600, ...blockStyle(block) }}>{text}</a>;
  }
  if (block.type === "image") {
    const src=block.srcMode !== "text" ? resolveCellTemplate(block.src,ctx.tokens,locals) : block.src;
    const looksReal = /^https?:\/\//.test(src);
    return looksReal
      ? <img {...props} src={src} alt={block.alt} style={{ maxWidth: "100%", width: block.width ? `${block.width}px` : undefined, ...blockStyle(block) }} draggable={false} />
      : <div {...props} className={`${props.className} ee-render-image-missing`} style={blockStyle(block)}><span>▧</span>{block.alt || "Imagen"}</div>;
  }
  if (block.type === "divider") {
    return <hr {...props} style={{ border: 0, borderTop: `1px solid ${block.color}`, margin: "12px 0", ...blockStyle(block) }} />;
  }
  if (block.type === "spacer") {
    const height = Math.max(4, Math.min(Number(block.height) || 0, 400));
    return <div {...props} style={{ ...blockStyle(block), height }} className={`${props.className} ee-render-spacer`}>{height}px</div>;
  }
  if (block.type === "table") {
    return <TableBlockNode block={block} locals={locals} props={props} ctx={ctx} />;
  }
  if (block.type === "container") {
    const empty = block.children.length === 0;
    return <div {...props} style={{ ...blockStyle(block), display: blockStyle(block).display ?? "block" }} className={`${props.className} ee-render-container ${empty ? "ee-empty-container" : ""}`}>
      <span className="ee-container-label">div</span>
      {empty ? <span style={{ fontSize: 10, color: "#9098a8" }}>Contenedor vacío · arrastra bloques aquí</span> : <BlockRenderer blocks={block.children} locals={locals} loopId={loopId} />}
    </div>;
  }
  if (block.type === "loop") {
    const isTableLoop = block.children.length === 1 && block.children[0].type === "table";
    const items = isTableLoop ? [undefined] : resolveCollection(block.collection, ctx.tokens, locals);
    const collectionName = block.collection.split(".").pop();
    const realCount = resolveCollection(block.collection, ctx.tokens, locals).length;
    return <div {...props} className={`${props.className} ee-scope-loop`}>
      <span className="ee-scope-tag loop" title={`Se repite por cada elemento de ${block.collection}`}>⟳ {collectionName}{realCount > 1 ? ` ×${realCount}` : ""}</span>
      {items.map((item, index) => <div key={index} className={`ee-loop-iteration ${index > 0 ? "echo" : ""}`} style={blockStyle(block)}>
        {index === 0
          ? <BlockRenderer blocks={block.children} locals={{ ...locals, item }} loopId={block.id} />
          : <StaticBlockRenderer blocks={block.children} locals={{ ...locals, item }} tokens={ctx.tokens} />}
      </div>)}
    </div>;
  }
  if (block.type === "if") {
    const value = resolveSample(block.variable, ctx.tokens, locals);
    const visible = block.operator === "hasValue" ? value !== undefined && value !== null && value !== ""
      : block.operator === "equals" ? String(value) === block.expected : String(value) !== block.expected;
    return <div {...props} style={blockStyle(block)} className={`${props.className} ee-scope-if ${visible ? "" : "ee-condition-hidden"}`}>
      <span className={`ee-scope-tag cond ${visible ? "" : "hidden"}`} title={visible ? "Condición cumplida con los datos de muestra" : "Oculto con los datos de muestra — el contenido sigue aquí para poder editarlo"}>
        {visible ? "◇ si" : "◇ si no"}
      </span>
      <BlockRenderer blocks={block.children} locals={locals} loopId={loopId} />
    </div>;
  }
  return null;
}

/** Non-interactive visual echo of a block subtree — used for loop iterations after the first, so repeated
 * content looks right without duplicating a selectable/editable block id into the DOM. */
function StaticBlockRenderer({ blocks, locals, tokens }: { blocks: EmailBlock[]; locals: Record<string, unknown>; tokens: EmailToken[] }) {
  return <>{blocks.map(block => <StaticBlock key={block.id} block={block} locals={locals} tokens={tokens} />)}</>;
}

function StaticBlock({ block, locals, tokens }: { block: EmailBlock; locals: Record<string, unknown>; tokens: EmailToken[] }) {
  const ctx=useCanvasContext();
  const style = blockStyle(block);
  if(block.type === "component") return <div style={style} dangerouslySetInnerHTML={{__html:renderPreviewHtml(componentHtml(block), tokens, locals, ctx.components)}}/>;
  if (block.type === "html") {
    const safeHtml = renderPreviewHtml(block.html, ctx.tokens, locals, ctx.components);
    return <div style={{ ...style, display: isInlineHtmlRoot(block.html) ? "inline" : undefined }} dangerouslySetInnerHTML={{ __html: safeHtml }} />;
  }
  if (block.type === "heading") {
    const Tag = `h${block.level ?? 2}` as "h1" | "h2" | "h3";
    return <div style={style}><Tag>{block.text}</Tag></div>;
  }
  if (block.type === "paragraph") return <div style={style}><p>{block.text}</p></div>;
  if (block.type === "rich") {
    const html = block.children.map((node, index) => inlineNodeDisplay(node, tokens, locals, index)).join("");
    const Tag = block.tag;
    return <Tag style={style} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  if (block.type === "variable") {
    const value = resolveSample(block.expression, tokens, locals);
    return <div style={style}><span className="ee-render-variable">ƒ {value === undefined ? block.expression : formatSample(value)}</span></div>;
  }
  if (block.type === "button") {
    const text = block.textExpression ? formatSample(resolveSample(block.textExpression, tokens, locals)) || block.text : block.text;
    return <div style={{ ...style, padding: "4px 0" }}><span className="ee-render-button">{text}</span></div>;
  }
  if (block.type === "image") {
    const looksReal = /^https?:\/\//.test(block.src);
    return <div style={style}>{looksReal
      ? <img src={block.src} alt={block.alt} style={{ maxWidth: "100%", width: block.width ? `${block.width}px` : undefined }} draggable={false} />
      : <div className="ee-render-image-missing"><span>▧</span>{block.alt || "Imagen"}</div>}</div>;
  }
  if (block.type === "divider") return <div style={style}><hr style={{ border: 0, borderTop: `1px solid ${block.color}`, margin: "12px 0" }} /></div>;
  if (block.type === "spacer") {
    const height = Math.max(4, Math.min(Number(block.height) || 0, 400));
    return <div style={{ ...style, height }} className="ee-render-spacer">{height}px</div>;
  }
  if (block.type === "table") {
    const rows = tableSampleRows(block, tokens, locals);
    return <div style={{ ...style, width: block.width ?? "100%" }}>
      <table className="ee-render-table" style={{ borderCollapse: "collapse" }}>
        {block.header && <thead><tr>{block.fields.map(field => <th key={field} align={block.columnAlignments?.[field] ?? "left"} style={{ padding: block.cellPadding ?? "8px", border: `${block.borderWidth ?? "1px"} solid ${block.borderColor ?? "#e2e8f0"}`, background: block.headerBackground ?? "#f1f5f9", color: block.headerColor ?? "#334155", width: block.columnWidths?.[field] }}>{block.columnLabels?.[field] || field.split(".").pop()}</th>)}</tr></thead>}
        <tbody>{rows.map((item, rowIndex) => <tr key={rowIndex}>{block.fields.map(field => {
          const value = item.values[field];
          return <td key={field} align={block.columnAlignments?.[field] ?? "left"} style={{ padding: block.cellPadding ?? "8px", border: `${block.borderWidth ?? "1px"} solid ${block.borderColor ?? "#e2e8f0"}`, width: block.columnWidths?.[field] }}>{value === undefined ? field : formatSample(value)}</td>;
        })}</tr>)}</tbody>
      </table>
    </div>;
  }
  if (block.type === "container") return <div style={style}><StaticBlockRenderer blocks={block.children} locals={locals} tokens={tokens} /></div>;
  if (block.type === "loop") {
    const isTableLoop = block.children.length === 1 && block.children[0].type === "table";
    const items = isTableLoop ? [undefined] : resolveCollection(block.collection, tokens, locals);
    return <div>{items.map((item, index) => <div key={index} style={style}><StaticBlockRenderer blocks={block.children} locals={{ ...locals, item }} tokens={tokens} /></div>)}</div>;
  }
  if (block.type === "if") {
    const value = resolveSample(block.variable, tokens, locals);
    const visible = block.operator === "hasValue" ? value !== undefined && value !== null && value !== ""
      : block.operator === "equals" ? String(value) === block.expected : String(value) !== block.expected;
    return visible ? <div style={style}><StaticBlockRenderer blocks={block.children} locals={locals} tokens={tokens} /></div> : null;
  }
  return null;
}

function VariableBlockNode({ block, locals, props, ctx }: {
  block: Extract<EmailBlock, { type: "variable" }>; locals: Record<string, unknown>;
  props: CommonBlockProps; ctx: ReturnType<typeof useCanvasContext>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const value = resolveSample(block.expression, ctx.tokens, locals);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== block.expression) ctx.onEditVariableExpression(block.id, next);
  };

  return <div {...props} style={blockStyle(block)}
    onDoubleClick={event => { event.stopPropagation(); if (!editing) { setDraft(block.expression); setEditing(true); } }}>
    {editing
      ? <input autoFocus value={draft} onChange={event => setDraft(event.target.value)} onClick={event => event.stopPropagation()}
        onBlur={commit} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); commit(); } if (event.key === "Escape") setEditing(false); }}
        placeholder="nombre o item.campo o fórmula" title="Expresión Thymeleaf — admite rutas (item.name) y fórmulas (item.qty * item.price)"
        style={{ font: "inherit", color: "#4b4bc9", border: "1px solid #6c6cf5", borderRadius: 3, padding: "1px 5px", minWidth: 160 }} />
      : <span className="ee-render-variable" title="Doble clic para editar la expresión">ƒ {value === undefined ? block.expression : formatSample(value)}<small>${"{" + block.expression + "}"}</small></span>}
  </div>;
}

function TableHeaderCell({ block, field, selected, ctx }: {
  block: Extract<EmailBlock, { type: "table" }>; field: string; selected: boolean; ctx: ReturnType<typeof useCanvasContext>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const label = block.columnLabels?.[field] || field.split(".").pop() || field;

  const commit = () => {
    setEditing(false);
    const value = draft.trim();
    if (value && value !== label) ctx.onTableColumnLabelChange(block.id, field, value);
  };
  const startResize = (event: React.PointerEvent<HTMLSpanElement>) => {
    event.preventDefault(); event.stopPropagation();
    const th = event.currentTarget.parentElement as HTMLElement;
    const startX = event.clientX, startWidth = th.getBoundingClientRect().width;
    event.currentTarget.setPointerCapture(event.pointerId);
    const move = (moveEvent: PointerEvent) => {
      const width = Math.max(40, startWidth + moveEvent.clientX - startX);
      th.style.width = `${Math.round(width)}px`;
    };
    const finish = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      const width = Math.max(40, startWidth + upEvent.clientX - startX);
      ctx.onTableColumnWidthChange(block.id, field, `${Math.round(width)}px`);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  };

  return <th align={block.columnAlignments?.[field] ?? "left"} style={{
    position: "relative", padding: block.cellPadding ?? "8px", border: `${block.borderWidth ?? "1px"} solid ${block.borderColor ?? "#e2e8f0"}`,
    background: selected ? "#ecebff" : block.headerBackground ?? "#f1f5f9", color: block.headerColor ?? "#334155",
    outline: selected ? "2px solid #6c6cf5" : undefined, outlineOffset: selected ? "-2px" : undefined,
    cursor: editing ? "text" : "cell", width: block.columnWidths?.[field],
  }}
    onClick={event => { event.stopPropagation(); if (editing) return; ctx.onSelect(block.id, false); ctx.onTableCellSelect(block.id, [field], event.shiftKey); }}
    onDoubleClick={event => { event.stopPropagation(); setDraft(label); setEditing(true); }}>
    {editing
      ? <input autoFocus value={draft} onChange={event => setDraft(event.target.value)} onClick={event => event.stopPropagation()}
        onBlur={commit} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); commit(); } if (event.key === "Escape") setEditing(false); }}
        style={{ width: "100%", border: "1px solid #6c6cf5", borderRadius: 3, padding: "2px 4px", font: "inherit", color: "inherit", background: "#fff" }} />
      : label}
    <span onPointerDown={startResize} title="Arrastra para cambiar el ancho de la columna"
      style={{ position: "absolute", top: 0, right: -3, bottom: 0, width: 6, cursor: "col-resize" }} />
  </th>;
}

function TableBlockNode({ block, locals, props, ctx }: {
  block: Extract<EmailBlock, { type: "table" }>; locals: Record<string, unknown>;
  props: React.HTMLAttributes<HTMLElement> & { "data-ee-block-id": string };
  ctx: ReturnType<typeof useCanvasContext>;
}) {
  const rows = tableSampleRows(block, ctx.tokens, locals);
  const selectedFields = ctx.tableSelection?.id === block.id ? ctx.tableSelection.fields : [];
  const startResize = (event: React.PointerEvent<HTMLSpanElement>) => {
    event.preventDefault(); event.stopPropagation();
    const shell = (event.currentTarget.closest("[data-ee-table-shell]") as HTMLElement) ?? event.currentTarget.parentElement!;
    const startX = event.clientX, startWidth = shell.getBoundingClientRect().width;
    event.currentTarget.setPointerCapture(event.pointerId);
    const move = (moveEvent: PointerEvent) => {
      const width = Math.max(160, Math.min(600, startWidth + moveEvent.clientX - startX));
      shell.style.width = `${Math.round(width)}px`;
    };
    const finish = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      const width = Math.max(160, Math.min(600, startWidth + upEvent.clientX - startX));
      ctx.onTableWidthChange(block.id, `${Math.round(width)}px`);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  };
  return <div {...props} data-ee-table-shell={block.id} style={{ ...blockStyle(block), width: block.width ?? "100%", position: "relative" }}>
    <table className="ee-render-table" style={{ borderCollapse: "collapse" }}>
      {block.header && <thead><tr>{block.fields.map(field =>
        <TableHeaderCell key={field} block={block} field={field} selected={selectedFields.includes(field)} ctx={ctx} />
      )}</tr></thead>}
      <tbody>
        {rows.map((item, rowIndex) => <tr key={rowIndex}>{block.fields.map(field => {
          const value = item.values[field];
          return <td key={field} align={block.columnAlignments?.[field] ?? "left"} style={{ padding: block.cellPadding ?? "8px", border: `${block.borderWidth ?? "1px"} solid ${block.borderColor ?? "#e2e8f0"}`, width: block.columnWidths?.[field] }}>
            {value === undefined ? field : formatSample(value)}
          </td>;
        })}</tr>)}
      </tbody>
    </table>
    <span className="ee-table-resize-handle" data-ee-table-resize onPointerDown={startResize} title="Arrastra para cambiar el ancho" />
  </div>;
}
