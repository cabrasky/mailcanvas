import React, { lazy, Suspense, useCallback, useRef } from "react";
import type { CommonElements, EmailToken } from "../services/emailTemplateRenderer";
import { findEmailBlock, moveEmailBlockToContainer, moveEmailBlockAfter, moveEmailBlockBefore } from "../services/emailBlocks";
import { useEmailEditor } from "./email-editor/useEmailEditor";
import { useEditorChrome } from "../editor/useEditorChrome";
import EditorToolbar from "./editor/EditorToolbar";
import EditorFooter from "./editor/EditorFooter";
import EditorContextMenu from "./editor/EditorContextMenu";
import LeftPanel from "./editor/LeftPanel";
import BlockInspector from "./editor/BlockInspector";
import Workspace from "./editor/Workspace";
import LivePreview from "./editor/LivePreview";
import "./email-editor/email-editor.css";

export type EmailEditorProps = {
  value: string;
  onChange: (value: string) => void;
  tokens?: EmailToken[];
  templateKey?: string;
  commonElements?: CommonElements;
  onServerPreview?: () => void;
  onSave?: () => void | boolean | Promise<void | boolean>;
  navigation?: React.ReactNode;
  onReset?: () => void;
  onSendTest?: () => void;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  dirty?: boolean;
  onUploadImage?: (file: File) => Promise<string>;
  defaultMaximized?: boolean;
  maximized?: boolean;
  onMaximizedChange?: (maximized: boolean) => void;
};
const CodeEditor = lazy(() => import("./editor/TemplateCodeEditor"));
const EMPTY_TOKENS: EmailToken[] = [];
const EMPTY_COMPONENTS: CommonElements = {};

export default function EmailEditor(props: EmailEditorProps) {
  const { value, onChange, tokens = EMPTY_TOKENS, templateKey = "", commonElements = EMPTY_COMPONENTS, title = "Editor de plantilla" } = props;
  const editor = useEmailEditor({ value, onChange, tokens, templateKey, commonElements });
  const chrome = useEditorChrome(props);
  const root = useRef<HTMLElement>(null);
  const selectPreview = useCallback((id: string) => {
    editor.onSelect(id, false);
    requestAnimationFrame(() => root.current?.querySelector(`[data-ee-block-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest" }));
  }, [editor.onSelect]);
  const keyboard = (event: React.KeyboardEvent) => {
    const element = event.target as HTMLElement;
    const field = element.isContentEditable || element.closest("input,textarea,select,[contenteditable='true']");
    if (event.key === "Escape") { editor.setContextMenu(null); if (!field) editor.clearSelection(); }
    if (field) return;
    const command = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (command && key === "z") { event.preventDefault(); if (event.shiftKey) editor.redoOne(); else editor.undoOne(); return; }
    if (command && key === "y") { event.preventDefault(); editor.redoOne(); return; }
    if (command && key === "d" && editor.selectedId) { event.preventDefault(); editor.duplicateBlock(editor.selectedId); return; }
    if ((key === "delete" || key === "backspace") && editor.selectedIds.size) { event.preventDefault(); editor.deleteSelected(); return; }
    if ((key === "arrowup" || key === "arrowdown") && editor.selectedId) {
      event.preventDefault(); editor.moveBlock(editor.selectedId, key === "arrowup" ? -1 : 1);
    }
  };
  const frameStyle: React.CSSProperties = chrome.maximized
    ? { ...props.style, position: "fixed", inset: 0, width: "100%", height: "100dvh", minHeight: 0 } : props.style || {};

  return <section ref={root} className={["email-editor", chrome.maximized && "ee-maximized", props.className].filter(Boolean).join(" ")}
    role="region" aria-label={title} tabIndex={-1} style={frameStyle} onKeyDown={keyboard}
    onClick={event => { if (!(event.target as HTMLElement).closest(".ee-context-menu")) editor.setContextMenu(null); }}>
    <EditorToolbar navigation={props.navigation} title={title} mode={editor.mode} compare={editor.compare} dirty={props.dirty ?? editor.dirty}
      onModeChange={editor.changeMode} onCompareChange={() => editor.setCompare(current => !current)} onPreview={editor.previewNow}
      onUndo={editor.undoOne} onRedo={editor.redoOne} canUndo={editor.canUndo} canRedo={editor.canRedo}
      maximized={chrome.maximized} onToggleMaximized={chrome.toggleMaximized} />
    {editor.hasThymeleaf && editor.mode === "blocks" && <div className="ee-warning">Las directivas compatibles se convierten en bloques. Las estructuras no reconocidas se conservan como HTML protegido.</div>}
    <div ref={editor.mainRef} className="ee-main" style={editor.compare ? { display: "flex" } : undefined}>
      <section className="ee-editor-pane" style={editor.compare ? { flex: `${editor.editorRatio} 1 0%`, minWidth: 0 } : undefined}>
        {editor.mode === "code" ? <Suspense fallback={<div className="ee-code-loading">Cargando editor HTML y Thymeleaf…</div>}>
          <CodeEditor value={value} tokens={tokens} onChange={editor.changeCode} />
        </Suspense> : <div className="ee-build-area">
          <button className="ee-panel-toggle left" onClick={chrome.toggleLeft} aria-label={chrome.leftCollapsed ? "Mostrar panel izquierdo" : "Ocultar panel izquierdo"}>{chrome.leftCollapsed ? "›" : "‹"}</button>
          {!chrome.leftCollapsed && <>
            <LeftPanel onMoveInto={(id,parent)=>editor.publish(moveEmailBlockToContainer(editor.blocks,id,parent))} components={commonElements.components} onComponent={editor.createComponent} style={{ width: chrome.leftWidth }}
              tab={editor.leftTab} onTabChange={editor.setLeftTab} blocks={editor.blocks} selectedIds={editor.selectedIds} tokens={tokens}
              loopCollection={editor.selectedLoopCollection} onAdd={editor.create} onBeginPaletteDrag={editor.beginPaletteDrag}
              onVariable={editor.addVariable} onSelect={editor.onSelect} onSelectTableField={editor.onSelectTableField}
              onMove={editor.moveBlock} onDelete={editor.deleteBlock} onContextMenu={editor.openContextMenu}
              onReorder={(moving, target, after) => editor.publish(after ? moveEmailBlockAfter(editor.blocks, moving, target) : moveEmailBlockBefore(editor.blocks, moving, target))} />
            <div className="ee-resize-handle" onPointerDown={chrome.resize("left")} />
          </>}
          <Workspace components={commonElements.components} blocks={editor.blocks} tokens={tokens} selectedIds={editor.selectedIds}
            hoverId={editor.hoverId} editingId={editor.editingId} tableSelection={editor.tableSelection} drag={editor.drag}
            zoom={editor.zoom} pan={editor.pan} onZoomChange={editor.setZoom} onPanChange={editor.setPan}
            onSelect={editor.onSelect} onClearSelection={editor.clearSelection} onHover={editor.setHoverId}
            onStartEdit={editor.onStartEdit} onCommitEdit={editor.onCommitEdit} onContextMenu={editor.openContextMenu}
            onBeginDrag={editor.beginDrag} onDragHover={editor.onDragHover} onDragCommit={editor.onDragCommit} onDragCancel={editor.onDragCancel}
            onPatchBlock={editor.patch} onTableCellSelect={editor.onTableCellSelect} onTableWidthChange={(id, width) => editor.patch(id, { width })}
            onTableColumnWidthChange={(id, field, width) => {
              const table = findEmailBlock(editor.blocks, id);
              if (table?.type === "table") editor.patch(id, { columnWidths: { ...table.columnWidths, [field]: width } });
            }} onTableColumnLabelChange={(id, field, label) => {
              const table = findEmailBlock(editor.blocks, id);
              if (table?.type === "table") editor.patch(id, { columnLabels: { ...table.columnLabels, [field]: label } });
            }} onEditVariableExpression={(id, expression) => editor.patch(id, { expression })}
            canMergeTableCells={editor.canMergeTableCells} canUnmergeTableCells={!!editor.selectedMergedGroup}
            onMergeTableCells={editor.mergeTableCells} onUnmergeTableCells={editor.unmergeTableCells} />
          {!chrome.inspectorCollapsed && <div className="ee-resize-handle" onPointerDown={chrome.resize("inspector")} />}
          <button className="ee-panel-toggle right" onClick={chrome.toggleInspector} aria-label={chrome.inspectorCollapsed ? "Mostrar inspector" : "Ocultar inspector"}>{chrome.inspectorCollapsed ? "‹" : "›"}</button>
          {!chrome.inspectorCollapsed && <BlockInspector style={{ width: chrome.inspectorWidth }} block={editor.selected}
            multiCount={editor.selectedIds.size} tokens={tokens} loopCollection={editor.selectedLoopCollection} components={commonElements.components}
            onPatch={editor.patch} onInsertVariable={editor.addVariable} selectedTableField={editor.selectedTableFields[0]} onUploadImage={props.onUploadImage} />}
        </div>}
      </section>
      {editor.compare && <>
        <div className="ee-splitter" role="separator" aria-label="Cambiar ancho del editor y la vista previa" aria-orientation="vertical" aria-valuenow={editor.editorRatio} tabIndex={0}
          onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); editor.resizeEditor(event); }}
          onPointerMove={editor.resizeEditor} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
          onKeyDown={event => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault(); event.stopPropagation();
            editor.setEditorRatio(current => Math.max(35, Math.min(78, current + (event.key === "ArrowLeft" ? -2 : 2))));
          }} />
        <LivePreview selected={editor.selected} onSelectBlock={selectPreview} style={{ flex: `${100 - editor.editorRatio} 1 0%`, minWidth: 360 }}
          html={editor.preview.html} warnings={editor.preview.warnings} viewport={editor.viewport} onViewportChange={editor.setViewport} />
      </>}
    </div>
    {editor.mode === "blocks" && <EditorContextMenu target={editor.contextMenu} onClose={() => editor.setContextMenu(null)} onDuplicate={editor.duplicateBlock} onMove={editor.moveBlock} onDelete={editor.deleteBlock} />}
    <EditorFooter mode={editor.mode} hasThymeleaf={editor.hasThymeleaf} onServerPreview={props.onServerPreview} onReset={props.onReset}
      onSendTest={props.onSendTest} onSave={props.onSave} value={value} onSaveComplete={() => editor.setDirty(false)} />
  </section>;
}
