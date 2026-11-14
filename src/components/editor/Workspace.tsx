import { useEffect, useRef, useState } from "react";
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
  const viewportRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [spacePanning, setSpacePanning] = useState(false);
  const panDrag = useRef<{ startX: number; startY: number; startPan: Pan } | null>(null);

  useEffect(() => {
    const down = (event: KeyboardEvent) => { if (event.code === "Space" && !(event.target as HTMLElement)?.isContentEditable) setSpacePanning(true); };
    const up = (event: KeyboardEvent) => { if (event.code === "Space") setSpacePanning(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const dragPayload = drag?.payload;
  useEffect(() => {
    if (!dragPayload) return;
    const move = (event: PointerEvent) => {
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const blockEl = target?.closest<HTMLElement>("[data-ee-block-id]");
      if (!blockEl) { onDragHover(null, "before"); return; }
      const id = blockEl.dataset.eeBlockId!;
      const kind = blockEl.dataset.eeBlockKind!;
      if (dragPayload.type === "move" && id === dragPayload.id) { onDragHover(null, "before"); return; }
      const rect = blockEl.getBoundingClientRect();
      const canContain = kind === "container" || kind === "loop" || kind === "if";
      const relY = (event.clientY - rect.top) / rect.height;
      const edge: DragEdge = canContain && relY > 0.25 && relY < 0.75 ? "into" : relY < 0.5 ? "before" : "after";
      onDragHover(id, edge);
    };
    const up = () => onDragCommit();
    const cancelOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onDragCancel(); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    window.addEventListener("keydown", cancelOnEscape);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", cancelOnEscape);
    };
  }, [dragPayload, onDragHover, onDragCommit, onDragCancel]);

  const handleWheel = (event: React.WheelEvent) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const rect = viewportRef.current!.getBoundingClientRect();
      const cx = event.clientX - rect.left, cy = event.clientY - rect.top;
      const nextZoom = Math.max(25, Math.min(300, zoom * (1 - event.deltaY * 0.0015)));
      const factor = nextZoom / zoom;
      onPanChange({ x: cx - (cx - pan.x) * factor, y: cy - (cy - pan.y) * factor });
      onZoomChange(nextZoom);
      return;
    }
    onPanChange({ x: pan.x - event.deltaX, y: pan.y - event.deltaY });
  };

  const beginPan = (event: React.PointerEvent) => {
    if (!spacePanning && event.button !== 1) return;
    event.preventDefault();
    panDrag.current = { startX: event.clientX, startY: event.clientY, startPan: pan };
    const move = (moveEvent: PointerEvent) => {
      if (!panDrag.current) return;
      onPanChange({ x: panDrag.current.startPan.x + moveEvent.clientX - panDrag.current.startX, y: panDrag.current.startPan.y + moveEvent.clientY - panDrag.current.startY });
    };
    const finish = () => { panDrag.current = null; window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  };

  const fitToScreen = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const bounds = viewport.getBoundingClientRect();
    const pageHeight = layerRef.current?.querySelector(".ee-email-page")?.getBoundingClientRect().height ?? 700;
    const fit = Math.min(1.4, Math.max(0.25, Math.min((bounds.width - 80) / 600, (bounds.height - 80) / (pageHeight / (zoom / 100)))));
    onZoomChange(fit * 100);
    onPanChange({ x: (bounds.width - 600 * fit) / 2, y: 40 });
  };

  const resetZoom = () => {
    onPanChange({ x: ((viewportRef.current?.clientWidth ?? 780) - 600) / 2, y: pan.y });
    onZoomChange(100);
  };

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
      onWheel={handleWheel} onPointerDown={beginPan}
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
