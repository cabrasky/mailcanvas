export type Axis = "width" | "height";
export type SizeMode = "auto" | "fixed" | "relative" | "css";
export type BlockStyles = Record<string,string>;

export function sizeMode(value: string | undefined): SizeMode {
  if (!value || value === "auto") return "auto";
  if (/^[\d.]+px$/.test(value)) return "fixed";
  if (/^[\d.]+(?:%|em|rem|vw|vh)$/.test(value)) return "relative";
  return "css";
}

export function changeSizeMode(styles: BlockStyles, axis: Axis, mode: SizeMode): BlockStyles {
  const next: BlockStyles = {...styles,boxSizing:"border-box"};
  if (mode === "auto") { delete next[axis]; return next; }
  if (mode === "relative") return {...next,[axis]:"100%"};
  if (mode === "fixed") return {...next,[axis]:axis === "width" ? "300px" : "160px"};
  return {...next,[axis]:"fit-content"};
}

export function boxStyles(styles: BlockStyles = {}): BlockStyles {
  return {boxSizing:"border-box",minWidth:"0",...styles};
}
