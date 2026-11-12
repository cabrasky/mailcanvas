import type { EmailBlock } from "./emailBlocks";

const isContainer = (block: EmailBlock): block is Extract<EmailBlock, { type: "container" | "loop" | "if" }> =>
  block.type === "container" || block.type === "loop" || block.type === "if";

export function updateEmailBlock(
  blocks: EmailBlock[],
  id: string,
  update: (block: EmailBlock) => EmailBlock,
): EmailBlock[] {
  return blocks.map(block => {
    if (block.id === id) return update(block);
    if (isContainer(block)) {
      return { ...block, children: updateEmailBlock(block.children, id, update) };
    }
    return block;
  });
}

export function insertEmailBlock(blocks: EmailBlock[], containerId: string | null, inserted: EmailBlock): EmailBlock[] {
  if (!containerId) return [...blocks, inserted];
  return blocks.map(block => {
    if (block.id === containerId && isContainer(block)) {
      return { ...block, children: [...block.children, inserted] };
    }
    if (isContainer(block)) {
      return { ...block, children: insertEmailBlock(block.children, containerId, inserted) };
    }
    return block;
  });
}

export function removeEmailBlock(blocks: EmailBlock[], id: string): EmailBlock[] {
  return blocks.filter(block => block.id !== id).map(block =>
    isContainer(block)
      ? { ...block, children: removeEmailBlock(block.children, id) }
      : block
  );
}

export function moveEmailBlock(blocks: EmailBlock[], id: string, direction: -1 | 1): EmailBlock[] {
  const index = blocks.findIndex(block => block.id === id);
  if (index >= 0) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return blocks;
    const moved = [...blocks];
    [moved[index], moved[target]] = [moved[target], moved[index]];
    return moved;
  }
  return blocks.map(block => isContainer(block)
    ? { ...block, children: moveEmailBlock(block.children, id, direction) }
    : block
  );
}

function containsBlock(block: EmailBlock, id: string): boolean {
  if (block.id === id) return true;
  return isContainer(block) && block.children.some(child => containsBlock(child, id));
}

function takeEmailBlock(blocks: EmailBlock[], id: string): { blocks: EmailBlock[]; taken?: EmailBlock } {
  const index = blocks.findIndex(block => block.id === id);
  if (index >= 0) {
    const next = [...blocks];
    const [taken] = next.splice(index, 1);
    return { blocks: next, taken };
  }
  let taken: EmailBlock | undefined;
  const next = blocks.map(block => {
    if (taken || !isContainer(block)) return block;
    const result = takeEmailBlock(block.children, id);
    taken = result.taken;
    return taken ? { ...block, children: result.blocks } : block;
  });
  return { blocks: next, taken };
}

export function moveEmailBlockToContainer(
  blocks: EmailBlock[],
  id: string,
  containerId: string | null,
): EmailBlock[] {
  const moving = findEmailBlock(blocks, id);
  if (!moving || moving.type === "html" || moving.id === containerId || (containerId && containsBlock(moving, containerId))) return blocks;
  if (containerId) {
    const container = findEmailBlock(blocks, containerId);
    if (!container || !isContainer(container)) return blocks;
  }
  const result = takeEmailBlock(blocks, id);
  return result.taken ? insertEmailBlock(result.blocks, containerId, result.taken) : blocks;
}

export function moveEmailBlockBefore(blocks: EmailBlock[], movingId: string, targetId: string): EmailBlock[] {
  if (movingId === targetId || !findEmailBlock(blocks, movingId) || !findEmailBlock(blocks, targetId)) return blocks;
  const extracted = takeEmailBlock(blocks, movingId);
  if (!extracted.taken) return blocks;
  const insertBefore = (items: EmailBlock[]): { items: EmailBlock[]; inserted: boolean } => {
    const index = items.findIndex(block => block.id === targetId);
    if (index >= 0) {
      const next = [...items];
      next.splice(index, 0, extracted.taken!);
      return { items: next, inserted: true };
    }
    for (let i = 0; i < items.length; i++) {
      const block = items[i];
      if (!isContainer(block)) continue;
      const nested = insertBefore(block.children);
      if (nested.inserted) {
        const next = [...items];
        next[i] = { ...block, children: nested.items };
        return { items: next, inserted: true };
      }
    }
    return { items, inserted: false };
  };
  const result = insertBefore(extracted.blocks);
  return result.inserted ? result.items : blocks;
}

export function moveEmailBlockAfter(blocks: EmailBlock[], movingId: string, targetId: string): EmailBlock[] {
  if (movingId === targetId || !findEmailBlock(blocks, movingId) || !findEmailBlock(blocks, targetId)) return blocks;
  const extracted = takeEmailBlock(blocks, movingId);
  if (!extracted.taken) return blocks;
  const insertAfter = (items: EmailBlock[]): { items: EmailBlock[]; inserted: boolean } => {
    const index = items.findIndex(block => block.id === targetId);
    if (index >= 0) {
      const next = [...items];
      next.splice(index + 1, 0, extracted.taken!);
      return { items: next, inserted: true };
    }
    for (let i = 0; i < items.length; i++) {
      const block = items[i];
      if (!isContainer(block)) continue;
      const nested = insertAfter(block.children);
      if (nested.inserted) {
        const next = [...items];
        next[i] = { ...block, children: nested.items };
        return { items: next, inserted: true };
      }
    }
    return { items, inserted: false };
  };
  const result = insertAfter(extracted.blocks);
  return result.inserted ? result.items : blocks;
}

export function duplicateEmailBlock(blocks: EmailBlock[], id: string, createId: () => string): { blocks: EmailBlock[]; duplicatedId: string | null } {
  let duplicatedId: string | null = null;
  const cloneTree = (block: EmailBlock): EmailBlock => {
    const newId = createId();
    const copy = { ...block, id: newId, className: block.className ? `${block.className}-copy-${newId}` : undefined } as EmailBlock;
    if (isContainer(copy)) copy.children = block.type === "container" || block.type === "loop" || block.type === "if" ? block.children.map(cloneTree) : [];
    return copy;
  };
  const insert = (items: EmailBlock[]): EmailBlock[] => {
    const index = items.findIndex(block => block.id === id);
    if (index >= 0) {
      const copy = cloneTree(items[index]); duplicatedId = copy.id;
      return [...items.slice(0, index + 1), copy, ...items.slice(index + 1)];
    }
    return items.map(block => isContainer(block) ? { ...block, children: insert(block.children) } : block);
  };
  return { blocks: insert(blocks), duplicatedId };
}

export function findEmailBlock(blocks: EmailBlock[], id: string): EmailBlock | undefined {
  for (const block of blocks) {
    if (block.id === id) return block;
    if (isContainer(block)) {
      const nested = findEmailBlock(block.children, id);
      if (nested) return nested;
    }
  }
  return undefined;
}
