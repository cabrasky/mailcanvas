import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { findEmailBlock, type EmailBlock } from "../../services/emailBlocks";
import { relativeRect, type CanvasRect } from "../../editor/canvasGeometry";
import type { DragState } from "../email-editor/canvasContext";
import TransformControls from "./TransformControls";

type Props = {
  layerRef: React.RefObject<HTMLElement>; hoverId: string | null; selectedIds: Set<string>;
  drag: DragState | null; zoom: number; blocks: EmailBlock[]; editingId?: string | null;
  onBeginDrag: (id: string, x: number, y: number) => void;
  onContextMenu: (id: string, x: number, y: number) => void;
  onPatchBlock: (id: string, patch: Partial<EmailBlock>) => void;
};
type Geometry = { selected: {id:string;rect:CanvasRect}[]; hover: CanvasRect|null; insertion: CanvasRect|null };
const transformable = new Set(["image","component","container","if","rich","paragraph","heading","button"]);

export default function SelectionOverlay(props: Props) {
  const latest = useRef(props); latest.current = props;
  const [geometry, setGeometry] = useState<Geometry>({ selected: [], hover: null, insertion: null });
  const measureRef = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    const layer = props.layerRef.current;
    if (!layer) return;
    let pending = 0;
    const measure = () => {
      pending = 0;
      const current = latest.current;
      const rect = (id: string | null) => {
        if (!id) return null;
        const node = layer.querySelector(`[data-ee-block-id="${CSS.escape(id)}"]`);
        return node ? relativeRect(node,layer,current.zoom) : null;
      };
      const next: Geometry = {
        selected: [...current.selectedIds].flatMap(id => { const box = rect(id); return box ? [{ id, rect: box }] : []; }),
        hover: current.hoverId && !current.selectedIds.has(current.hoverId) ? rect(current.hoverId) : null,
        insertion: rect(current.drag?.overId || null),
      };
      setGeometry(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    const schedule = () => { if (!pending) pending = requestAnimationFrame(measure); };
    const page = layer.querySelector(".ee-email-page");
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    if (page) observer?.observe(page);
    const mutations = typeof MutationObserver === "undefined" ? null : new MutationObserver(schedule);
    if (page) mutations?.observe(page, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "src", "class"] });
    layer.addEventListener("load", schedule, true);
    measureRef.current = measure;
    measure();
    return () => {
      cancelAnimationFrame(pending); observer?.disconnect(); mutations?.disconnect();
      layer.removeEventListener("load", schedule, true); measureRef.current = () => {};
    };
  }, [props.layerRef]);
  useEffect(() => { measureRef.current(); }, [props.blocks, props.selectedIds, props.hoverId, props.drag?.overId, props.drag?.overEdge, props.zoom]);
  const style = (rect: CanvasRect) => ({ left: rect.x, top: rect.y, width: rect.w, height: rect.h });

  return <div className="ee-overlay-layer" style={{ width: "100%", height: "100%" }}>
    {geometry.hover && <div className="ee-overlay-outline hover" style={style(geometry.hover)} />}
    {geometry.selected.map(({id,rect}) => <div key={id} className="ee-overlay-outline selected" style={style(rect)} />)}
    {!props.drag && !props.editingId && props.selectedIds.size === 1 && geometry.selected.map(({id,rect}) => {
      const block = findEmailBlock(props.blocks,id);
      return block && transformable.has(block.type) ? <TransformControls key={id} block={block} rect={rect}
        layerRef={props.layerRef} zoom={props.zoom} onPatch={patch => props.onPatchBlock(id,patch)}
        onPreview={() => measureRef.current()} onBeginDrag={props.onBeginDrag} onContextMenu={props.onContextMenu} /> : null;
    })}
    {geometry.insertion && props.drag?.overEdge === "into" && <div className="ee-overlay-outline selected" style={{ ...style(geometry.insertion), borderStyle: "dashed" }} />}
    {geometry.insertion && props.drag?.overEdge !== "into" && <div className="ee-overlay-insertion" style={{
      left: geometry.insertion.x, width: geometry.insertion.w, height: 2,
      top: props.drag?.overEdge === "before" ? geometry.insertion.y-1 : geometry.insertion.y+geometry.insertion.h-1,
    }} />}
  </div>;
}
