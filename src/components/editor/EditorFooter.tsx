import { useEffect, useRef, useState } from "react";
import type { EditorMode } from "./EditorToolbar";

type Props = {
  mode: EditorMode; hasThymeleaf: boolean; value: string;
  onServerPreview?: () => void; onReset?: () => void; onSendTest?: () => void;
  onSave?: () => void | boolean | Promise<void | boolean>;
  onSaveComplete: () => void;
};

export default function EditorFooter(props: Props) {
  const [status, setStatus] = useState<{ saving: boolean; error: string }>({ saving: false, error: "" });
  const current = useRef(props); current.current = props;
  const mounted = useRef(true);
  const pending = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const save = async () => {
    if (!props.onSave || pending.current) return;
    pending.current = true;
    const submitted = props.value;
    setStatus({ saving: true, error: "" });
    let error = "";
    try {
      const result = await props.onSave();
      if (result === false) error = "No se han guardado los cambios.";
      else if (mounted.current && current.current.value === submitted) current.current.onSaveComplete();
    } catch { error = "No se pudieron guardar los cambios. Inténtalo de nuevo."; }
    finally {
      pending.current = false;
      if (mounted.current) setStatus({ saving: false, error });
    }
  };
  const description = props.mode === "blocks" ? "Editor visual · bloques convertidos a HTML / Thymeleaf"
    : props.hasThymeleaf ? "HTML + directivas Thymeleaf" : "HTML con datos de muestra";
  return <footer className="ee-footer">
    <span className="ee-footer-copy">{description}</span><span className="ee-spacer" />
    <button className="ee-btn" onClick={props.onServerPreview} disabled={!props.onServerPreview}>Ver en servidor</button>
    <button className="ee-btn" onClick={props.onReset} disabled={!props.onReset}>Restablecer</button>
    <button className="ee-btn" onClick={props.onSendTest} disabled={!props.onSendTest}>Enviar prueba</button>
    {status.error && <span role="alert" className="ee-save-error"><strong>Guardado pendiente</strong><span>{status.error}</span><small>Revisa los avisos y pulsa Guardar cambios para reintentar.</small></span>}
    <button className="ee-btn primary" onClick={save} disabled={!props.onSave || status.saving} aria-busy={status.saving}>{status.saving ? "Guardando…" : "Guardar cambios"}</button>
  </footer>;
}
