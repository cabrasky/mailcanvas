import type { EmailComponent } from "../../services/emailComponents";
import { useState } from "react";
import VariableTree from "./VariableTree";
import type { EmailToken } from "../../services/emailTemplateRenderer";
import type { BlockKind } from "../../services/emailBlocks";
import { armThresholdDrag } from "../email-editor/dragThreshold";

type Props = { components?: EmailComponent[]; onComponent?: (component:EmailComponent)=>void; tokens: EmailToken[]; loopCollection?: string; onAdd: (kind: BlockKind) => void; onBeginDrag: (kind: BlockKind, clientX: number, clientY: number) => void; onVariable: (expression: string) => void };
const groups: { group: string; items: { kind: BlockKind; name: string; icon: string; description: string }[] }[] = [
  { group: "Contenido", items: [
    { kind: "heading", name: "Título", icon: "T", description: "Encabezado del correo" },
    { kind: "paragraph", name: "Texto", icon: "¶", description: "Párrafo sencillo" },
    { kind: "button", name: "Botón", icon: "↗", description: "Llamada a la acción" },
    { kind: "image", name: "Imagen", icon: "▧", description: "Imagen con texto alternativo" },
    { kind: "divider", name: "Separador", icon: "—", description: "Línea horizontal" },
    { kind: "spacer", name: "Espaciador", icon: "↕", description: "Espacio vertical" },
    { kind: "container", name: "Contenedor", icon: "▱", description: "Agrupa y alinea otros bloques" },
  ] },
  { group: "Datos y lógica", items: [
    { kind: "variable", name: "Dato", icon: "ƒ", description: "Muestra una variable" },
    { kind: "table", name: "Tabla", icon: "▦", description: "Tabla dinámica de una lista" },
    { kind: "if", name: "Condición", icon: "◇", description: "Muestra contenido si se cumple" },
    { kind: "loop", name: "Repetir", icon: "⟳", description: "Repite contenido para cada elemento" },
  ] },
];

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function BlockPalette({ tokens, loopCollection, onAdd, onBeginDrag, onVariable, components = [], onComponent }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"blocks" | "variables" | "components">("blocks");
  const matches = (text: string) => normalize(text).includes(normalize(query.trim()));
  const visibleGroups = groups.map(group => ({ ...group, items: group.items.filter(item => matches(`${item.name} ${item.description} ${group.group}`)) })).filter(group => group.items.length);
  return <div className="ee-palette" aria-label="Biblioteca de bloques">
    <div className="ee-library-intro"><strong>Construye tu correo</strong><p>Arrastra un bloque o pulsa para insertarlo.</p></div>
    <div className="ee-panel-search"><span aria-hidden="true">⌕</span><input type="search" aria-label="Buscar bloques y variables" placeholder="Buscar bloques o variables…" value={query} onChange={event => setQuery(event.target.value)} /></div>
    <div className="ee-library-categories" role="group" aria-label="Contenido de la biblioteca"><button aria-pressed={category === "blocks"} onClick={() => {setCategory("blocks"); setQuery("");}}>Bloques <span>{groups.reduce((count, group) => count + group.items.length, 0)}</span></button><button aria-pressed={category === "variables"} onClick={() => {setCategory("variables"); setQuery("");}}>Variables <span>{tokens.length}</span></button><button aria-pressed={category === "components"} onClick={()=>{setCategory("components");setQuery("");}}>Componentes <span>{components.length}</span></button></div>

    {(category === "blocks" || query.trim()) && visibleGroups.map(group => <section className="ee-palette-group" key={group.group}>
      <h3>{group.group}</h3>
      <div className="ee-palette-grid">{group.items.map(item => <button className="ee-library-card" key={item.kind}
        onPointerDown={event => armThresholdDrag(event, (x, y) => onBeginDrag(item.kind, x, y))} onClick={() => onAdd(item.kind)} title={item.description}>
        <span className="ee-library-icon" aria-hidden="true">{item.icon}</span><span className="ee-library-copy"><strong>{item.name}</strong><small>{item.description}</small></span><span className="ee-library-add" aria-hidden="true">+</span>
      </button>)}</div>
    </section>)}
    {(category === "components" || query.trim()) && <section className="ee-palette-group"><h3>Biblioteca compartida</h3><p className="ee-palette-hint">Inserta una instancia vinculada y personaliza sus propiedades en el inspector.</p><div className="ee-palette-grid">{components.filter(component=>matches(`${component.name} ${component.description} ${component.category}`)).map(component=><button className="ee-library-card" key={component.key} onClick={()=>onComponent?.(component)}><span className="ee-library-icon">◇</span><span className="ee-library-copy"><strong>{component.name}</strong><small>{component.description}</small></span><span className="ee-library-add">+</span></button>)}</div>{!components.length&&<p className="ee-empty-hint">No hay componentes conectados a esta biblioteca.</p>}</section>}
    {(category === "variables" || query.trim()) && <section className="ee-palette-group ee-token-group">
      <div className="ee-palette-section-title"><h3>{loopCollection ? "Datos y variables" : "Estructura de datos"}</h3><span>{tokens.length}</span></div>
      {loopCollection && <p className="ee-palette-hint">Dentro de la lista: {loopCollection}</p>}
      <VariableTree tokens={tokens} loopCollection={loopCollection} query={query} onVariable={onVariable} />
    </section>}
  </div>;
}
