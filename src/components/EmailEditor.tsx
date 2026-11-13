import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useEmailEditor } from "./email-editor/useEmailEditor";
import "./email-editor/email-editor.css";
import type { CommonElements, EmailToken } from "../services/emailTemplateRenderer";
import { findEmailBlock, moveEmailBlockAfter, moveEmailBlockBefore } from "../services/emailBlocks";
import EditorToolbar from "./editor/EditorToolbar";
import LeftPanel from "./editor/LeftPanel";
import Workspace from "./editor/Workspace";
import BlockInspector from "./editor/BlockInspector";
import LivePreview from "./editor/LivePreview";
import EditorContextMenu from "./editor/EditorContextMenu";
import EditorFooter from "./editor/EditorFooter";

export type EmailEditorProps = {
  value: string; onChange: (value: string) => void; tokens?: EmailToken[]; templateKey?: string;
  commonElements?: CommonElements; onServerPreview?: () => void; onSave?: () => void | boolean | Promise<void | boolean>;
  navigation?: React.ReactNode; onReset?: () => void; onSendTest?: () => void; title?: string;
  className?: string; style?: React.CSSProperties;
  dirty?: boolean;
  onUploadImage?: (file: File) => Promise<string>;
  defaultMaximized?: boolean; maximized?: boolean; onMaximizedChange?: (maximized: boolean) => void;
};
const TemplateCodeEditor = lazy(() => import("./editor/TemplateCodeEditor"));
const fullscreenDocuments=new WeakMap<Document,{count:number;overflow:string}>();

export default function EmailEditor({ value, onChange, tokens = [], templateKey = "", commonElements = {}, onServerPreview, onSave, onReset, onSendTest, onUploadImage, navigation, title = "Editor de plantilla", className, style, dirty: controlledDirty, defaultMaximized = false, maximized: controlledMaximized, onMaximizedChange }: EmailEditorProps) {
  const editor = useEmailEditor({ value, onChange, tokens, templateKey, commonElements });
  const {
    mode, compare, setCompare, viewport, setViewport, zoom, setZoom, pan, setPan, leftTab, setLeftTab,
    editorRatio, mainRef, contextMenu, setContextMenu, openContextMenu,
    blocks, selectedIds, selectedId, selected, onSelect, clearSelection,
    hoverId, setHoverId, editingId, tableSelection, selectedTableFields, selectedMergedGroup, canMergeTableCells, selectedLoopCollection,
    preview, dirty, setDirty, canUndo, canRedo,
    create, createComponent, patch, onTableCellSelect, onSelectTableField, mergeTableCells, unmergeTableCells,
    onStartEdit, onCommitEdit, addVariable,
    drag, beginDrag, beginPaletteDrag, onDragHover, onDragCommit, onDragCancel,
    changeCode, changeMode, previewNow, resizeEditor, undoOne, redoOne, hasThymeleaf,
    duplicateBlock, moveBlock, deleteBlock, deleteSelected,
  } = editor;

  const [leftWidth, setLeftWidth] = useState(280);
  const [internalMaximized, setInternalMaximized] = useState(defaultMaximized);
  const maximized = controlledMaximized ?? internalMaximized;
  const toggleMaximized = () => {
    if(controlledMaximized === undefined)setInternalMaximized(!maximized);
    onMaximizedChange?.(!maximized);
  };
  useEffect(()=>{
    if(!maximized || typeof document === "undefined")return;
    const body=document.body;
    const entry=fullscreenDocuments.get(document)??{count:0,overflow:body.style.overflow};
    entry.count++;fullscreenDocuments.set(document,entry);body.style.overflow="hidden";
    return ()=>{entry.count--;if(!entry.count){body.style.overflow=entry.overflow;fullscreenDocuments.delete(document);}};
  },[maximized]);
  const [inspectorWidth, setInspectorWidth] = useState(340);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const resizingPanel = useRef<{ which: "left" | "inspector"; startX: number; startWidth: number } | null>(null);
  const startPanelResize = (which: "left" | "inspector") => (event: React.PointerEvent) => {
    event.preventDefault();
    resizingPanel.current = { which, startX: event.clientX, startWidth: which === "left" ? leftWidth : inspectorWidth };
    const move = (moveEvent: PointerEvent) => {
      const state = resizingPanel.current;
      if (!state) return;
      const delta = moveEvent.clientX - state.startX;
      if (state.which === "left") setLeftWidth(Math.max(160, Math.min(420, state.startWidth + delta)));
      else setInspectorWidth(Math.max(220, Math.min(420, state.startWidth - delta)));
    };
    const finish = () => { resizingPanel.current = null; window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const target = event.target as HTMLElement;
    const inField = target.isContentEditable || target.closest("input,textarea,select,[contenteditable='true']");
    if (event.key === "Escape") { setContextMenu(null); if (!inField) clearSelection(); }
    if (inField) return;
    if (event.key === "Delete" || event.key === "Backspace") { if (selectedIds.size) { event.preventDefault(); deleteSelected(); } return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d" && selectedId) { event.preventDefault(); duplicateBlock(selectedId); return; }
    if ((event.key === "ArrowUp" || event.key === "ArrowDown") && selectedId) { event.preventDefault(); moveBlock(selectedId, event.key === "ArrowUp" ? -1 : 1); return; }
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.key.toLowerCase() === "z" && !event.shiftKey) { event.preventDefault(); undoOne(); }
    else if (event.key.toLowerCase() === "y" || (event.key.toLowerCase() === "z" && event.shiftKey)) { event.preventDefault(); redoOne(); }
  };

  return <section className={`email-editor${maximized ? " ee-maximized" : ""}${className ? ` ${className}` : ""}`} style={{...style,...(maximized ? {position:"fixed",inset:0,width:"100%",height:"100dvh",minHeight:0} as React.CSSProperties : {})}} role="region" aria-label={title} tabIndex={-1} onKeyDown={handleKeyDown}
    onClick={event => { if (!(event.target as HTMLElement).closest(".ee-context-menu")) setContextMenu(null); }}>
    <EditorToolbar navigation={navigation} title={title} mode={mode} compare={compare} dirty={controlledDirty ?? dirty} onModeChange={changeMode}
      onCompareChange={() => setCompare(current => !current)} onPreview={previewNow} onUndo={undoOne} onRedo={redoOne} canUndo={canUndo} canRedo={canRedo}
      maximized={maximized} onToggleMaximized={toggleMaximized} />
    {hasThymeleaf && mode === "blocks" && <div className="ee-warning">Las directivas compatibles se convierten en bloques. Las estructuras no reconocidas se conservan como HTML protegido.</div>}
    <div ref={mainRef} className="ee-main" style={compare ? { display: "flex" } : undefined}>
      <section className="ee-editor-pane" style={compare ? { flex: `${editorRatio} 1 0%`, minWidth: 0 } : undefined}>
        {mode === "blocks" ? <div className="ee-build-area">
          <button className="ee-panel-toggle left" onClick={() => setLeftCollapsed(current => !current)}
            title={leftCollapsed ? "Mostrar panel izquierdo" : "Ocultar panel izquierdo"} aria-label={leftCollapsed ? "Mostrar panel izquierdo" : "Ocultar panel izquierdo"}>
            {leftCollapsed ? "›" : "‹"}
          </button>
          {!leftCollapsed && <LeftPanel components={commonElements.components} onComponent={createComponent} style={{ width: leftWidth }} tab={leftTab} onTabChange={setLeftTab} blocks={blocks} selectedIds={selectedIds} tokens={tokens} loopCollection={selectedLoopCollection}
            onAdd={create} onBeginPaletteDrag={beginPaletteDrag} onVariable={addVariable} onSelect={onSelect} onSelectTableField={onSelectTableField}
            onMove={moveBlock} onDelete={deleteBlock} onReorder={(movingId, targetId, after) => editor.publish(after
              ? moveEmailBlockAfter(blocks, movingId, targetId)
              : moveEmailBlockBefore(blocks, movingId, targetId))}
            onContextMenu={openContextMenu} />}
          {!leftCollapsed && <div className="ee-resize-handle" onPointerDown={startPanelResize("left")} />}
          <Workspace components={commonElements.components} blocks={blocks} tokens={tokens} selectedIds={selectedIds} hoverId={hoverId} editingId={editingId} tableSelection={tableSelection}
            drag={drag} zoom={zoom} pan={pan} onZoomChange={setZoom} onPanChange={setPan}
            onSelect={onSelect} onClearSelection={clearSelection} onHover={setHoverId} onStartEdit={onStartEdit} onCommitEdit={onCommitEdit}
            onContextMenu={openContextMenu} onBeginDrag={beginDrag} onDragHover={onDragHover} onDragCommit={onDragCommit} onDragCancel={onDragCancel}
            onTableCellSelect={onTableCellSelect} onTableWidthChange={(id, width) => patch(id, { width })}
            onTableColumnWidthChange={(id, field, width) => {
              const table = findEmailBlock(blocks, id);
              if (table?.type === "table") patch(id, { columnWidths: { ...table.columnWidths, [field]: width } });
            }}
            onTableColumnLabelChange={(id, field, label) => {
              const table = findEmailBlock(blocks, id);
              if (table?.type === "table") patch(id, { columnLabels: { ...table.columnLabels, [field]: label } });
            }}
            onEditVariableExpression={(id, expression) => patch(id, { expression })}
            canMergeTableCells={canMergeTableCells} canUnmergeTableCells={!!selectedMergedGroup} onMergeTableCells={mergeTableCells} onUnmergeTableCells={unmergeTableCells} />
          {!inspectorCollapsed && <div className="ee-resize-handle" onPointerDown={startPanelResize("inspector")} />}
          <button className="ee-panel-toggle right" onClick={() => setInspectorCollapsed(current => !current)}
            title={inspectorCollapsed ? "Mostrar inspector" : "Ocultar inspector"} aria-label={inspectorCollapsed ? "Mostrar inspector" : "Ocultar inspector"}>
            {inspectorCollapsed ? "‹" : "›"}
          </button>
          {!inspectorCollapsed && <BlockInspector onUploadImage={onUploadImage} components={commonElements.components} style={{ width: inspectorWidth }} block={selected} multiCount={selectedIds.size} tokens={tokens} loopCollection={selectedLoopCollection} onPatch={patch} onInsertVariable={addVariable} selectedTableField={selectedTableFields[0]} />}
        </div> : <Suspense fallback={<div style={{ display: "grid", placeItems: "center", minHeight: 0, flex: 1, background: "#111827", color: "#aab7c8", fontSize: 12 }}>Cargando editor HTML y Thymeleaf…</div>}>
          <TemplateCodeEditor value={value} tokens={tokens} onChange={changeCode} />
        </Suspense>}
      </section>
      {compare && <div className="ee-splitter" role="separator" aria-label="Cambiar ancho del editor y la vista previa" aria-orientation="vertical" aria-valuenow={editorRatio} tabIndex={0}
        onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); resizeEditor(event); }} onPointerMove={resizeEditor}
        onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} />}
      {compare && <LivePreview style={{ flex: `${100 - editorRatio} 1 0%`, minWidth: 360 }} html={preview.html} warnings={preview.warnings} viewport={viewport} onViewportChange={setViewport} />}
    </div>
    {mode === "blocks" && <EditorContextMenu target={contextMenu} onClose={() => setContextMenu(null)} onDuplicate={duplicateBlock} onMove={moveBlock} onDelete={deleteBlock} />}
    <EditorFooter mode={mode} hasThymeleaf={hasThymeleaf} onServerPreview={onServerPreview} onReset={onReset} onSendTest={onSendTest} onSave={onSave} value={value} onSaveComplete={() => setDirty(false)} />
  </section>;
}
