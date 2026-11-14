/** Keep authored units while manipulating their rendered pixel dimensions. */
export function resizedLength(pixels: number, authored: string | undefined, reference: number, fontSize = 16, rootFontSize = 16, viewport = {width: 0, height: 0}): string {
  const unit=authored?.trim().match(/^-?[\d.]+(%|rem|em|vw|vh|pt|px)$/)?.[1] || "px";
  const scale=unit==="%"?reference/100:unit==="em"?fontSize:unit==="rem"?rootFontSize:unit==="vw"?viewport.width/100:unit==="vh"?viewport.height/100:unit==="pt"?96/72:1;
  return `${Math.round(pixels/(scale||1)*100)/100}${unit}`;
}
export function describeLength(value: string | undefined): string {
  if(!value || value==="auto")return "auto";
  return `${value} · ${/(%|rem|em|vw|vh)$/.test(value)?"relativo":/^[\d.]+(px|pt|cm|mm|in)$/.test(value)?"fijo":"CSS"}`;
}
export function snapSize(value: number, candidates: number[], threshold: number): {value:number;snapped:boolean} {
  const nearest=candidates.reduce((best,candidate)=>Math.abs(candidate-value)<Math.abs(best-value)?candidate:best,Infinity);
  return Number.isFinite(nearest)&&Math.abs(nearest-value)<=threshold?{value:nearest,snapped:true}:{value,snapped:false};
}
