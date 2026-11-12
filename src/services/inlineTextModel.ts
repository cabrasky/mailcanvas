import { isSafeInlineExpression, type InlineNode } from "./emailBlocks";

export const markerFor = (expression: string) => `\${${expression}}`;
export const inlineTextOf = (nodes: InlineNode[]): string => nodes.map(node => node.type === "text" ? node.text : node.type === "variable" ? markerFor(node.expression) : inlineTextOf(node.children)).join("");
export const inlineNodeLength = (nodes: InlineNode[]): number => nodes.reduce((length, node) => length + (node.type === "text" ? node.text.length : node.type === "variable" ? markerFor(node.expression).length : inlineNodeLength(node.children)), 0);
export function removeInlineRange(nodes: InlineNode[], start: number, end: number): InlineNode[] {
  let offset = 0;
  const result: InlineNode[] = [];
  for (const node of nodes) {
    const length = node.type === "text" ? node.text.length : node.type === "variable" ? markerFor(node.expression).length : inlineNodeLength(node.children);
    const from = Math.max(0, start - offset); const to = Math.min(length, end - offset);
    if (from >= to) result.push(node);
    else if (node.type === "text") { const value = node.text.slice(0, from) + node.text.slice(to); if (value) result.push({ type: "text", text: value }); }
    else if (node.type === "element") result.push({ ...node, children: removeInlineRange(node.children, from, to) });
    offset += length;
  }
  return result;
}
export function insertInlineVariable(nodes: InlineNode[], position: number, variable: Extract<InlineNode, { type: "variable" }>): InlineNode[] {
  let offset = 0; let inserted = false; const result: InlineNode[] = [];
  for (const node of nodes) {
    const length = node.type === "text" ? node.text.length : node.type === "variable" ? markerFor(node.expression).length : inlineNodeLength(node.children);
    if (!inserted && position <= offset + length) {
      const local = Math.max(0, position - offset);
      if (node.type === "text") result.push(...(node.text.slice(0, local) ? [{ type: "text" as const, text: node.text.slice(0, local) }] : []), variable,
        ...(node.text.slice(local) ? [{ type: "text" as const, text: node.text.slice(local) }] : []));
      else if (node.type === "element") result.push({ ...node, children: insertInlineVariable(node.children, local, variable) });
      else result.push(node, variable);
      inserted = true;
    } else result.push(node);
    offset += length;
  }
  return inserted ? result : [...result, variable];
}
export function parseInlineText(text: string): InlineNode[] {
  const result: InlineNode[] = [];
  const pattern = /\$\{([^{}]+)\}|\{\{\s*(?:=\s*([^{}]+)|([\w$.]+))\s*\}\}/g;
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > offset) result.push({ type: "text", text: text.slice(offset, index) });
    const expression = (match[1] ?? match[2] ?? match[3]).trim();
    if (!isSafeInlineExpression(expression)) {
      result.push({ type: "text", text: match[0] });
      offset = index + match[0].length;
      continue;
    }
    result.push({ type: "variable", expression, fallback: expression });
    offset = index + match[0].length;
  }
  if (offset < text.length) result.push({ type: "text", text: text.slice(offset) });
  return result;
}

