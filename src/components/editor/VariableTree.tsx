import { useState } from "react";
import type { EmailToken } from "../../services/emailTemplateRenderer";
import { resolveSample } from "../../services/blockPreview";

type Variable = { path: string; label: string; value: unknown; insertable: boolean; children: Variable[] };
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const kind = (value: unknown): string => Array.isArray(value) ? "array" : value === null ? "null" : value === undefined ? "sin muestra" : typeof value === "object" ? "objeto" : typeof value === "string" ? "texto" : typeof value === "number" ? "número" : typeof value === "boolean" ? "booleano" : "desconocido";
const typeLabel = (value: unknown) => Array.isArray(value) ? `array<${[...new Set(value.map(kind))].join(" | ") || "?"}>` : kind(value);
function build(path: string, label: string, value: unknown, insertable = true, ancestors: unknown[] = []): Variable {
  const children: Variable[] = [];
  if (value && typeof value === "object" && !ancestors.includes(value) && ancestors.length < 12) {
    const next = [...ancestors, value];
    if (Array.isArray(value)) {
      if (value.length) children.push(build(`${path}[]`, "Elemento de muestra", value[0], false, next));
    } else {
      for (const [key, child] of Object.entries(value)) children.push(build(`${path}.${key}`, key, child, insertable && /^[\w$]+$/.test(key), next));
    }
  }
  return { path, label, value, insertable, children };
}

export default function VariableTree({ tokens, loopCollection, query, onVariable }: {tokens: EmailToken[]; loopCollection?: string; query: string; onVariable: (path: string) => void}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const roots = tokens.map(token => build(token.varName, token.label, token.sample));
  const collection = loopCollection ? resolveSample(loopCollection, tokens) : undefined;
  if (Array.isArray(collection) && collection.length) roots.unshift(build("item", "Elemento actual", collection[0]));
  const term = normalize(query.trim());
  const matches = (node: Variable) => normalize(`${node.label} ${node.path} ${typeLabel(node.value)}`).includes(term);
  const visible = (node: Variable): boolean => matches(node) || node.children.some(visible);
  const render = (node: Variable, depth = 0, showAll = false): React.ReactNode => {
    if (!showAll && !visible(node)) return null;
    const expandable = node.children.length > 0;
    const open = !!term || !collapsed.has(node.path);
    const sample = Array.isArray(node.value) ? `${node.value.length} elementos` : node.value && typeof node.value === "object" ? `${Object.keys(node.value).length} propiedades` : node.value === undefined ? "Sin valor de ejemplo" : node.value === null ? "null" : typeof node.value === "string" ? `“${node.value}”` : String(node.value);
    return <div className="ee-variable-branch" key={node.path}>
      <div className="ee-variable-row" style={{ paddingLeft: 4 + Math.min(depth, 5) * 12 }}>
        {expandable ? <button className="ee-variable-toggle" aria-label={`${open ? "Contraer" : "Expandir"} ${node.path}`} aria-expanded={open} onClick={() => setCollapsed(current => {const next = new Set(current); if (next.has(node.path)) next.delete(node.path); else next.add(node.path); return next;})}>{open ? "⌄" : "›"}</button> : <span className="ee-variable-toggle" />}
        <div className="ee-variable-info"><div className="ee-variable-heading"><strong title={node.label}>{node.label}</strong><span className={`ee-variable-type type-${kind(node.value)}`} title={typeLabel(node.value)}>{typeLabel(node.value)}</span></div><code title={node.path}>{node.path}</code><small title={sample}>{sample}</small></div>
        {node.insertable && !Array.isArray(node.value) && <button className="ee-variable-tree-insert" aria-label={`Insertar ${node.path}`} title={`Insertar \${${node.path}}`} onClick={() => onVariable(node.path)}>+</button>}
      </div>
      {Array.isArray(node.value) && open && <p className="ee-variable-note" style={{paddingLeft: 24 + Math.min(depth, 5) * 12}}>{node.value.length ? "Estructura del primer elemento. Usa sus campos dentro de Repetir." : "Array vacío: añade una muestra para ver sus campos."}</p>}
      {expandable && open && <div className="ee-variable-children">{node.children.map(child => render(child, depth + 1, showAll || (!!term && matches(node))))}</div>}
    </div>;
  };
  return <div className="ee-variable-tree" aria-label="Estructura de variables">
    <p className="ee-palette-hint">Tipos inferidos de los datos de ejemplo. Pulsa + para insertar un valor.</p>
    {!roots.length ? <p className="ee-empty-hint">Añade variables desde la aplicación.</p> : !roots.some(visible) ? <p className="ee-empty-hint">No hay variables para «{query}».</p> : roots.map(node => render(node))}
  </div>;
}
