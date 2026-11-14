export const edges = [["Top","Arriba"],["Right","Derecha"],["Bottom","Abajo"],["Left","Izquierda"]] as const;
export type Edge = typeof edges[number][0];
export type Spacing = "padding"|"margin";
export function readEdge(styles:Record<string,string>,kind:Spacing,side:Edge):string {
  if (styles[`${kind}${side}`] !== undefined) return styles[`${kind}${side}`];
  if (typeof document === "undefined") return styles[kind] || "";
  const declaration=document.createElement("div").style;
  declaration.setProperty(kind,styles[kind] || "");
  return declaration.getPropertyValue(`${kind}-${side.toLowerCase()}`);
}
export function setSpacing(styles:Record<string,string>,kind:Spacing,value:string):Record<string,string> {
  const next={...styles,[kind]:value};
  for(const [side] of edges)delete next[`${kind}${side}`];
  return next;
}
