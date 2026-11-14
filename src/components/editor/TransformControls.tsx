import { beginGesture, advanceGesture, finishGesture, type GesturePhase } from "../../editor/gestureMachine";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { positionAlignStyles, type EmailBlock } from "../../services/emailBlocks";
import { describeLength, snapSize } from "./canvasMeasurements";
import { relativeRect, resizeContext, resizePatch, type CanvasRect } from "../../editor/canvasGeometry";
import { usePointerSession } from "../../editor/usePointerSession";

type Props = {
  block: EmailBlock; rect: CanvasRect; layerRef: React.RefObject<HTMLElement>; zoom: number;
  onPatch: (patch: Partial<EmailBlock>) => void; onPreview: () => void;
  onBeginDrag: (id: string, x: number, y: number) => void;
  onContextMenu: (id: string, x: number, y: number) => void;
};
type Guide = { rect?: CanvasRect; line?: { x: number; y: number; height: number }; label: string };
const handles = [
  ["w", "izquierda"], ["e", "derecha"], ["n", "arriba"], ["s", "abajo"],
  ["nw", "esquina superior izquierda"], ["ne", "esquina superior derecha"],
  ["sw", "esquina inferior izquierda"], ["se", "esquina inferior derecha"],
] as const;

export default function TransformControls({ block, rect, layerRef, zoom, onPatch, onPreview, onBeginDrag, onContextMenu }: Props) {
  const session = usePointerSession();
  const moved = useRef(false);
  const [phase,setPhase] = useState<GesturePhase | "idle">("idle");
  const [guide, setGuide] = useState<Guide | null>(null);
  const [live, setLive] = useState<Record<string,string> | null>(null);
  const [slot, setSlot] = useState<Element | null>(null);
  const [margins, setMargins] = useState([0,0,0,0]);
  const target = () => layerRef.current?.querySelector<HTMLElement>(`[data-ee-block-id="${CSS.escape(block.id)}"]`);
  useLayoutEffect(() => {
    const node = target();
    if (!node) return;
    setSlot(node.closest(".ee-workspace")?.querySelector(".ee-workspace-tip") || null);
    const style = getComputedStyle(node);
    const next = [style.marginTop, style.marginRight, style.marginBottom, style.marginLeft].map(value => parseFloat(value) || 0);
    setMargins(current => current.every((value,index) => value === next[index]) ? current : next);
  }, [block, rect.x, rect.y, rect.w, rect.h]);

  const align = (position: "left"|"center"|"right") => ({ ...block.styles, ...positionAlignStyles(position, block.type, block.styles?.display) });
  const start = (event: React.PointerEvent, action: "align"|"resize", handle = "e") => {
    if (event.button !== 0) return;
    const node = target();
    const layer = layerRef.current;
    if (!node?.parentElement || !layer) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const capture = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const geometry = resizeContext(node, zoom);
    const original = node.getAttribute("style");
    const siblings = Array.from(geometry.parent.children).filter(element => element !== node && element.hasAttribute("data-ee-block-id"));
    let patch: Partial<EmailBlock> | undefined;
    let gesture = beginGesture(action,startX,startY);
    setPhase("pressed");
    moved.current = false;
    const snap = (value: number, axis: "width"|"height", disabled: boolean) => {
      const references = siblings.map(element => ({ value: element.getBoundingClientRect()[axis]/zoom, label: `Misma medida que ${element.textContent?.trim().slice(0,45) || element.getAttribute("data-ee-block-kind")}`, element }));
      const containerReferences = axis === "width" ? [
        { value: geometry.available, label: "Ancho del contenedor", element: geometry.parent },
        { value: geometry.available/2, label: "50 % del contenedor", element: geometry.parent },
      ] : [];
      const candidates = [...containerReferences, ...references];
      const result = snapSize(value, candidates.map(candidate => candidate.value), disabled ? 0 : 6/zoom);
      const reference = result.snapped ? candidates.find(candidate => candidate.value === result.value) : undefined;
      setGuide(reference ? { label: reference.label, rect: relativeRect(reference.element, layer, zoom) } : null);
      return result.value;
    };
    const cancel = session({
      move: pointer => {
        const dx = (pointer.clientX-startX)/zoom;
        const dy = (pointer.clientY-startY)/zoom;
        const previous = gesture.phase;
        gesture = advanceGesture(gesture,pointer.clientX,pointer.clientY);
        if (gesture.phase === "pressed") return;
        moved.current = true;
        if (gesture.phase !== previous) setPhase(gesture.phase);
        if (gesture.phase === "reordering") {
          cancel();
          if (capture.hasPointerCapture(pointerId)) capture.releasePointerCapture(pointerId);
          onBeginDrag(block.id,pointer.clientX,pointer.clientY);
          return;
        }
        if (action === "resize") {
          const vertical = handle === "n" || handle === "s";
          const corner = handle.length === 2;
          const deltaX = dx*(handle.includes("w") ? -1 : 1);
          const deltaY = dy*(handle.includes("n") ? -1 : 1);
          let width: number | undefined;
          let height: number | undefined;
          if (vertical) height = Math.max(16, Math.round(snap(geometry.height+deltaY, "height", pointer.altKey)));
          else {
            const ratioDelta = deltaY*geometry.width/Math.max(1,geometry.height);
            const delta = corner && block.type === "image" && Math.abs(ratioDelta)>Math.abs(deltaX) ? ratioDelta : deltaX;
            width = Math.max(16, Math.min(geometry.available, Math.round(snap(geometry.width+delta, "width", pointer.altKey))));
            if (corner && block.type !== "image") height = Math.max(16, Math.round(geometry.height+deltaY));
          }
          patch = resizePatch(block, geometry, width, height);
          if (corner && block.type === "image") patch.styles = { ...patch.styles, height: "auto" };
        } else {
          const proposed = (geometry.box.left+geometry.box.right)/2 + pointer.clientX-startX;
          const left = geometry.left;
          const right = left+geometry.available*zoom;
          const center = (left+right)/2;
          const anchors = [
            { position: "left" as const, center: left+geometry.box.width/2, line: left, label: "Izquierda" },
            { position: "center" as const, center, line: center, label: "Centro" },
            { position: "right" as const, center: right-geometry.box.width/2, line: right, label: "Derecha" },
          ];
          const anchor = anchors.reduce((best,item) => Math.abs(item.center-proposed)<Math.abs(best.center-proposed) ? item : best);
          patch = { styles: align(anchor.position) };
          const origin = layer.getBoundingClientRect();
          setGuide({ label: anchor.label, line: { x: (anchor.line-origin.left)/zoom, y: (geometry.parentBox.top-origin.top)/zoom, height: geometry.parentBox.height/zoom } });
        }
        Object.assign(node.style, patch.styles);
        setLive(patch.styles || null);
        onPreview();
      },
      finish: commit => {
        gesture = finishGesture(gesture,commit);
        setPhase("idle");
        if (original === null) node.removeAttribute("style"); else node.setAttribute("style", original);
        setLive(null); setGuide(null);
        if (commit && patch) onPatch(patch);
        onPreview();
      },
    });
  };

  const forward = (event: React.MouseEvent, type: "click"|"dblclick") => {
    event.stopPropagation();
    if (type === "click" && moved.current) return;
    const surface = event.currentTarget as HTMLElement;
    surface.style.pointerEvents = "none";
    const underlying = document.elementFromPoint?.(event.clientX, event.clientY);
    surface.style.pointerEvents = "";
    underlying?.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: event.clientX, clientY: event.clientY, shiftKey: event.shiftKey }));
  };
  const styles = live || block.styles || {};
  const width = styles.width || (block.type === "image" && block.width ? `${block.width}px` : undefined);
  const measurements = <div className="ee-transform-measurements" role="status">
    <span>Ancho: {describeLength(width)} · Alto: {describeLength(styles.height)}</span>
    <span>Margen: {["Top","Right","Bottom","Left"].map(side => styles[`margin${side}`] || styles.margin || "0").join(" / ")} · Interior: {describeLength(styles.padding || "0px")}</span>
    {guide?.rect && <strong>{guide.label} · Alt para ignorar</strong>}
  </div>;

  return <div className="ee-transform-controls" data-gesture={phase} style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} onClick={event => event.stopPropagation()}>
    {margins.map((size,index) => size > 0 && <div key={index} className="ee-transform-margin" style={[
      { left: 0, top: -size, width: "100%", height: size }, { left: "100%", top: 0, width: size, height: "100%" },
      { left: 0, top: "100%", width: "100%", height: size }, { left: -size, top: 0, width: size, height: "100%" },
    ][index]} />)}
    {slot && createPortal(measurements,slot)}
    {guide?.rect && <><div className="ee-transform-size-guide" /><div className="ee-transform-size-guide" style={{ left: guide.rect.x-rect.x, top: guide.rect.y-rect.y, width: guide.rect.w, height: guide.rect.h }} /></>}
    {guide?.line && <div className="ee-transform-guide" data-alignment={guide.label} style={{ left: guide.line.x-rect.x, top: guide.line.y-rect.y, height: guide.line.height }}><span>{guide.label}</span></div>}
    <button type="button" className="ee-transform-drag-surface" aria-label={block.type === "image" ? "Mover imagen para alinear" : "Mover bloque para alinear"}
      title="Arrastra horizontalmente para alinear o verticalmente para cambiar de posición"
      onPointerDown={event => start(event,"align")} onClick={event => forward(event,"click")} onDoubleClick={event => forward(event,"dblclick")}
      onContextMenu={event => { event.preventDefault(); event.stopPropagation(); onContextMenu(block.id,event.clientX,event.clientY); }}
      onKeyDown={event => {
        const position = event.key === "ArrowLeft" ? "left" : event.key === "ArrowRight" ? "right" : event.key === "Home" ? "center" : null;
        if (position) { event.preventDefault(); event.stopPropagation(); onPatch({ styles: align(position) }); }
      }} />
    {handles.map(([handle,label]) => <button type="button" key={handle} className={`ee-transform-resize handle-${handle}`} aria-label={`Redimensionar desde ${label}`}
      title="Lados: ancho o alto. Esquinas: ambos ejes. Flechas: 1 px; Mayús: 10 px. Escape cancela."
      onPointerDown={event => start(event,"resize",handle)} onKeyDown={event => {
        if (!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const node = target(); if (!node?.parentElement) return;
        const vertical = handle === "n" || handle === "s";
        const step = (["ArrowRight","ArrowDown"].includes(event.key) ? 1 : -1)*(event.shiftKey ? 10 : 1);
        const value = Math.max(16, Math.round((vertical ? rect.h : rect.w)+step));
        onPatch(resizePatch(block,resizeContext(node,zoom),vertical ? undefined : value,vertical ? value : undefined));
      }} />)}
  </div>;
}
