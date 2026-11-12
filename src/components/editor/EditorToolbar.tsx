import type { ReactNode } from "react";
export type EditorMode = "blocks" | "code";

type Props = {
  navigation?: ReactNode;
  mode: EditorMode; compare: boolean; title: string; dirty: boolean;
  onModeChange: (mode: EditorMode) => void; onCompareChange: () => void; onPreview: () => void;
  onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean;
  maximized: boolean; onToggleMaximized: () => void;
};

export default function EditorToolbar({ navigation, mode, compare, title, dirty, onModeChange, onCompareChange, onPreview, onUndo, onRedo, canUndo, canRedo, maximized, onToggleMaximized }: Props) {
  return <div className="ee-toolbar">
    {navigation}
    <div className="ee-toolbar-title"><strong>{title}</strong><span className={dirty ? "ee-status-dirty" : "ee-status-saved"}>{dirty ? "Sin guardar" : "Guardado"}</span></div>
    <div className="ee-segment" role="tablist" aria-label="Modo de edición">
      <button className={`ee-btn ${mode === "blocks" ? "active" : ""}`} role="tab" aria-selected={mode === "blocks"} onClick={() => onModeChange("blocks")}>▦ Bloques</button>
      <button className={`ee-btn ${mode === "code" ? "active" : ""}`} role="tab" aria-selected={mode === "code"} onClick={() => onModeChange("code")}>‹/› Código</button>
    </div>
    <button className={`ee-btn ${compare ? "active" : ""}`} aria-pressed={compare} onClick={onCompareChange} title="Vista previa junto al editor">◫ Lado a lado</button>
    <div className="ee-toolbar-controls">
      {mode === "blocks" && <>
        <button className="ee-btn icon" aria-label="Deshacer" title="Deshacer (Ctrl+Z)" disabled={!canUndo} onClick={onUndo}>↶</button>
        <button className="ee-btn icon" aria-label="Rehacer" title="Rehacer (Ctrl+Y)" disabled={!canRedo} onClick={onRedo}>↷</button>
      </>}
      {mode === "code" && !compare && <button className="ee-btn" onClick={onPreview}>▷ Previsualizar</button>}
      <button className="ee-btn" aria-label={maximized ? "Minimizar editor" : "Maximizar editor"} aria-pressed={maximized} title={maximized ? "Volver a la vista reducida" : "Ocupar toda la ventana"} onClick={onToggleMaximized}><span aria-hidden="true">{maximized ? "▣" : "⛶"}</span> {maximized ? "Minimizar" : "Maximizar"}</button>
    </div>
  </div>;
}
