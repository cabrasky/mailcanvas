import type { EditorMode } from "./EditorToolbar";
import { useRef, useState } from "react";

type Props = {
  mode: EditorMode; hasThymeleaf: boolean;
  onServerPreview?: () => void; onReset?: () => void; onSendTest?: () => void; onSave?: () => void | boolean | Promise<void | boolean>; onSaveComplete: () => void; value: string;
};

export default function EditorFooter({ mode, hasThymeleaf, onServerPreview, onReset, onSendTest, onSave, onSaveComplete, value }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const current = useRef(value); current.current = value;
  const pending = useRef(false);
  const save = async () => {
    if (!onSave || pending.current) return;
    const snapshot = value;
    pending.current = true; setSaving(true); setError("");
    try {
      const result = await onSave();
      if (result === false) setError("No se han guardado los cambios.");
      else if (current.current === snapshot) onSaveComplete();
    } catch { setError("No se pudieron guardar los cambios. Inténtalo de nuevo."); }
    finally { pending.current = false; setSaving(false); }
  };
  return <footer className="ee-footer">
    <span className="ee-footer-copy">{mode === "blocks" ? "Editor visual · bloques convertidos a HTML / Thymeleaf" : hasThymeleaf ? "HTML + directivas Thymeleaf" : "HTML con datos de muestra"}</span>
    <span className="ee-spacer" />
    <button className="ee-btn" onClick={onServerPreview} disabled={!onServerPreview}>Ver en servidor</button>
    <button className="ee-btn" onClick={onReset} disabled={!onReset}>Restablecer</button>
    <button className="ee-btn" onClick={onSendTest} disabled={!onSendTest}>Enviar prueba</button>
    {error && <span role="alert" className="ee-save-error"><strong>Guardado pendiente</strong><span>{error}</span><small>Revisa los avisos y pulsa Guardar cambios para reintentar.</small></span>}
    <button className="ee-btn primary" onClick={save} disabled={!onSave || saving} aria-busy={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button>
  </footer>;
}
