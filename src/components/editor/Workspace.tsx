import { useCanvasViewport } from "../../editor/useCanvasViewport";
import type { EmailBlock } from "../../services/emailBlocks";
import type { EmailToken } from "../../services/emailTemplateRenderer";
import type { EmailComponent } from "../../services/emailComponents";
import { CanvasContext, type CanvasContextValue, type DragEdge, type DragState } from "../email-editor/canvasContext";
import BlockRenderer from "./BlockRenderer";
import SelectionOverlay from "./SelectionOverlay";

export type Pan = { x: number; y: number };

type Props = {
  blocks: EmailBlock[];
  tokens: EmailToken[];
  components?: EmailComponent[];
  selectedIds: Set<string>;
  hoverId: string | null;
  editingId: string | null;
  tableSelection: { id: string; fields: string[] } | null;
  drag: DragState | null;
  zoom: number;
  pan: Pan;
  onZoomChange: (zoom: number, focus?: { x: number; y: number }) => void;
  onPanChange: (pan: Pan) => void;
  onSelect: (id: string, additive: boolean) => void;
  onClearSelection: () => void;
  onHover: (id: string | null) => void;
  onStartEdit: (id: string) => void;
  onCommitEdit: (id: string, kind: string, html: string) => void;
  onContextMenu: (id: string, x: number, y: number) => void;
  onBeginDrag: (id: string, clientX: number, clientY: number) => void;
  onDragHover: (overId: string | null, edge: DragEdge) => void;
  onDragCommit: () => void;
  onDragCancel: () => void;
  onTableCellSelect: (id: string, fields: string[], additive: boolean) => void;
  onPatchBlock: (id: string, patch: Partial<EmailBlock>) => void;
  onTableWidthChange: (id: string, width: string) => void;
  onTableColumnWidthChange: (id: string, field: string, width: string) => void;
  onTableColumnLabelChange: (id: string, field: string, label: string) => void;
  onEditVariableExpression: (id: string, expression: string) => void;
  canMergeTableCells: boolean;
  canUnmergeTableCells: boolean;
  onMergeTableCells: () => void;
  onUnmergeTableCells: () => void;
};

export default function Workspace({
  blocks, tokens, components, selectedIds, hoverId, editingId, tableSelection, drag, zoom, pan,
  onZoomChange, onPanChange, onSelect, onClearSelection, onHover, onStartEdit, onCommitEdit, onContextMenu,
  onBeginDrag, onDragHover, onDragCommit, onDragCancel, onTableCellSelect, onTableWidthChange, onPatchBlock,
  onTableColumnWidthChange, onTableColumnLabelChange, onEditVariableExpression,
  canMergeTableCells, canUnmergeTableCells, onMergeTableCells, onUnmergeTableCells,
}: Props) {
  const {viewportRef, layerRef, spacePanning, beginPan, fitToScreen, resetZoom} = useCanvasViewport({
    zoom, pan, drag, onZoomChange, onPanChange, onDragHover, onDragCommit, onDragCancel,
  });

  const contextValue: CanvasContextValue = {
    tokens, components, selectedIds, hoverId, editingId, tableSelection, drag,
    onSelect, onHover, onStartEdit, onCommitEdit, onContextMenu, onBeginDrag, onTableCellSelect, onTableWidthChange,
    onTableColumnWidthChange, onTableColumnLabelChange, onEditVariableExpression,
  };

  return <section className="ee-workspace" aria-label="Lienzo del correo">
    <div className="ee-workspace-topbar">
      <span className="ee-workspace-tip">Clic selecciona · doble clic edita texto · arrastra para mover · espacio+arrastra para desplazar el lienzo</span>
      <div className="ee-workspace-actions">
        {canMergeTableCells && <button className="ee-btn" onClick={onMergeTableCells}>▦ Combinar celdas</button>}
        {canUnmergeTableCells && <button className="ee-btn" onClick={onUnmergeTableCells}>▤ Separar celdas</button>}
        <div className="ee-zoom-controls">
          <button aria-label="Ajustar a pantalla" title="Ajustar a pantalla (Mayús+1)" onClick={fitToScreen}>⤢</button>
          <button aria-label="Alejar" onClick={() => onZoomChange(Math.max(25, zoom - 10))}>−</button>
          <button className="ee-zoom-value" title="Restablecer (Mayús+0)" onClick={resetZoom}>{Math.round(zoom)}%</button>
          <button aria-label="Acercar" onClick={() => onZoomChange(Math.min(300, zoom + 10))}>+</button>
        </div>
      </div>
    </div>
    <div ref={viewportRef} className={`ee-viewport ${spacePanning ? "panning" : ""}`}
      onPointerDownCapture={beginPan}
      onClick={() => onClearSelection()}>
      <div ref={layerRef} className="ee-canvas-layer" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})` }}>
        <div className="ee-email-page"
          onClickCapture={event => { if((event.target as Element).closest("a,area,button,summary,[role='button']"))event.preventDefault(); }}
          onAuxClickCapture={event => { if((event.target as Element).closest("a,area"))event.preventDefault(); }}
          onSubmitCapture={event=>event.preventDefault()}
          onDragStartCapture={event=>event.preventDefault()}
          onClick={event => { event.stopPropagation(); onClearSelection(); }}>
          <CanvasContext.Provider value={contextValue}>
            {blocks.length
              ? <BlockRenderer blocks={blocks} />
              : <div className="ee-canvas-empty" style={{ color: "#9aa", position: "static" }}><span>◈</span><strong style={{ color: "#556074" }}>Lienzo vacío</strong><p>Arrastra un bloque desde la biblioteca para empezar.</p></div>}
          </CanvasContext.Provider>
        </div>
        <SelectionOverlay editingId={editingId} onBeginDrag={onBeginDrag} onContextMenu={onContextMenu} onPatchBlock={onPatchBlock} layerRef={layerRef} hoverId={hoverId} selectedIds={selectedIds} drag={drag} zoom={zoom / 100} blocks={blocks} />
      </div>
    </div>
  </section>;
}
