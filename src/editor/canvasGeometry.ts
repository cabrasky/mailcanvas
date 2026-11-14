import type { EmailBlock } from "../services/emailBlocks";
import { resizedLength } from "../components/editor/canvasMeasurements";

export type CanvasRect = { x: number; y: number; w: number; h: number };
export function relativeRect(node: Element, layer: Element, zoom: number): CanvasRect {
  const box = node.getBoundingClientRect();
  const origin = layer.getBoundingClientRect();
  return { x: (box.left-origin.left)/zoom, y: (box.top-origin.top)/zoom, w: box.width/zoom, h: box.height/zoom };
}

export function resizeContext(node: HTMLElement, zoom: number) {
  const parent = node.parentElement!;
  const parentStyle = getComputedStyle(parent);
  const style = getComputedStyle(node);
  const box = node.getBoundingClientRect();
  const parentBox = parent.getBoundingClientRect();
  const available = parent.clientWidth - parseFloat(parentStyle.paddingLeft || "0") - parseFloat(parentStyle.paddingRight || "0");
  const font = parseFloat(style.fontSize) || 16;
  const rootFont = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  return {
    parent, box, parentBox, available, width: box.width/zoom, height: box.height/zoom,
    left: parentBox.left + (parent.clientLeft + parseFloat(parentStyle.paddingLeft || "0"))*zoom,
    length: (pixels: number, axis: "width"|"height", authored?: string) => resizedLength(pixels, authored, axis === "width" ? available : parent.clientHeight, font, rootFont, viewport),
  };
}

export function resizePatch(block: EmailBlock, geometry: ReturnType<typeof resizeContext>, width?: number, height?: number): Partial<EmailBlock> {
  const styles: Record<string,string> = { ...block.styles, boxSizing: "border-box" };
  if (width !== undefined) {
    styles.width = geometry.length(width, "width", block.styles?.width);
    styles.maxWidth = block.styles?.maxWidth || "100%";
  }
  if (height !== undefined) styles.height = geometry.length(height, "height", block.styles?.height);
  if (block.type === "image") {
    styles.objectFit = block.styles?.objectFit || "contain";
    if (width !== undefined && height === undefined) styles.height = block.styles?.height || "auto";
    return { width: width === undefined ? block.width : String(width), styles };
  }
  return { styles };
}

