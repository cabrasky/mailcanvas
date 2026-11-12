import type React from "react";

type Props = { style?: React.CSSProperties; html: string; warnings: string[]; viewport: "desktop" | "mobile"; onViewportChange: (viewport: "desktop" | "mobile") => void };

export default function LivePreview({ style, html, warnings, viewport, onViewportChange }: Props) {
  return <section className="ee-preview-pane" style={style} aria-label="Vista previa">
    <div className="ee-preview-toolbar">
      <span className="ee-eyebrow">VISTA PREVIA</span>
      <div className="ee-device-picker" role="group" aria-label="Tamaño de vista previa">
        <button className={viewport === "desktop" ? "selected" : ""} aria-pressed={viewport === "desktop"} onClick={() => onViewportChange("desktop")}>▰ 600px</button>
        <button className={viewport === "mobile" ? "selected" : ""} aria-pressed={viewport === "mobile"} onClick={() => onViewportChange("mobile")}>▯ 375px</button>
      </div>
    </div>
    <div className="ee-preview-stage">
      <div className={`ee-device ee-device-${viewport}`}>
        <div className="ee-device-top"><i /><i /><i /><span>{viewport === "desktop" ? "600 px" : "375 px"}</span></div>
        {html ? <iframe title="Correo renderizado localmente" sandbox="" srcDoc={html} /> : <div className="ee-preview-placeholder">Todavía no hay contenido para mostrar.</div>}
      </div>
    </div>
    {warnings.length > 0 && <div className="ee-preview-warnings"><strong>Datos sin muestra</strong><span>{warnings.slice(0, 4).join(" · ")}</span></div>}
  </section>;
}
