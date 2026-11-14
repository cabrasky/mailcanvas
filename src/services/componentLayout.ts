import { normalizeTemplateMarkup } from "./templateMarkup";
import { boxStyles, type BlockStyles } from "../editor/blockLayout";

const visualRoots = new Set(["DIV","SECTION","HEADER","FOOTER","ARTICLE","ASIDE","FIGURE"]);
function parseVisualRoot(source: string) {
  if (typeof DOMParser === "undefined") return null;
  const document = new DOMParser().parseFromString(normalizeTemplateMarkup(source),"text/html");
  const root = document.body.firstElementChild as HTMLElement | null;
  return root && document.body.children.length === 1 && visualRoots.has(root.tagName) ? {document,root} : null;
}

/** Authored styles survive the reversible presentation applied to a resized instance. */
export function componentContent(source: string, styles: BlockStyles = {}): string {
  const parsed = parseVisualRoot(source);
  if (!parsed) return source;
  const {document,root} = parsed;
  const original = root.getAttribute("data-ee-fit-original-style");
  if (original !== null) {
    root.setAttribute("style",original);
    root.removeAttribute("data-ee-fit-original-style");
  }
  const width = !!styles.width && styles.width !== "auto";
  const height = !!styles.height && styles.height !== "auto";
  if (width || height) {
    root.setAttribute("data-ee-fit-original-style",root.getAttribute("style") || "");
    root.style.boxSizing = "border-box";
    root.style.minWidth = "0";
    if (width) { root.style.width = "100%"; root.style.maxWidth = "100%"; }
    if (height) {
      root.style.height = "100%";
      root.style.minHeight = "min-content";
      root.style.flexShrink = "0";
      if (styles.justifyContent && (!root.style.display || root.style.display === "block")) {
        Object.assign(root.style,{display:"flex",flexDirection:"column",justifyContent:styles.justifyContent});
      }
    }
  }
  return document.body.innerHTML;
}

export function componentLayout(source: string, styles: BlockStyles = {}): BlockStyles {
  const frame = boxStyles(styles);
  if (!styles.height || styles.height === "auto" || !parseVisualRoot(source)) return frame;
  return {...frame,display:"grid",gridTemplateColumns:"minmax(0, 1fr)",gridTemplateRows:"minmax(min-content, 1fr)",minHeight:styles.minHeight || "min-content"};
}
