import { normalizeTemplateMarkup } from "./templateMarkup";
import type { EmailToken } from "./emailTemplateRenderer";
import { tableRowGroups, columnExpression } from "./tableRows";
import { componentHtml, readComponent, type ComponentInstance, type EmailComponent } from "./emailComponents";
import { templateExpression } from "./valueSyntax";

export type TableCell = { mode: "text" | "expression" | "template"; value: string };
export type TableRowGroup = { id: string; type: "repeat" | "single"; collection?: string; cells: Record<string, TableCell> };
export type TableColumnFormat = { type: "text" | "number" | "currency"; decimals?: number; prefix?: string; suffix?: string };

type BlockBase = { id: string; className?: string; styles?: Record<string, string>; classStyles?: Record<string, string>; attributes?: Record<string, string> };
export type InlineNode =
  | { type: "text"; text: string }
  | { type: "variable"; expression: string; fallback: string }
  | { type: "element"; tag: "strong" | "b" | "em" | "i" | "u" | "a" | "span" | "small" | "sup" | "sub" | "br"; children: InlineNode[]; href?: string; styles?: Record<string, string> };
export type EmailBlock =
  | (BlockBase & ComponentInstance & { type: "component" })
  | (BlockBase & { type: "html"; html: string })
  | (BlockBase & { type: "heading"; text: string; level?: 1 | 2 | 3 })
  | (BlockBase & { type: "paragraph"; text: string })
  | (BlockBase & { type: "rich"; tag: "p" | "h1" | "h2" | "h3" | "span"; children: InlineNode[] })
  | (BlockBase & { type: "variable"; expression: string })
  | (BlockBase & { type: "button"; text: string; href: string; hrefMode?: "text"|"dynamic"; textExpression?: string })
  | (BlockBase & { type: "image"; src: string; srcMode?: "text"|"dynamic"; alt: string; width: string })
  | (BlockBase & { type: "divider"; color: string })
  | (BlockBase & { type: "spacer"; height: string })
  | (BlockBase & {
    type: "table"; collection: string; fields: string[];
    width?: string; header?: boolean; headerBackground?: string; headerColor?: string;
    borderColor?: string; borderWidth?: string; cellPadding?: string; striped?: boolean; stripeColor?: string;
    columnLabels?: Record<string, string>; columnAlignments?: Record<string, "left" | "center" | "right">;
    columnWidths?: Record<string, string>;
    mergedColumns?: string[][];
    rowGroups?: TableRowGroup[];
    columnFormats?: Record<string, TableColumnFormat>;
  })
  | (BlockBase & { type: "container"; children: EmailBlock[] })
  | (BlockBase & { type: "loop"; collection: string; children: EmailBlock[] })
  | (BlockBase & { type: "if"; variable: string; operator: "hasValue" | "equals" | "different"; expected: string; children: EmailBlock[] });

export type BlockKind = Exclude<EmailBlock["type"], "html">;

function isContainer(block: EmailBlock): block is Extract<EmailBlock, { type: "container" | "loop" | "if" }> {
  return block.type === "container" || block.type === "loop" || block.type === "if";
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!)
);

const safeExpression = (value: string) => /^[\w$]+(?:\.[\w$]+)*$/.test(value);
export const isSafeInlineExpression = (value: string) => {
  const source = value.trim();
  if (!source || !/^[\w$().+\-*/%\s]+$/.test(source)) return false;
  const tokens = source.match(/[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*|\d+(?:\.\d+)?|[()+\-*/%]/g) ?? [];
  if (tokens.join("").replace(/[()+\-*/%]/g, "") !== source.replace(/\s/g, "").replace(/[()+\-*/%]/g, "")) return false;
  let cursor = 0;
  const primary = (): boolean => {
    if (tokens[cursor] === "(" ) { cursor++; if (!additive() || tokens[cursor++] !== ")") return false; return true; }
    const token = tokens[cursor++]; return !!token && (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(token) || /^\d+(?:\.\d+)?$/.test(token));
  };
  const unary = (): boolean => { if (tokens[cursor] === "+" || tokens[cursor] === "-") cursor++; return primary(); };
  const multiplicative = (): boolean => { if (!unary()) return false; while (["*", "/", "%"].includes(tokens[cursor])) { cursor++; if (!unary()) return false; } return true; };
  const additive = (): boolean => { if (!multiplicative()) return false; while (["+", "-"].includes(tokens[cursor])) { cursor++; if (!multiplicative()) return false; } return true; };
  return additive() && cursor === tokens.length;
};
export const safeUrl = (value: string) => /^\s*(?:javascript|data|vbscript):/i.test(value) ? "#" : value;

/** Block types positioned as a whole box among siblings — alignment moves the box (margin), not its text.
 * Buttons use `display:table` (the email-safe way to centre a shrink-to-fit element) instead of `block`,
 * which would stretch them to the container's full width. */
export const positionAlignedBlockTypes = ["image", "button", "table", "divider", "component", "container", "if"] as const;
export function positionAlignStyles(position: "left" | "center" | "right", blockType: string, currentDisplay?: string): Record<string, string> {
  return {
    display: currentDisplay === "flex" || currentDisplay === "grid" ? currentDisplay : blockType === "button" ? "table" : "block",
    marginLeft: position === "left" ? "0" : "auto",
    marginRight: position === "right" ? "0" : "auto",
  };
}

const firstArray = (tokens: EmailToken[]) =>
  tokens.find(token => Array.isArray(token.sample) && /^[\w$]+$/.test(token.varName))?.varName ?? "items";

const firstVariable = (tokens: EmailToken[]) =>
  tokens.find(token => /^[\w$]+$/.test(token.varName))?.varName ?? "nombre";

const baseBlock = (id: string, type: BlockKind): BlockBase => ({
  id,
  className: `email-${type}-${id.replace(/[^\w-]/g, "")}`,
  styles: {},
  classStyles: {},
  attributes: {},
});

export function createEmailBlock(type: BlockKind, tokens: EmailToken[], id: string): EmailBlock {
  const variable = firstVariable(tokens);
  const base = baseBlock(id, type);
  switch (type) {
    case "component": return {...base,id,type,componentKey:"",name:"Componente",values:{},fallbackHtml:"",properties:[]};
    case "heading": return { ...base, id, type, text: "Tu actualización", level: 2 };
    case "paragraph": return { ...base, id, type, text: "Hola, gracias por tu compra." };
    case "rich": return { ...base, id, type, tag: "p", children: [{ type: "text", text: "Texto nuevo" }] };
    case "variable": return { ...base, id, type, expression: variable };
    case "button": return { ...base, id, type, text: "Ver detalles", href: "https://example.test" };
    case "image": return { ...base, id, type, src: "https://example.test/image.jpg", alt: "Descripción de la imagen", width: "600" };
    case "divider": return { ...base, id, type, color: "#e2e8f0" };
    case "spacer": return { ...base, id, type, height: "24" };
    case "table": return {
      ...base, id, type, collection: firstArray(tokens), fields: [], width: "100%", header: true,
      headerBackground: "#f1f5f9", headerColor: "#334155", borderColor: "#e2e8f0", cellPadding: "8px", striped: false, stripeColor: "#f8fafc",
      columnLabels: {}, columnAlignments: {}, columnWidths: {},
    };
    case "container": return { ...base, id, type, children: [] };
    case "loop": return {
      ...base, id, type, collection: firstArray(tokens),
      children: [{ ...baseBlock(`${id}-item`, "variable"), id: `${id}-item`, type: "variable", expression: "item.name" }],
    };
    case "if": return {
      ...base, id, type, variable, operator: "hasValue", expected: "",
      children: [{ ...baseBlock(`${id}-message`, "paragraph"), id: `${id}-message`, type: "paragraph", text: "Tu información está disponible." }],
    };
  }
}

function attributesFor(block: EmailBlock, extra: Record<string, string> = {}, editorMetadata = false) {
  const className = [block.className, extra.class].filter(Boolean).join(" ");
  const styles = { ...(block.styles ?? {}) };
  const styleText = Object.entries(styles)
    .filter(([property, value]) => /^(?:--[\w-]+|[a-zA-Z-]+)$/.test(property) && value && !/expression\s*\(|javascript:/i.test(value))
    .map(([property, value]) => `${property.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}:${value}`)
    .join(";");
  const custom = Object.entries(block.attributes ?? {})
    .filter(([name]) => /^[a-zA-Z_:][\w:.-]*$/.test(name) && !/^on/i.test(name) && !/^th:/i.test(name) && !/^(?:class|style)$/i.test(name) &&
      !Object.keys(extra).some(generatedName => generatedName.toLowerCase() === name.toLowerCase()));
  const generated = Object.entries(extra)
    .filter(([name]) => /^[a-zA-Z_:][\w:.-]*$/.test(name) && !/^on/i.test(name) && !/^(?:class|style)$/i.test(name));
  const stylesText = [styleText, extra.style].filter(Boolean).join(";");
  const classAttr = className ? ` class="${escapeHtml(className)}"` : "";
  const styleAttr = stylesText ? ` style="${escapeHtml(stylesText)}"` : "";
  const editorId = editorMetadata ? ` data-ee-block-id="${escapeHtml(block.id)}" data-ee-block-kind="${block.type}"` : "";
  return classAttr + styleAttr + editorId + custom.map(([name, value]) =>
    ` ${name}="${escapeHtml(name === "href" || name === "src" ? safeUrl(String(value)) : String(value))}"`
  ).join("") +
    generated.map(([name, value]) => ` ${name}="${escapeHtml(name === "href" || name === "src" ? safeUrl(String(value)) : String(value))}"`).join("");
}

function conditionExpression(block: Extract<EmailBlock, { type: "if" }>) {
  if (!safeExpression(block.variable)) return "false";
  if (block.operator === "hasValue") return `\${${block.variable}} != null`;
  const literal = /^-?\d+(?:\.\d+)?$/.test(block.expected) || block.expected === "true" || block.expected === "false"
    ? block.expected
    : `'${block.expected.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  return `\${${block.variable}} ${block.operator === "equals" ? "==" : "!="} ${literal}`;
}

export function emailBlocksToHtml(blocks: EmailBlock[], options: { editorMetadata?: boolean; tableLoop?: { collection: string; id: string }; components?: EmailComponent[] } = {}): string {
  const classRules: string[] = [];
  const collectClassRules = (items: EmailBlock[]) => {
    for (const block of items) {
      const styles = Object.entries(block.classStyles ?? {})
        .filter(([property, value]) => /^(?:--[\w-]+|[a-zA-Z-]+)$/.test(property) && value && !/[{}<>]/.test(value) && !/expression\s*\(|javascript:/i.test(value))
        .map(([property, value]) => `${property.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}:${value}`)
        .join(";");
      if (styles) {
        const selectors = (block.className ?? "").split(/\s+/).filter(name => /^[a-zA-Z_][\w-]*$/.test(name));
        if (selectors.length) classRules.push(`${selectors.map(name => `.${name}`).join(",")}{${styles}}`);
      }
      if (block.type === "table" && block.striped && block.className) {
        const color = /^#[\da-f]{3,8}$/i.test(block.stripeColor ?? "") ? block.stripeColor : "#f8fafc";
        const rowClass = block.className.split(/\s+/).find(name => /^[a-zA-Z_][\w-]*$/.test(name));
        if (rowClass) classRules.push(`.${rowClass}-row:nth-child(even){background-color:${color}}`);
      }
      if (isContainer(block)) collectClassRules(block.children);
    }
  };
  collectClassRules(blocks);
  const markup = blocks.map(block => {
    switch (block.type) {
      case "component": return componentHtml(block,options.components?.find(component=>component.key===block.componentKey), attributesFor({...block,attributes:Object.fromEntries(Object.entries(block.attributes || {}).filter(([name])=>!name.startsWith("data-ee-component") && name!=="th:with"))}, {}, !!options.editorMetadata));
      case "html": return block.html;
      case "heading": {
        const level = block.level ?? 2;
        return `<h${level}${attributesFor(block, {}, !!options.editorMetadata)}>${escapeHtml(block.text)}</h${level}>`;
      }
      case "paragraph": return `<p${attributesFor(block, {}, !!options.editorMetadata)}>${escapeHtml(block.text)}</p>`;
      case "rich": return `<${block.tag}${attributesFor(block, {}, !!options.editorMetadata)}>${block.children.map(node => inlineNodeToHtml(node, !!options.editorMetadata)).join("")}</${block.tag}>`;
      case "variable": return isSafeInlineExpression(block.expression)
        ? `<span${attributesFor(block, { "th:text": `\${${block.expression}}` }, !!options.editorMetadata)}>${escapeHtml(block.expression)}</span>`
        : `<span${attributesFor(block, {}, !!options.editorMetadata)}></span>`;
      case "button": {
        const hrefAttribute = block.hrefMode !== "text" && block.href.includes("${") ? templateExpression(block.href) : undefined;
        const buttonStyles = { display: "inline-block", padding: "12px 22px", background: "#315ee8", borderRadius: "6px", color: "#fff", textDecoration: "none", fontWeight: "600", ...block.styles };
        return `<a${attributesFor({ ...block, styles: buttonStyles }, {
          ...(hrefAttribute ? { "th:href": `\${${hrefAttribute}}` } : { href: block.href }),
          ...(block.textExpression && isSafeInlineExpression(block.textExpression) ? { "th:text": `\${${block.textExpression}}` } : {}),
        }, !!options.editorMetadata)}>${parseInlineText(block.text).map(node=>inlineNodeToHtml(node,!!options.editorMetadata)).join("")}</a>`;
      }
      case "image": return `<img${attributesFor({ ...block, styles: { maxWidth: "100%", height: "auto", ...block.styles } }, { ...(block.srcMode !== "text" && block.src.includes("${") ? {"th:src":`\${${templateExpression(block.src)}}`} : {src:block.src}), alt: block.alt, width: block.width }, !!options.editorMetadata)} />`;
      case "divider": return `<hr${attributesFor({ ...block, styles: { border: "0", borderTop: `1px solid ${block.color}`, margin: "12px 0", ...block.styles } }, {}, !!options.editorMetadata)} />`;
      case "spacer": return `<div${attributesFor(block, { style: `height:${Math.max(0, Math.min(Number(block.height) || 0, 1000))}px;line-height:${Math.max(0, Math.min(Number(block.height) || 0, 1000))}px;font-size:1px` }, !!options.editorMetadata)}>&nbsp;</div>`;
      case "table": {
        const fields = block.fields.filter(safeExpression);
        const safeCss = (value: string | undefined, fallback: string) => value && /^[#(),.%\w\s-]+$/.test(value) ? value : fallback;
        const padding = safeCss(block.cellPadding, "8px");
        const border = safeCss(block.borderColor, "#e2e8f0");
        const groups: string[][] = [];
        for (let index = 0; index < fields.length;) {
          const merge = block.mergedColumns?.find(group => group.includes(fields[index]) && group.every(field => fields.includes(field)));
          const ordered = merge?.length && fields.slice(index, index + merge.length).every(field => merge.includes(field)) ? fields.slice(index, index + merge.length) : [fields[index]];
          groups.push(ordered); index += ordered.length;
        }
        const heads = groups.map(group => {
          const field = group[0];
          const align = block.columnAlignments?.[field] ?? "left";
          const width = safeCss(block.columnWidths?.[field], "");
          const label = group.map(item => block.columnLabels?.[item] || item.split(".").pop() || item).join(" · ");
          const metadata = options.editorMetadata ? ` data-ee-cell-fields="${escapeHtml(group.join(","))}"` : "";
          return `<th${metadata} colspan="${group.length}" align="${align}"${width ? ` width="${escapeHtml(width)}"` : ""} style="padding:${escapeHtml(padding)};border:${escapeHtml(safeCss(block.borderWidth, "1px"))} solid ${escapeHtml(border)};background:${escapeHtml(safeCss(block.headerBackground, "#f1f5f9"))};color:${escapeHtml(safeCss(block.headerColor, "#334155"))};text-align:${align}">${escapeHtml(label)}</th>`;
        }).join("");
        const body = tableRowGroups(block, options.tableLoop?.collection ?? block.collection).map(rowGroup => {
          const cells = groups.map(group => {
            const field = group[0];
            const align = block.columnAlignments?.[field] ?? "left";
            const values = group.map(field => {
              const cell = rowGroup.cells[field];
              if (!cell) return "";
              const dynamic = (source: string, formatted = true) => `<span th:text="\${${escapeHtml(isSafeInlineExpression(source) ? formatted ? columnExpression(source,block.columnFormats?.[field]) : source : "unknown")}}"></span>`;
              let content = escapeHtml(cell.value);
              if (cell.mode === "expression") content = dynamic(cell.value);
              if (cell.mode === "template") {
                content = ""; let end = 0;
                for (const match of cell.value.matchAll(/\$\{([^{}]+)\}/g)) { content += escapeHtml(cell.value.slice(end,match.index)) + dynamic(match[1],/^\$\{[^{}]+\}$/.test(cell.value)); end = match.index! + match[0].length; }
                content += escapeHtml(cell.value.slice(end));
              }
              return `<span data-ee-field="${escapeHtml(field)}" data-ee-cell-mode="${cell.mode}" data-ee-cell-value="${escapeHtml(cell.value)}">${content}</span>`;
            }).join(" · ");
            return `<td colspan="${group.length}" align="${align}" style="padding:${escapeHtml(padding)};border:${escapeHtml(safeCss(block.borderWidth,"1px"))} solid ${escapeHtml(border)};text-align:${align};width:${escapeHtml(safeCss(block.columnWidths?.[field],"auto"))}">${values}</td>`;
          }).join("");
          const each = rowGroup.type === "repeat" ? ` th:each="item : \${${safeExpression(rowGroup.collection ?? "") ? rowGroup.collection : "items"}}"` : "";
          return `<tr data-ee-row-id="${escapeHtml(rowGroup.id)}"${each}>${cells}</tr>`;
        }).join("");
        const width = safeCss(block.width, "100%");
        const table = `<table${attributesFor(block, { width, cellpadding: "0", cellspacing: "0", "data-ee-table-fields": fields.join(","), "data-ee-column-formats": JSON.stringify(block.columnFormats ?? {}), style: "border-collapse:collapse;border-spacing:0" }, false)}>${block.header ? `<thead><tr>${heads}</tr></thead>` : ""}<tbody>${body}</tbody></table>`;
        if (!options.editorMetadata) return table;
        const shellStyle = `position:relative;display:block;width:${escapeHtml(width)};max-width:100%;overflow:visible`;
        return `<div${attributesFor(block, { style: shellStyle }, true)} data-ee-table-shell="${escapeHtml(block.id)}">${table}<span data-ee-table-resize="${escapeHtml(block.id)}" title="Arrastra para cambiar el ancho" aria-label="Cambiar ancho de tabla"></span></div>`;
      }
      case "container": return `<div${attributesFor(block, {}, !!options.editorMetadata)}>${emailBlocksToHtml(block.children, options)}</div>`;
      case "loop": {
        if (block.children.length === 1 && block.children[0].type === "table") {
          return emailBlocksToHtml(block.children, { ...options, tableLoop: { collection: block.collection, id: block.id } });
        }
        return `<div${attributesFor(block, { "th:each": `item : \${${safeExpression(block.collection) ? block.collection : "items"}}` }, !!options.editorMetadata)}>\n${emailBlocksToHtml(block.children, options)}\n</div>`;
      }
      case "if": return `<div${attributesFor(block, { "th:if": conditionExpression(block) }, !!options.editorMetadata)}>\n${emailBlocksToHtml(block.children, options)}\n</div>`;
    }
  }).join("\n");
  return classRules.length ? `<style>${classRules.join("\n")}</style>\n${markup}` : markup;
}

function inlineNodeToHtml(node: InlineNode, editorMetadata = false): string {
  if (node.type === "text") return escapeHtml(node.text);
  if (node.type === "variable") {
    const expression = isSafeInlineExpression(node.expression) ? node.expression : "unknown";
    const metadata = editorMetadata ? ` data-ee-inline-expression="${escapeHtml(expression)}" data-ee-inline-fallback="${escapeHtml(node.fallback)}"` : "";
    return `<span${metadata} th:text="\${${expression}}">${escapeHtml(node.fallback)}</span>`;
  }
  if (node.tag === "br") return "<br>";
  const href = node.tag === "a" && node.href ? /^\$\{[^{}]+\}$/.test(node.href)
    ? ` th:href="${escapeHtml(node.href)}"` : ` href="${escapeHtml(safeUrl(node.href))}"` : "";
  return `<${node.tag}${attributesFor({ id: "inline", type: "container", children: [], styles: node.styles })}${href}>${node.children.map(child => inlineNodeToHtml(child, editorMetadata)).join("")}</${node.tag}>`;
}

function parseInlineText(text: string): InlineNode[] {
  const result: InlineNode[] = [];
  const pattern = /\$\{([^{}]+)\}|\{\{\s*(?:=\s*([^{}]+)|([\w$.]+))\s*\}\}/g;
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    const expression = (match[1] ?? match[2] ?? match[3]).trim();
    if (!isSafeInlineExpression(expression)) continue;
    const index = match.index ?? 0;
    if (index > offset) result.push({ type: "text", text: text.slice(offset, index) });
    result.push({ type: "variable", expression, fallback: expression });
    offset = index + match[0].length;
  }
  if (offset < text.length) result.push({ type: "text", text: text.slice(offset) });
  return result;
}

export function parseInlineHtmlToNodes(html: string): InlineNode[] {
  if (typeof DOMParser === "undefined") return [{ type: "text", text: html.replace(/<[^>]*>/g, "") }];
  const document = new DOMParser().parseFromString(`<div>${normalizeTemplateMarkup(html)}</div>`, "text/html");
  return Array.from(document.body.firstElementChild?.childNodes ?? []).flatMap(parseInlineNode);
}

const inlineTagNames = ["strong", "b", "em", "i", "u", "a", "span", "small", "sup", "sub", "br"] as const;
const isInlineTag = (tagName: string) => (inlineTagNames as readonly string[]).includes(tagName);

function parseInlineNode(node: Node): InlineNode[] {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ? parseInlineText(node.textContent) : [];
  }
  if (!(node instanceof Element)) return [];
  const expression = node.getAttribute("data-ee-inline-expression") ?? node.getAttribute("th:text")?.match(/^\$\{([^{}]+)\}$/)?.[1];
  if (node.hasAttribute("data-ee-inline-expression") && expression && isSafeInlineExpression(expression)) return [{ type: "variable", expression, fallback: node.getAttribute("data-ee-inline-fallback") ?? node.textContent ?? "" }];
  if (expression && isInlineTag(node.tagName.toLowerCase())) {
    const tag = node.tagName.toLowerCase() as typeof inlineTagNames[number];
    return [{
      type: "element", tag, styles: blockPresentation(node).styles,
      children: [{ type: "variable", expression, fallback: node.textContent ?? "" }],
      ...(tag === "a" && node.hasAttribute("href") ? { href: node.getAttribute("href") ?? "" } : {}),
    }];
  }
  if (expression) return [{ type: "variable", expression, fallback: node.textContent ?? "" }];
  if (!isInlineTag(node.tagName.toLowerCase())) return [{ type: "text", text: node.textContent ?? "" }];
  const tag = node.tagName.toLowerCase() as typeof inlineTagNames[number];
  return [{
    type: "element",
    tag,
    styles: blockPresentation(node).styles,
    children: Array.from(node.childNodes).flatMap(parseInlineNode),
    ...(tag === "a" && (node.hasAttribute("href") || node.hasAttribute("th:href")) ? { href: node.getAttribute("th:href") ?? node.getAttribute("href") ?? "" } : {}),
  }];
}

/** Whether a child node can flow inline with its siblings into one "rich" block, instead of
 * each becoming its own stray top-level block (which is what used to fragment e.g.
 * `<span>Subtotal</span><br/><span>Descuento</span>` into separate stacked blocks). */
function isInlineFlowCandidate(node: Node): boolean {
  if (node.nodeType === Node.TEXT_NODE) return true;
  if (!(node instanceof Element)) return false;
  if (Array.from(node.attributes).some(attribute => attribute.name.startsWith("th:") && attribute.name !== "th:text" && !(attribute.name === "th:href" && node.tagName.toLowerCase() === "a"))) return false;
  if (node.hasAttribute("th:text") && !node.getAttribute("th:text")?.match(/^\$\{([^{}]+)\}$/)) return false;
  return isInlineTag(node.tagName.toLowerCase());
}

/** Parses a list of sibling nodes into blocks, grouping runs of inline-level content (text,
 * span/strong/br/...) into a single editable "rich" block instead of one stray block per node. */
function parseChildNodesGrouped(nodes: Node[], nextId: () => string): EmailBlock[] {
  const parent = nodes[0]?.parentElement;
  const display = parent ? blockPresentation(parent).styles.display : undefined;
  if (display === "flex" || display === "inline-flex" || display === "grid") {
    return nodes.flatMap(node => {
      if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) return [];
      if (isInlineFlowCandidate(node)) return [{ id: nextId(), type: "rich" as const, tag: "span" as const, children: parseInlineNode(node) }];
      return parseBlockNode(node, nextId);
    });
  }
  const result: EmailBlock[] = [];
  let buffer: Node[] = [];
  const flushBuffer = () => {
    if (!buffer.length) return;
    const children = buffer.flatMap(parseInlineNode);
    buffer = [];
    const hasContent = children.some(child => child.type !== "text" || child.text.trim() !== "");
    if (!hasContent) return;
    result.push({ id: nextId(), type: "rich", tag: "span", children });
  };
  for (const node of nodes) {
    if (isInlineFlowCandidate(node)) { buffer.push(node); continue; }
    flushBuffer();
    result.push(...parseBlockNode(node, nextId));
  }
  flushBuffer();
  return result;
}

function blockPresentation(element: Element) {
  const className = element.getAttribute("class") ?? undefined;
  const styles: Record<string, string> = {};
  for (const declaration of (element.getAttribute("style") ?? "").split(";")) {
    const separator = declaration.indexOf(":");
    if (separator < 1) continue;
    const property = declaration.slice(0, separator).trim();
    const value = declaration.slice(separator + 1).trim();
    if (/^(?:--[\w-]+|[a-zA-Z-]+)$/.test(property) && !/[{}<>]/.test(value)) {
      styles[property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())] = value;
    }
  }
  const attributes = Object.fromEntries(Array.from(element.attributes)
    .filter(attribute => !["class", "style"].includes(attribute.name.toLowerCase()) &&
      !attribute.name.startsWith("th:") && !/^on/i.test(attribute.name))
    .map(attribute => [attribute.name, attribute.value]));
  return { className, styles, attributes };
}

function parseIf(element: Element, id: string, nextId: () => string): EmailBlock | undefined {
  const condition = element.getAttribute("th:if")?.match(/^\$\{([\w$.]+)\}\s*(?:(==|!=)\s*(.+))?$/);
  if (!condition || !/^[\w$]+(?:\.[\w$]+)*$/.test(condition[1])) return undefined;
  const right = condition[3]?.trim() ?? "";
  const expected = right.startsWith("'") && right.endsWith("'")
    ? right.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\")
    : right;
  const isPresenceCheck = !condition[2] || (condition[2] === "!=" && right === "null");
  const operator = isPresenceCheck ? "hasValue" : condition[2] === "==" ? "equals" : "different";
  const tag = element.tagName.toLowerCase();
  const presentation = ["p", "h1", "h2", "h3"].includes(tag) ? {} : blockPresentation(element);
  // A conditional paragraph is still one editable text block. Parsing its text
  // and inline Thymeleaf nodes as separate top-level blocks used to turn e.g.
  // the <b th:text> child into a protected "existing HTML" block.
  const children: EmailBlock[] = ["p", "h1", "h2", "h3"].includes(tag)
    ? [{
      ...blockPresentation(element), id: nextId(), type: "rich",
      tag: tag as "p" | "h1" | "h2" | "h3",
      children: Array.from(element.childNodes).flatMap(parseInlineNode),
    }]
    : parseChildNodesGrouped(Array.from(element.childNodes), nextId);
  return {
    ...presentation, id, type: "if", variable: condition[1],
    operator, expected, children,
  };
}

function parseLoop(element: Element, id: string, nextId: () => string): EmailBlock | undefined {
  const each = element.getAttribute("th:each")?.match(/^\s*item\s*:\s*\$\{([\w$.]+)\}\s*$/);
  if (!each || !/^[\w$]+(?:\.[\w$]+)*$/.test(each[1])) return undefined;
  return {
    ...blockPresentation(element), id, type: "loop", collection: each[1],
    children: parseChildNodesGrouped(Array.from(element.childNodes), nextId),
  };
}

function parseButtonFragment(element: Element, id: string): EmailBlock | undefined {
  const fragment = element.getAttribute("th:replace") ?? element.getAttribute("th:insert") ?? "";
  const match = fragment.match(/ctaButton\(\s*(?:\$\{([\w$.]+)\}|'([^']*)')\s*,\s*'((?:\\.|[^'])*)'/);
  if (!match) return undefined;
  return {
    ...blockPresentation(element), id, type: "button",
    href: match[1] ? `\${${match[1]}}` : match[2],
    text: match[3].replace(/\\'/g, "'"),
  };
}

function parseTable(element: Element, id: string): EmailBlock | undefined {
  if (element.hasAttribute("data-ee-table-fields")) {
    const fields = (element.getAttribute("data-ee-table-fields") ?? "").split(",").filter(safeExpression);
    const heads = Array.from(element.querySelectorAll("thead th"));
    const rows = Array.from(element.querySelectorAll(":scope > tbody > tr"));
    let columnFormats: Record<string, TableColumnFormat> = {};
    try { columnFormats = JSON.parse(element.getAttribute("data-ee-column-formats") ?? "{}"); } catch { /* Keep default formatting for malformed metadata. */ }
    const rowGroups: TableRowGroup[] = rows.map((row,index) => {
      const collection = row.getAttribute("th:each")?.match(/^item\s*:\s*\$\{([\w$.]+)\}$/)?.[1];
      const cells = Array.from(row.children);
      return {id:row.getAttribute("data-ee-row-id") ?? `${id}-row-${index}`,type:collection ? "repeat" : "single",collection,cells:Object.fromEntries(fields.map((field,index)=>{
        const cell = cells[index];
        const original = Array.from(row.querySelectorAll("[data-ee-field]")).find(el=>el.getAttribute("data-ee-field") === field);
        const mode = original?.getAttribute("data-ee-cell-mode");
        if (original && (mode === "text" || mode === "template" || mode === "expression")) return [field,{mode,value:original.getAttribute("data-ee-cell-value") ?? ""}];
        const expr = cell?.querySelector("[th\\:text]");
        const value = expr?.getAttribute("data-ee-source") ?? expr?.getAttribute("th:text")?.match(/^\$\{([\s\S]+)\}$/)?.[1];
        return [field,{mode:value !== undefined ? "expression" : "text",value:value ?? cell?.textContent ?? ""}];
      }))};
    });
    return {...blockPresentation(element),id,type:"table",fields,collection:rowGroups.find(row=>row.type === "repeat")?.collection ?? "",rowGroups,columnFormats,
      header:heads.length>0,width:element.getAttribute("width") ?? "100%",columnLabels:Object.fromEntries(fields.map((field,index)=>[field,heads[index]?.textContent ?? field])),
      columnAlignments:Object.fromEntries(fields.map((field,index)=>[field,(heads[index]?.getAttribute("align") ?? "left") as "left" | "center" | "right"])),
      cellPadding:element.querySelector("td") ? blockPresentation(element.querySelector("td")!).styles.padding : "8px",
      borderWidth:element.querySelector("td") ? blockPresentation(element.querySelector("td")!).styles.border?.split(" ")[0] : "1px",
      borderColor:element.querySelector("td") ? blockPresentation(element.querySelector("td")!).styles.border?.split(" ").slice(2).join(" ") : "#e2e8f0",
      headerBackground:heads[0] ? blockPresentation(heads[0]).styles.background : undefined,headerColor:heads[0] ? blockPresentation(heads[0]).styles.color : undefined};
  }
  const row = element.querySelector("tr[th\\:each]");
  const body = element.querySelector("tbody[th\\:each]");
  const target = row ?? body ?? (element.hasAttribute("th:each") ? element : undefined);
  const expression = target?.getAttribute("th:each")?.match(/^\s*(\w+)\s*:\s*\$\{([\w$.]+)\}\s*$/);
  if (!target || !expression) return undefined;
  const cellGroups = Array.from(target.querySelectorAll("td")).map(cell => {
    const expressions = cell.hasAttribute("th:text") ? [cell] : Array.from(cell.querySelectorAll("[th\\:text]"));
    return expressions.map(element => element.getAttribute("th:text")?.match(/^\$\{(?:item\.)?([\w$.]+)\}$/)?.[1])
      .filter((field): field is string => !!field && /^[\w$]+(?:\.[\w$]+)*$/.test(field));
  }).filter(group => group.length);
  const fields = cellGroups.flat();
  if (!fields.length) return undefined;
  const headerCells = Array.from(element.querySelectorAll("thead th"));
  const headerLabels = headerCells.flatMap(cell => {
    const label = cell.textContent?.trim() ?? "";
    const span = Math.max(1, Number(cell.getAttribute("colspan")) || 1);
    const parts = label.split(/\s*·\s*/);
    return Array.from({ length: span }, (_, index) => parts[index] ?? (index === 0 ? label : ""));
  });
  const columnLabels = Object.fromEntries(fields.flatMap((field, index) => headerLabels[index] ? [[field, headerLabels[index]]] : []));
  const headerAlignment = headerCells.flatMap(cell => Array(Math.max(1, Number(cell.getAttribute("colspan")) || 1)).fill(cell.getAttribute("align")));
  const columnAlignments = Object.fromEntries(fields.flatMap((field, index) => {
    const align = headerAlignment[index];
    return align && ["left", "center", "right"].includes(align) ? [[field, align as "left" | "center" | "right"]] : [];
  }));
  // Keep all body rows; a repeating row is only one source inside the table.
  const bodyRows = Array.from(element.querySelectorAll(":scope > tbody > tr"));
  const rowGroups: TableRowGroup[] | undefined = bodyRows.length > 1 ? bodyRows.map((row,index) => {
    const collection = (row.getAttribute("th:each") ?? row.parentElement?.getAttribute("th:each"))?.match(/^\s*item\s*:\s*\$\{([\w$.]+)\}\s*$/)?.[1];
    return {id:`${id}-row-${index}`,type:collection ? "repeat" : "single",collection,cells:Object.fromEntries(fields.map((field,index)=>{
      const cell = row.children[index];
      const dynamic = cell?.hasAttribute("th:text") ? cell : cell?.querySelector("[th\\:text]");
      const expression = dynamic?.getAttribute("th:text")?.match(/^\$\{([\s\S]+)\}$/)?.[1];
      return [field,{mode:expression ? "expression" : "text",value:expression ?? cell?.textContent ?? ""}];
    }))};
  }) : undefined;
  return {
    ...blockPresentation(element), id, type: "table",
    collection: expression[2], fields, rowGroups,
    width: element.getAttribute("width") ?? "100%", header: !!element.querySelector("thead"),
    headerBackground: headerCells[0] ? blockPresentation(headerCells[0]).styles.background ?? "transparent" : "transparent",
    headerColor: headerCells[0] ? blockPresentation(headerCells[0]).styles.color ?? "inherit" : "inherit",
    borderColor: "transparent", borderWidth: "0px",
    cellPadding: element.querySelector("td") ? blockPresentation(element.querySelector("td")!).styles.padding ?? element.getAttribute("cellpadding") ?? "1px" : "1px",
    striped: false, stripeColor: "#f8fafc",
    columnLabels, columnAlignments, columnWidths: {}, mergedColumns: cellGroups.filter(group => group.length > 1),
  };
}

function parseBlockNode(node: Node, nextId: () => string): EmailBlock[] {
  if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) return [];
  if (!(node instanceof Element)) {
    return node.textContent?.trim()
      ? [{ id: nextId(), type: "paragraph", text: node.textContent.trim() }]
      : [];
  }
  const id = nextId();
  if (node.hasAttribute("data-ee-component")) {
    const component=readComponent(node);
    return component ? [{...blockPresentation(node),...component,id,type:"component"}] : [htmlBlock(node,id)];
  }
  if (node.hasAttribute("th:if")) {
    const conditional = parseIf(node, id, nextId);
    return conditional ? [conditional] : [htmlBlock(node, id)];
  }
  if (node.hasAttribute("th:replace") || node.hasAttribute("th:insert")) {
    const button = parseButtonFragment(node, id);
    return button ? [button] : [htmlBlock(node, id)];
  }
  if (node.tagName.toLowerCase() === "table") {
    const table = parseTable(node, id);
    if (!table || table.type !== "table") return [htmlBlock(node, id)];
    return [table];
  }
  const tag = node.tagName.toLowerCase();
  if (tag === "div" && node.hasAttribute("th:each")) {
    const loop = parseLoop(node, id, nextId);
    return loop ? [loop] : [htmlBlock(node, id)];
  }
  if (tag === "div" && Array.from(node.attributes).every(attribute =>
    !attribute.name.startsWith("th:") && !/^on/i.test(attribute.name))) {
    return [{
      ...blockPresentation(node), id, type: "container",
      children: parseChildNodesGrouped(Array.from(node.childNodes), nextId),
    }];
  }
  if (["p", "h1", "h2", "h3"].includes(tag)) {
    const textExpression = node.getAttribute("th:text")?.match(/^\$\{([\w$.]+)\}$/)?.[1];
    const children = textExpression
      ? [{ type: "variable" as const, expression: textExpression, fallback: node.textContent ?? "" }]
      : Array.from(node.childNodes).flatMap(parseInlineNode);
    if (node.hasAttribute("th:if")) return [htmlBlock(node, id)];
    return [{
      ...blockPresentation(node), id, type: "rich",
      tag: tag as "p" | "h1" | "h2" | "h3", children,
    }];
  }
  return [htmlBlock(node, id)];
}

function htmlBlock(element: Element, id: string): EmailBlock {
  return { id, type: "html", html: element.outerHTML };
}

export function parseEmailHtmlToBlocks(source: string): EmailBlock[] {
  if (!source.trim()) return [];
  if (typeof DOMParser === "undefined") return [{ id: "source-html", type: "html", html: source }];
  const document = new DOMParser().parseFromString(normalizeTemplateMarkup(source), "text/html");
  let index = 0;
  const nextId = () => `imported-${++index}`;
  return parseChildNodesGrouped(Array.from(document.body.childNodes), nextId);
}

export {
  updateEmailBlock,
  insertEmailBlock,
  removeEmailBlock,
  moveEmailBlock,
  moveEmailBlockToContainer,
  moveEmailBlockBefore,
  moveEmailBlockAfter,
  duplicateEmailBlock,
  findEmailBlock,
} from "./emailBlockTree";
