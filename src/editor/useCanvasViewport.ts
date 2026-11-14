import { useEffect, useRef, useState } from "react";
import type React from "react";
import type { DragEdge, DragState } from "../components/email-editor/canvasContext";
import { usePointerSession } from "./usePointerSession";

type Point = { x: number; y: number };
type Options = {
  zoom: number; pan: Point; drag: DragState | null;
  onZoomChange: (zoom: number) => void; onPanChange: (pan: Point) => void;
  onDragHover: (id: string | null, edge: DragEdge) => void;
  onDragCommit: () => void; onDragCancel: () => void;
};

export function useCanvasViewport(options: Options) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const latest = useRef(options); latest.current = options;
  const [space, setSpace] = useState(false);
  const beginSession = usePointerSession();
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const key = (event: KeyboardEvent) => {
      const editor = viewport.closest(".email-editor");
      if (!editor?.contains(document.activeElement)) return;
      const target = event.target as HTMLElement;
      if (target.closest("input,textarea,select,[contenteditable='true']")) return;
      if (event.code === "Space") { event.preventDefault(); setSpace(event.type === "keydown"); }
    };
    const release = () => setSpace(false);
    const releaseSpace = (event: KeyboardEvent) => { if (event.code === "Space") setSpace(false); };
    const wheel = (event: WheelEvent) => {
      const current = latest.current;
      if (!event.ctrlKey && !event.metaKey) {
        event.preventDefault(); current.onPanChange({ x: current.pan.x-event.deltaX, y: current.pan.y-event.deltaY }); return;
      }
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const x = event.clientX-rect.left, y = event.clientY-rect.top;
      const zoom = Math.max(25,Math.min(300,current.zoom*(1-event.deltaY*0.0015)));
      const factor = zoom/current.zoom;
      current.onPanChange({ x: x-(x-current.pan.x)*factor, y: y-(y-current.pan.y)*factor });
      current.onZoomChange(zoom);
    };
    window.addEventListener("keydown",key);
    window.addEventListener("keyup",key);
    window.addEventListener("keyup",releaseSpace);
    window.addEventListener("blur",release);
    viewport.addEventListener("wheel",wheel,{ passive: false });
    return () => {
      window.removeEventListener("keydown",key); window.removeEventListener("keyup",key);
      window.removeEventListener("keyup",releaseSpace); window.removeEventListener("blur",release);
      viewport.removeEventListener("wheel",wheel);
    };
  }, []);
  const payload = options.drag?.payload;
  useEffect(() => {
    if (!payload) return;
    const move = (event: PointerEvent) => {
      const element = document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>("[data-ee-block-id]");
      const layer = layerRef.current;
      if (!element || !layer?.contains(element)) { latest.current.onDragHover(null,"before"); return; }
      const id = element.dataset.eeBlockId!;
      if (payload.type === "move") {
        const moving = layer.querySelector(`[data-ee-block-id="${CSS.escape(payload.id)}"]`);
        if (moving?.contains(element)) { latest.current.onDragHover(null,"before"); return; }
      }
      const box = element.getBoundingClientRect();
      const relative = (event.clientY-box.top)/Math.max(1,box.height);
      const container = ["container","loop","if"].includes(element.dataset.eeBlockKind || "");
      latest.current.onDragHover(id,container && relative>0.25 && relative<0.75 ? "into" : relative<0.5 ? "before" : "after");
    };
    const commit = () => latest.current.onDragCommit();
    const cancel = () => latest.current.onDragCancel();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") cancel(); };
    window.addEventListener("pointermove",move); window.addEventListener("pointerup",commit);
    window.addEventListener("pointercancel",cancel); window.addEventListener("blur",cancel); window.addEventListener("keydown",escape);
    return () => {
      window.removeEventListener("pointermove",move); window.removeEventListener("pointerup",commit);
      window.removeEventListener("pointercancel",cancel); window.removeEventListener("blur",cancel); window.removeEventListener("keydown",escape);
    };
  }, [payload]);
  const beginPan = (event: React.PointerEvent) => {
    const field = (event.target as HTMLElement).closest("input,textarea,select,[contenteditable='true']");
    if (!field) viewportRef.current?.closest<HTMLElement>(".email-editor")?.focus({ preventScroll: true });
    if (!space && event.button !== 1) return;
    event.preventDefault(); event.stopPropagation();
    const start = { x: event.clientX, y: event.clientY, pan: options.pan };
    beginSession({
      move: pointer => latest.current.onPanChange({ x: start.pan.x+pointer.clientX-start.x, y: start.pan.y+pointer.clientY-start.y }),
      finish: commit => { if (!commit) latest.current.onPanChange(start.pan); },
    });
  };
  const fitToScreen = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const box = viewport.getBoundingClientRect();
    const page = layerRef.current?.querySelector(".ee-email-page");
    const height = (page?.getBoundingClientRect().height || 700)/(options.zoom/100);
    const scale = Math.min(1.4,Math.max(0.25,Math.min((box.width-80)/600,(box.height-80)/height)));
    options.onZoomChange(scale*100); options.onPanChange({ x: (box.width-600*scale)/2, y: 40 });
  };
  const resetZoom = () => {
    options.onZoomChange(100);
    options.onPanChange({ x: ((viewportRef.current?.clientWidth || 780)-600)/2, y: options.pan.y });
  };
  return { viewportRef, layerRef, spacePanning: space, beginPan, fitToScreen, resetZoom };
}
