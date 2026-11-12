import type { EditorMode } from "./EditorToolbar";

type Props = {
  mode: EditorMode; hasThymeleaf: boolean;
  onServerPreview?: () => void; onReset?: () => void; onSendTest?: () => void; onSave?: () => void; onSaveComplete: () => void;
};

export default function EditorFooter({ mode, hasThymeleaf, onServerPreview, onReset, onSendTest, onSave, onSaveComplete }: Props) {
  return <footer className="ee-footer">
    <span className="ee-footer-copy">{mode === "blocks" ? "Editor visual · bloques convertidos a HTML / Thymeleaf" : hasThymeleaf ? "HTML + directivas Thymeleaf" : "HTML con datos de muestra"}</span>
    <span className="ee-spacer" />
    <button className="ee-btn" onClick={onServerPreview} disabled={!onServerPreview}>Ver en servidor</button>
    <button className="ee-btn" onClick={onReset} disabled={!onReset}>Restablecer</button>
    <button className="ee-btn" onClick={onSendTest} disabled={!onSendTest}>Enviar prueba</button>
    <button className="ee-btn primary" onClick={() => { onSave?.(); onSaveComplete(); }} disabled={!onSave}>Guardar cambios</button>
  </footer>;
}
