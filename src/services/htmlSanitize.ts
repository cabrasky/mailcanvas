import { normalizeTemplateMarkup } from "./templateMarkup";
/** Strips script-like content from HTML that is about to be rendered live in the canvas (not inside a sandboxed iframe). */
export function sanitizeHtmlForDisplay(html: string): string {
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(`<div>${normalizeTemplateMarkup(html)}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return "";
  root.querySelectorAll("script,iframe,object,embed,form,style,link").forEach(element => element.remove());
  root.querySelectorAll("*").forEach(element => {
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name);
    }
    for (const name of ["href", "src"]) {
      const value = element.getAttribute(name);
      if (value && /^\s*(?:javascript|data|vbscript):/i.test(value)) element.setAttribute(name, "#");
    }
  });
  return root.innerHTML;
}

const inlineTags = new Set(["span", "strong", "b", "em", "i", "u", "small", "sup", "sub", "ins", "del", "a", "br", "mark", "code"]);

/** Whether an HTML fragment's root element is inline-level, so a wrapper can stay `display:inline` and flow with its siblings. */
export function isInlineHtmlRoot(html: string): boolean {
  const tag = /^<\s*([a-zA-Z][\w-]*)/.exec(html.trim())?.[1]?.toLowerCase();
  return !!tag && inlineTags.has(tag);
}
