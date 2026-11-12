import type { EmailComponent } from "../../services/emailComponents";
import type React from "react";
import type { EmailBlock, BlockKind } from "../../services/emailBlocks";
import type { EmailToken } from "../../services/emailTemplateRenderer";
import BlockPalette from "./BlockPalette";
import LayerPanel from "./LayerPanel";

type Props = {
  components?: EmailComponent[]; onComponent?: (component:EmailComponent)=>void;
  style?: React.CSSProperties;
  tab: "layers" | "insert"; onTabChange: (tab: "layers" | "insert") => void;
  blocks: EmailBlock[]; selectedIds: Set<string>; tokens: EmailToken[]; loopCollection?: string;
  onAdd: (kind: BlockKind) => void; onBeginPaletteDrag: (kind: BlockKind, clientX: number, clientY: number) => void; onVariable: (expression: string) => void;
  onSelect: (id: string, additive: boolean) => void; onSelectTableField: (id: string, field: string) => void;
  onMove: (id: string, delta: -1 | 1) => void; onDelete: (id: string) => void;
  onReorder: (movingId: string, targetId: string, after: boolean) => void; onContextMenu: (id: string, x: number, y: number) => void;
};

export default function LeftPanel(props: Props) {
  return <aside className="ee-left-panel" style={props.style}>
    <div className="ee-panel-tabs" role="tablist" aria-label="Panel izquierdo">
      <button role="tab" aria-selected={props.tab === "insert"} className={props.tab === "insert" ? "active" : ""} onClick={() => props.onTabChange("insert")}>Insertar</button>
      <button role="tab" aria-selected={props.tab === "layers"} className={props.tab === "layers" ? "active" : ""} onClick={() => props.onTabChange("layers")}>Capas</button>
    </div>
    {props.tab === "layers"
      ? <LayerPanel blocks={props.blocks} selectedIds={props.selectedIds} onSelect={props.onSelect} onSelectTableField={props.onSelectTableField}
        onMove={props.onMove} onDelete={props.onDelete} onReorder={props.onReorder} onContextMenu={props.onContextMenu} />
      : <BlockPalette components={props.components} onComponent={props.onComponent} tokens={props.tokens} loopCollection={props.loopCollection} onAdd={props.onAdd} onBeginDrag={props.onBeginPaletteDrag} onVariable={props.onVariable} />}
  </aside>;
}
