import { createEmailBlock, type BlockKind, type EmailBlock } from "./emailBlocks";
import type { EmailToken } from "./emailTemplateRenderer";

export function getSampleObjectPaths(value: unknown, prefix = "", depth = 0): string[] {
  if (depth > 2 || !value || typeof value !== "object") return [];
  const source = Array.isArray(value) ? value[0] : value;
  if (!source || typeof source !== "object") return [];
  return Object.entries(source).flatMap(([key, child]) => {
    if (!/^[\w$]+$/.test(key)) return [];
    const current = prefix ? `${prefix}.${key}` : key;
    return [current, ...getSampleObjectPaths(child, current, depth + 1)];
  });
}

export function createEditorBlock(kind: BlockKind, tokens: EmailToken[], id: string): EmailBlock {
  const block = createEmailBlock(kind, tokens, id);
  if (block.type !== "table") return block;
  const table = { ...block, fields: getSampleObjectPaths(tokens.find(token => token.varName === block.collection)?.sample).slice(0, 3) };
  return table;
}
