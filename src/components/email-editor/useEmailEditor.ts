import type { EmailComponent } from "../../services/emailComponents";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type React from "react";
import type { EditorMode } from "../editor/EditorToolbar";
import { renderEmail, type CommonElements, type EmailToken } from "../../services/emailTemplateRenderer";
import {
  createEmailBlock, duplicateEmailBlock, emailBlocksToHtml, findEmailBlock, insertEmailBlock, moveEmailBlock,
  moveEmailBlockAfter, moveEmailBlockBefore, moveEmailBlockToContainer, parseEmailHtmlToBlocks, parseInlineHtmlToNodes,
  removeEmailBlock, updateEmailBlock, type BlockKind, type EmailBlock,
} from "../../services/emailBlocks";
import { createEditorBlock, getSampleObjectPaths } from "../../services/emailBlockActions";
import { documentReducer, initialDocumentState } from "./documentReducer";
import type { DragEdge, DragPayload, DragState } from "./canvasContext";
import type { Pan } from "../editor/Workspace";

type EditorStateOptions = { value: string; onChange: (value: string) => void; tokens: EmailToken[]; templateKey: string; commonElements: CommonElements };
export type ContextMenuTarget = { id: string; x: number; y: number };

export function useEmailEditor({ value, onChange, tokens, templateKey, commonElements }: EditorStateOptions) {
  const [mode, setMode] = useState<EditorMode>("blocks");
  const [compare, setCompare] = useState(false);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [leftTab, setLeftTab] = useState<"layers" | "insert">("insert");
  const [editorRatio, setEditorRatio] = useState(62);
  const mainRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuTarget | null>(null);
  const openContextMenu = (id: string, x: number, y: number) => setContextMenu({ id, x: Math.max(8, Math.min(x, window.innerWidth - 190)), y: Math.max(8, Math.min(y, window.innerHeight - 170)) });

  const [doc, dispatch] = useReducer(documentReducer, parseEmailHtmlToBlocks(value), initialDocumentState);
  const blocks = doc.blocks;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tableSelection, setTableSelection] = useState<{ id: string; fields: string[] } | null>(null);
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState<Pan>({ x: 80, y: 40 });
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dirty, setDirty] = useState(false);
  const lastGenerated = useRef<string | null>(null);
  const nextId = useRef(0);
  const newId = () => `block-${++nextId.current}`;

  const selectedId = selectedIds.size === 1 ? [...selectedIds][0] : null;
  const selected = selectedId ? findEmailBlock(blocks, selectedId) : undefined;

  useEffect(() => { if (tableSelection && tableSelection.id !== selectedId) setTableSelection(null); }, [selectedId, tableSelection]);
  const selectedTableFields = tableSelection?.id === selectedId ? tableSelection.fields : [];
  const selectedMergedGroup = selected?.type === "table" ? selected.mergedColumns?.find(group => group.length === selectedTableFields.length && group.every(field => selectedTableFields.includes(field))) : undefined;
  const selectedIndexes = selected?.type === "table" ? selectedTableFields.map(field => selected.fields.indexOf(field)).sort((a, b) => a - b) : [];
  const selectedFieldsAreAdjacent = selectedIndexes.length > 1 && selectedIndexes.every((index, position) => index >= 0 && (position === 0 || index === selectedIndexes[position - 1] + 1));
  const canMergeTableCells = !!(selected?.type === "table" && selectedFieldsAreAdjacent && !selected.mergedColumns?.some(group => group.some(field => selectedTableFields.includes(field))));

  const selectedLoopCollection = useMemo(() => {
    const find = (items: EmailBlock[], id: string, loop?: string): string | undefined => {
      for (const block of items) {
        if (block.id === id) return loop;
        if (block.type === "container" || block.type === "loop" || block.type === "if") {
          const value = find(block.children, id, block.type === "loop" ? block.collection : loop);
          if (value) return value;
        }
      }
    };
    return selectedId ? find(blocks, selectedId) : undefined;
  }, [blocks, selectedId]);

  const preview = useMemo(() => renderEmail(mode === "blocks" ? emailBlocksToHtml(blocks,{components:commonElements.components,editorMetadata:true}) : value, tokens, templateKey, commonElements), [value, blocks, mode, tokens, templateKey, commonElements]);
  const hasThymeleaf = /\bth:/.test(value);

  useEffect(() => {
    if (lastGenerated.current === value) { lastGenerated.current = null; return; }
    if (mode === "code") return;
    dispatch({ type: "reset", blocks: parseEmailHtmlToBlocks(value) });
    setSelectedIds(new Set()); setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, mode]);

  const publish = (next: EmailBlock[], record = true) => {
    dispatch({ type: "publish", blocks: next, record });
    const html = emailBlocksToHtml(next,{components:commonElements.components});
    lastGenerated.current = html;
    setDirty(true);
    onChange(html);
  };

  const createComponent = (definition:EmailComponent) => {
    const id=newId();
    const block:EmailBlock={id,type:"component",componentKey:definition.key,name:definition.name,values:{},fallbackHtml:definition.html,properties:definition.properties};
    publish(insertEmailBlock(blocks,null,block));setSelectedIds(new Set([id]));
  };
  const create = (kind: BlockKind) => {
    const id = newId();
    publish(insertEmailBlock(blocks, null, createEditorBlock(kind, tokens, id)));
    setSelectedIds(new Set([id]));
  };

  const patch = (id: string, values: Partial<EmailBlock>) => publish(updateEmailBlock(blocks, id, (block): EmailBlock => {
    const nextCollection = "collection" in values ? values.collection : undefined;
    if (block.type === "loop" && typeof nextCollection === "string") {
      const sample = tokens.find(token => token.varName === nextCollection)?.sample;
      const fields = getSampleObjectPaths(sample).slice(0, 3);
      return { ...block, ...values, children: block.children.map(child => child.type === "table" ? { ...child, collection: nextCollection, fields } : child) } as EmailBlock;
    }
    return { ...block, ...values } as EmailBlock;
  }));

  const onSelect = (id: string, additive: boolean) => {
    setSelectedIds(current => {
      if (!additive) return new Set([id]);
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => { setSelectedIds(new Set()); setTableSelection(null); };

  const onTableCellSelect = (id: string, fields: string[], additive: boolean) => {
    setTableSelection(current => {
      const nextFields = additive && current?.id === id ? Array.from(new Set([...current.fields, ...fields])) : fields;
      return { id, fields: nextFields };
    });
  };
  const onSelectTableField = (id: string, field: string) => { setSelectedIds(new Set([id])); setTableSelection({ id, fields: [field] }); };
  const mergeTableCells = () => {
    if (selected?.type !== "table" || !canMergeTableCells) return;
    const group = selected.fields.filter(field => selectedTableFields.includes(field));
    patch(selected.id, { mergedColumns: [...(selected.mergedColumns ?? []), group] });
  };
  const unmergeTableCells = () => {
    if (selected?.type !== "table" || !selectedMergedGroup) return;
    patch(selected.id, { mergedColumns: selected.mergedColumns?.filter(group => group !== selectedMergedGroup) });
    setTableSelection(null);
  };

  const onStartEdit = (id: string) => { setSelectedIds(new Set([id])); setEditingId(id); };
  const onCommitEdit = (id: string, kind: string, html: string) => {
    setEditingId(null);
    const document = new DOMParser().parseFromString(html, "text/html");
    const text = document.body.textContent ?? "";
    const richChildren = kind === "rich" ? parseInlineHtmlToNodes(html) : undefined;
    publish(updateEmailBlock(blocks, id, block => {
      if (kind === "rich" && block.type === "rich") return { ...block, children: richChildren ?? [] };
      if (kind === "heading" && block.type === "heading") return { ...block, text };
      if (kind === "paragraph" && block.type === "paragraph") return { ...block, text };
      return block;
    }));
  };

  const addVariable = (expression: string) => {
    if (selected?.type === "rich") { patch(selected.id, { children: [...selected.children, { type: "variable", expression, fallback: expression }] }); return; }
    if (selected?.type === "heading") { patch(selected.id, { type: "rich", tag: `h${selected.level ?? 2}` as "h1" | "h2" | "h3", children: [{ type: "text", text: selected.text }, { type: "variable", expression, fallback: expression }] } as Partial<EmailBlock>); return; }
    if (selected?.type === "paragraph") { patch(selected.id, { type: "rich", tag: "p", children: [{ type: "text", text: selected.text }, { type: "variable", expression, fallback: expression }] } as Partial<EmailBlock>); return; }
    if (selected?.type === "button") { patch(selected.id, { textExpression: expression }); return; }
    const id = newId();
    const block = createEmailBlock("variable", tokens, id);
    if (block.type === "variable") block.expression = expression;
    publish(insertEmailBlock(blocks, null, block));
    setSelectedIds(new Set([id]));
  };

  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;
  const beginDrag = (id: string, clientX: number, clientY: number) => setDrag({ payload: { type: "move", id }, overId: null, overEdge: "before", x: clientX, y: clientY });
  const beginPaletteDrag = (kind: BlockKind, clientX: number, clientY: number) => setDrag({ payload: { type: "insert", kind }, overId: null, overEdge: "before", x: clientX, y: clientY });
  const onDragHover = (overId: string | null, overEdge: DragEdge) => setDrag(current => current ? { ...current, overId, overEdge } : current);
  const onDragCancel = () => setDrag(null);
  const onDragCommit = () => {
    const current = dragRef.current;
    setDrag(null);
    if (current) commitDrag(current.payload, current.overId, current.overEdge);
  };
  const commitDrag = (payload: DragPayload, overId: string | null, overEdge: DragEdge) => {
    if (payload.type === "insert") {
      const block = createEditorBlock(payload.kind, tokens, newId());
      if (!overId) publish(insertEmailBlock(blocks, null, block));
      else if (overEdge === "into") publish(insertEmailBlock(blocks, overId, block));
      else {
        const withBlock = insertEmailBlock(blocks, null, block);
        publish(overEdge === "before" ? moveEmailBlockBefore(withBlock, block.id, overId) : moveEmailBlockAfter(withBlock, block.id, overId));
      }
      setSelectedIds(new Set([block.id]));
      return;
    }
    if (!overId) return;
    if (overEdge === "into") publish(moveEmailBlockToContainer(blocks, payload.id, overId));
    else publish(overEdge === "before" ? moveEmailBlockBefore(blocks, payload.id, overId) : moveEmailBlockAfter(blocks, payload.id, overId));
  };

  const changeCode = (html: string) => { setDirty(true); onChange(html); };
  const changeMode = (next: EditorMode) => {
    if (mode === "code" && next === "blocks") {
      dispatch({ type: "reset", blocks: parseEmailHtmlToBlocks(value) });
      setSelectedIds(new Set());
      lastGenerated.current = value;
    }
    setMode(next);
  };
  const previewNow = () => setCompare(true);
  const resizeEditor = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const bounds = mainRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setEditorRatio(Math.max(35, Math.min(78, ((event.clientX - bounds.left) / bounds.width) * 100)));
  };

  const undoOne = () => {
    const previous = doc.history.at(-1);
    if (!previous) return;
    dispatch({ type: "undo" });
    const html = emailBlocksToHtml(previous,{components:commonElements.components});
    lastGenerated.current = html;
    onChange(html);
    setDirty(true);
  };
  const redoOne = () => {
    const next = doc.future[0];
    if (!next) return;
    dispatch({ type: "redo" });
    const html = emailBlocksToHtml(next,{components:commonElements.components});
    lastGenerated.current = html;
    onChange(html);
    setDirty(true);
  };

  const duplicateBlock = (id: string) => {
    const result = duplicateEmailBlock(blocks, id, newId);
    publish(result.blocks);
    if (result.duplicatedId) setSelectedIds(new Set([result.duplicatedId]));
  };
  const moveBlock = (id: string, direction: -1 | 1) => publish(moveEmailBlock(blocks, id, direction));
  const deleteSelected = () => {
    let next = blocks;
    for (const id of selectedIds) next = removeEmailBlock(next, id);
    publish(next);
    clearSelection();
  };
  const deleteBlock = (id: string) => { publish(removeEmailBlock(blocks, id)); if (selectedIds.has(id)) clearSelection(); };

  return {
    mode, compare, setCompare, viewport, setViewport, zoom, setZoom, pan, setPan, leftTab, setLeftTab,
    editorRatio, setEditorRatio, mainRef, contextMenu, setContextMenu, openContextMenu,
    blocks, selectedIds, selectedId, selected, onSelect, clearSelection,
    hoverId, setHoverId, editingId, tableSelection, selectedTableFields, selectedMergedGroup, canMergeTableCells, selectedLoopCollection,
    preview, dirty, setDirty, canUndo: doc.history.length > 0, canRedo: doc.future.length > 0,
    create, createComponent, patch, onTableCellSelect, onSelectTableField, mergeTableCells, unmergeTableCells,
    onStartEdit, onCommitEdit, addVariable,
    drag, beginDrag, beginPaletteDrag, onDragHover, onDragCommit, onDragCancel,
    changeCode, changeMode, previewNow, resizeEditor, undoOne, redoOne, hasThymeleaf, publish,
    duplicateBlock, moveBlock, deleteBlock, deleteSelected,
  };
}
