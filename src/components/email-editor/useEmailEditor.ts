import type { EmailComponent } from "../../services/emailComponents";
import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { EditorMode } from "../editor/EditorToolbar";
import { renderEmail, type CommonElements, type EmailToken } from "../../services/emailTemplateRenderer";
import {
  createEmailBlock, duplicateEmailBlock, emailBlocksToHtml, findEmailBlock, insertEmailBlock,
  moveEmailBlock, moveEmailBlockAfter, moveEmailBlockBefore, moveEmailBlockToContainer,
  parseInlineHtmlToNodes, removeEmailBlock, updateEmailBlock, type BlockKind, type EmailBlock,
} from "../../services/emailBlocks";
import { createEditorBlock, getSampleObjectPaths } from "../../services/emailBlockActions";
import { useEditorDocument } from "../../editor/useEditorDocument";
import type { DragEdge, DragPayload, DragState } from "./canvasContext";
import type { Pan } from "../editor/Workspace";

type Options = { value: string; onChange: (value: string) => void; tokens: EmailToken[]; templateKey: string; commonElements: CommonElements };
export type ContextMenuTarget = { id: string; x: number; y: number };
type CellSelection = { id: string; fields: string[] } | null;

function loopFor(blocks: EmailBlock[], id: string, collection?: string): string | undefined {
  for (const block of blocks) {
    if (block.id === id) return collection;
    if (block.type === "loop" || block.type === "container" || block.type === "if") {
      const found = loopFor(block.children, id, block.type === "loop" ? block.collection : collection);
      if (found) return found;
    }
  }
}

export function useEmailEditor({ value, onChange, tokens, templateKey, commonElements }: Options) {
  const { document: model, snapshot, generation } = useEditorDocument(value, onChange);
  const blocks = snapshot.present.blocks;
  const [mode, setMode] = useState<EditorMode>("blocks");
  const [compare, setCompare] = useState(false);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [leftTab, setLeftTab] = useState<"layers" | "insert">("insert");
  const [editorRatio, setEditorRatio] = useState(62);
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState<Pan>({ x: 80, y: 40 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tableSelection, setTableSelection] = useState<CellSelection>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuTarget | null>(null);
  const [drag, setDragState] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const sequence = useRef(0);
  const components = commonElements.components;
  const newId = () => {
    let id: string;
    do { id = `block-${++sequence.current}`; } while (findEmailBlock(model.getSnapshot().present.blocks, id));
    return id;
  };
  const selectOnly = (id: string) => setSelectedIds(new Set([id]));
  const clearSelection = () => { setSelectedIds(new Set()); setEditingId(null); setTableSelection(null); };
  useEffect(() => { clearSelection(); setContextMenu(null); }, [generation]);
  const selectedId = selectedIds.size === 1 ? [...selectedIds][0] : null;
  const selected = selectedId ? findEmailBlock(blocks, selectedId) : undefined;
  useEffect(() => { if (tableSelection?.id !== selectedId) setTableSelection(null); }, [selectedId, tableSelection]);
  const selectedTableFields = tableSelection?.id === selectedId ? tableSelection.fields : [];
  const selectedMergedGroup = selected?.type === "table"
    ? selected.mergedColumns?.find(group => group.length === selectedTableFields.length && group.every(field => selectedTableFields.includes(field))) : undefined;
  const selectedIndexes = selected?.type === "table" ? selectedTableFields.map(field => selected.fields.indexOf(field)).sort((a,b) => a-b) : [];
  const contiguous = selectedIndexes.length > 1 && selectedIndexes.every((index, position) => index >= 0 && (position === 0 || index === selectedIndexes[position - 1] + 1));
  const canMergeTableCells = selected?.type === "table" && contiguous && !selected.mergedColumns?.some(group => group.some(field => selectedTableFields.includes(field)));
  const selectedLoopCollection = selectedId ? loopFor(blocks, selectedId) : undefined;
  const preview = useMemo(() => renderEmail(mode === "blocks"
    ? emailBlocksToHtml(blocks, { components, editorMetadata: true }) : snapshot.present.html,
  tokens, templateKey, commonElements), [blocks, mode, snapshot.present.html, tokens, templateKey, commonElements, components]);
  const edit = (transform: (current: EmailBlock[]) => EmailBlock[]) => model.edit(transform, components);
  const publish = (next: EmailBlock[], record = true) => model.edit(() => next, components, record);
  const patch = (id: string, values: Partial<EmailBlock>) => edit(current => updateEmailBlock(current, id, block => {
    if (block.type === "loop" && "collection" in values && typeof values.collection === "string") {
      const collection = values.collection;
      const fields = getSampleObjectPaths(tokens.find(token => token.varName === collection)?.sample).slice(0,3);
      return { ...block, ...values, children: block.children.map(child => child.type === "table" ? { ...child, collection, fields } : child) } as EmailBlock;
    }
    return { ...block, ...values } as EmailBlock;
  }));
  const create = (kind: BlockKind) => {
    const block = createEditorBlock(kind, tokens, newId());
    edit(current => insertEmailBlock(current, null, block));
    selectOnly(block.id);
  };
  const createComponent = (definition: EmailComponent) => {
    const block: EmailBlock = { id: newId(), type: "component", componentKey: definition.key, name: definition.name, values: {}, fallbackHtml: definition.html, properties: definition.properties };
    edit(current => insertEmailBlock(current, null, block)); selectOnly(block.id);
  };
  const onSelect = (id: string, additive: boolean) => {
    if (!additive) { selectOnly(id); return; }
    setSelectedIds(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const onTableCellSelect = (id: string, fields: string[], additive: boolean) => setTableSelection(current => ({ id, fields: additive && current?.id === id ? [...new Set([...current.fields, ...fields])] : fields }));
  const onSelectTableField = (id: string, field: string) => { selectOnly(id); setTableSelection({ id, fields: [field] }); };
  const mergeTableCells = () => {
    if (selected?.type !== "table" || !canMergeTableCells) return;
    patch(selected.id, { mergedColumns: [...(selected.mergedColumns || []), selected.fields.filter(field => selectedTableFields.includes(field))] });
  };
  const unmergeTableCells = () => {
    if (selected?.type !== "table" || !selectedMergedGroup) return;
    patch(selected.id, { mergedColumns: selected.mergedColumns?.filter(group => group !== selectedMergedGroup) }); setTableSelection(null);
  };
  const onStartEdit = (id: string) => { selectOnly(id); setEditingId(id); };
  const onCommitEdit = (id: string, kind: string, html: string) => {
    setEditingId(null);
    if (kind === "rich") { patch(id, { children: parseInlineHtmlToNodes(html) }); return; }
    const parsed = new DOMParser().parseFromString(html, "text/html");
    if (kind === "heading" || kind === "paragraph") patch(id, { text: parsed.body.textContent || "" });
  };
  const addVariable = (expression: string) => {
    if (selected?.type === "rich") { patch(selected.id, { children: [...selected.children, { type: "variable", expression, fallback: expression }] }); return; }
    if (selected?.type === "heading" || selected?.type === "paragraph") {
      const tag = selected.type === "heading" ? `h${selected.level || 2}` : "p";
      patch(selected.id, { type: "rich", tag, children: [{ type: "text", text: selected.text }, { type: "variable", expression, fallback: expression }] } as Partial<EmailBlock>); return;
    }
    if (selected?.type === "button") { patch(selected.id, { textExpression: expression }); return; }
    const block = createEmailBlock("variable", tokens, newId());
    if (block.type === "variable") block.expression = expression;
    edit(current => insertEmailBlock(current, null, block)); selectOnly(block.id);
  };
  const setDrag = (next: DragState | null) => { dragRef.current = next; setDragState(next); };
  const begin = (payload: DragPayload, x: number, y: number) => setDrag({ payload, x, y, overId: null, overEdge: "before" });
  const beginDrag = (id: string, x: number, y: number) => begin({ type: "move", id }, x, y);
  const beginPaletteDrag = (kind: BlockKind, x: number, y: number) => begin({ type: "insert", kind }, x, y);
  const onDragHover = (overId: string | null, overEdge: DragEdge) => {
    const current = dragRef.current;
    if (current && (current.overId !== overId || current.overEdge !== overEdge)) setDrag({ ...current, overId, overEdge });
  };
  const onDragCancel = () => setDrag(null);
  const onDragCommit = () => {
    const operation = dragRef.current; setDrag(null);
    if (!operation) return;
    const { payload, overId, overEdge } = operation;
    let movingId = payload.type === "move" ? payload.id : "";
    edit(current => {
      let next = current;
      if (payload.type === "insert") {
        const block = createEditorBlock(payload.kind, tokens, newId()); movingId = block.id;
        next = insertEmailBlock(next, null, block);
      }
      if (!overId) return next;
      if (overEdge === "into") return moveEmailBlockToContainer(next, movingId, overId);
      return overEdge === "before" ? moveEmailBlockBefore(next, movingId, overId) : moveEmailBlockAfter(next, movingId, overId);
    });
    if (movingId) selectOnly(movingId);
  };
  const resizeEditor = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const rect = mainRef.current?.getBoundingClientRect();
    if (rect?.width) setEditorRatio(Math.max(35, Math.min(78, (event.clientX - rect.left) / rect.width * 100)));
  };
  const duplicateBlock = (id: string) => {
    const result = duplicateEmailBlock(model.getSnapshot().present.blocks, id, newId);
    publish(result.blocks); if (result.duplicatedId) selectOnly(result.duplicatedId);
  };
  const moveBlock = (id: string, direction: -1 | 1) => edit(current => moveEmailBlock(current, id, direction));
  const deleteBlock = (id: string) => { edit(current => removeEmailBlock(current, id)); if (selectedIds.has(id)) clearSelection(); };
  const deleteSelected = () => { edit(current => [...selectedIds].reduce(removeEmailBlock, current)); clearSelection(); };
  const openContextMenu = (id: string, x: number, y: number) => setContextMenu({ id, x: Math.max(8, Math.min(x, window.innerWidth - 190)), y: Math.max(8, Math.min(y, window.innerHeight - 170)) });

  return {
    mode, compare, setCompare, viewport, setViewport, zoom, setZoom, pan, setPan, leftTab, setLeftTab,
    editorRatio, setEditorRatio, mainRef, contextMenu, setContextMenu, openContextMenu,
    blocks, selectedIds, selectedId, selected, onSelect, clearSelection, hoverId, setHoverId, editingId,
    tableSelection, selectedTableFields, selectedMergedGroup, canMergeTableCells, selectedLoopCollection,
    preview, dirty: snapshot.present.html !== snapshot.savedHtml, setDirty: (dirty: boolean) => { if (!dirty) model.markSaved(); },
    canUndo: snapshot.past.length > 0, canRedo: snapshot.future.length > 0,
    create, createComponent, patch, publish, onTableCellSelect, onSelectTableField, mergeTableCells, unmergeTableCells,
    onStartEdit, onCommitEdit, addVariable, drag, beginDrag, beginPaletteDrag, onDragHover, onDragCommit, onDragCancel,
    changeCode: (html: string) => model.replace(html), changeMode: setMode, previewNow: () => setCompare(true), resizeEditor,
    undoOne: () => model.undo(), redoOne: () => model.redo(), hasThymeleaf: /\bth:/.test(snapshot.present.html),
    duplicateBlock, moveBlock, deleteBlock, deleteSelected,
  };
}
