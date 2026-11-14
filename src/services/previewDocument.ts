/** Preview-only navigation: keep the editor open and preserve in-document anchors. */
export function previewDocument(html: string): string {
  if(typeof DOMParser === "undefined")return html;
  const doc=new DOMParser().parseFromString(html,"text/html");
  for(const link of doc.querySelectorAll<HTMLAnchorElement>("a[href],area[href]")) {
    const href=link.getAttribute("href")?.trim();
    if(!href)continue;
    link.setAttribute("target",href.startsWith("#")?"_self":"_blank");
    link.setAttribute("rel","noopener noreferrer");
  }
  return `<!doctype html>${doc.documentElement.outerHTML}`;
}
export const PREVIEW_SANDBOX = "allow-popups allow-popups-to-escape-sandbox";
