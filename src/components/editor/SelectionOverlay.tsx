import { useLayoutEffect, useState } from "react";
import TransformControls from "./TransformControls";
import { findEmailBlock } from "../../services/emailBlocks";
import type { EmailBlock } from "../../services/emailBlocks";
import type { DragState } from "../email-editor/canvasContext";

type Rect = { x: number; y: number; w: number; h: number };
type Props = {
  editingId?: string | null;
  onBeginDrag: (id: string, x: number, y: number) => void;
  onContextMenu: (id: string, x: number, y: number) => void;
  onPatchBlock: (id: string, patch: Partial<EmailBlock>) => void;
  layerRef: React.RefObject<HTMLElement>;
  hoverId: string | null;
  selectedIds: Set<string>;
  drag: DragState | null;
  zoom: number;
  blocks: EmailBlock[];
};

function rectOf(layer: HTMLElement, id: string, zoom: number): Rect | null {
  const node = layer.querySelector<HTMLElement>(`[data-ee-block-id="${id}"]`);
  if (!node) return null;
  const layerBox = layer.getBoundingClientRect();
  const box = node.getBoundingClientRect();
  return { x: (box.left - layerBox.left) / zoom, y: (box.top - layerBox.top) / zoom, w: box.width / zoom, h: box.height / zoom };
}

export default function SelectionOverlay({ layerRef, hoverId, selectedIds, drag, zoom, blocks, onPatchBlock, onBeginDrag, onContextMenu, editingId }: Props) {
  const [hoverRect, setHoverRect] = useState<Rect | null>(null);
  const [selectedRects, setSelectedRects] = useState<{ id: string; rect: Rect }[]>([]);
  const [insertionRect, setInsertionRect] = useState<{ rect: Rect; edge: "before" | "after" | "into" } | null>(null);

  useLayoutEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    setHoverRect(hoverId && !selectedIds.has(hoverId) ? rectOf(layer, hoverId, zoom) : null);
    setSelectedRects(Array.from(selectedIds).flatMap(id => { const rect = rectOf(layer, id, zoom); return rect ? [{ id, rect }] : []; }));
    if (drag?.overId) {
      const rect = rectOf(layer, drag.overId, zoom);
      setInsertionRect(rect ? { rect, edge: drag.overEdge } : null);
    } else setInsertionRect(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerRef, hoverId, selectedIds, drag?.overId, drag?.overEdge, zoom, blocks]);

  return <div className="ee-overlay-layer" style={{ width: "100%", height: "100%" }}>
    {hoverRect && <div className="ee-overlay-outline hover" style={{ left: hoverRect.x, top: hoverRect.y, width: hoverRect.w, height: hoverRect.h }} />}
    {selectedRects.map(({ id, rect }) => <div key={id} className="ee-overlay-outline selected" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} />)}
    {!drag && !editingId && selectedIds.size === 1 && selectedRects.map(({id,rect}) => {
      const block = findEmailBlock(blocks,id);
      return block && ["image","component","container","if","rich","paragraph","heading","button"].includes(block.type) ? <TransformControls onBeginDrag={onBeginDrag} onContextMenu={onContextMenu} key={id} block={block} rect={rect} layerRef={layerRef} zoom={zoom} onPatch={patch=>onPatchBlock(id,patch)} onPreview={()=>{
        const layer=layerRef.current;
        const next=layer && rectOf(layer,id,zoom);
        if(next)setSelectedRects([{id,rect:next}]);
      }}/> : null;
    })}
    {insertionRect && insertionRect.edge === "into" &&
      <div className="ee-overlay-outline selected" style={{ left: insertionRect.rect.x, top: insertionRect.rect.y, width: insertionRect.rect.w, height: insertionRect.rect.h, borderStyle: "dashed" }} />}
    {insertionRect && insertionRect.edge !== "into" && <div className="ee-overlay-insertion" style={{
      left: insertionRect.rect.x, width: insertionRect.rect.w, height: 2,
      top: insertionRect.edge === "before" ? insertionRect.rect.y - 1 : insertionRect.rect.y + insertionRect.rect.h - 1,
    }} />}
  </div>;
}
