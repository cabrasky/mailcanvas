import type { EmailBlock } from "../../services/emailBlocks";
import ValueInput from "./ValueInput";
import { LengthInput } from "./StyleInputs";

type ImageBlock = Extract<EmailBlock, { type: "image" }>;
export default function ImageInspector({ block, options, onPatch, onUploadImage }: {
  block: ImageBlock; options: { value: string; label: string }[];
  onPatch: (patch: Partial<ImageBlock>) => void; onUploadImage?: (file: File) => Promise<string>;
}) {
  const styles = block.styles ?? {};
  const mode = styles.width && styles.width !== "auto" ? "responsive" : block.width ? "fixed" : "original";
  const setSize = (next: string) => onPatch({
    width: next === "original" ? "" : block.width || "600",
    styles: { ...styles, width: next === "responsive" ? "100%" : "", maxWidth: "100%", height: "auto", objectFit: "contain" },
  });
  return <div className="ee-image-inspector">
    <div className="ee-field"><span>Origen de la imagen</span>
      <ValueInput key={block.id} valueType="image" label="URL de imagen" value={block.src}
        mode={block.srcMode ?? (block.src.includes("${") ? "dynamic" : "text")} options={options} onUploadImage={onUploadImage}
        onChange={(src, srcMode) => onPatch({ src, srcMode })} />
    </div>
    <fieldset className="ee-image-size"><legend>Tamaño</legend>
      <div className="ee-image-size-modes" role="group" aria-label="Tamaño de imagen">
        {[["original", "Original"], ["fixed", "Fijo"], ["responsive", "Adaptable"]].map(([value, label]) => <button type="button" key={value} aria-pressed={mode === value} onClick={() => setSize(value)}>{label}</button>)}
      </div>
      {mode === "fixed" && <label className="ee-field"><span>Ancho en píxeles</span><input type="number" min="1" step="1" className="ee-input" aria-label="Ancho de imagen en píxeles" value={block.width} onChange={event => onPatch({ width: event.target.value, styles: { ...styles, height: "auto" } })} /></label>}
      {mode === "responsive" && <LengthInput label="Ancho adaptable" value={styles.width ?? "100%"} onChange={width => onPatch({ styles: { ...styles, width, height: "auto" } })} placeholder="100%" />}
      <p className="ee-help-note">{mode === "original" ? "Usa el tamaño original sin desbordar el correo." : mode === "fixed" ? "Se reduce en pantallas pequeñas si no cabe." : "El porcentaje se calcula sobre el ancho del bloque que la contiene."} La proporción se mantiene.</p>
      <details><summary className="ee-image-options-summary">Más opciones de tamaño</summary><LengthInput label="Límite de ancho de imagen" value={styles.maxWidth ?? "100%"} onChange={maxWidth => onPatch({ styles: { ...styles, maxWidth } })} placeholder="100%" /></details>
    </fieldset>
    <label className="ee-field"><span>Texto alternativo</span><input className="ee-input" value={block.alt} onChange={event => onPatch({ alt: event.target.value })} placeholder="Qué muestra la imagen" /><small>Describe la imagen para quien no pueda verla. Déjalo vacío si es decorativa.</small></label>
    <div className="ee-field"><span>Posición</span><div className="ee-alignment-control" role="group" aria-label="Posición de la imagen">{[["left", "Izquierda"], ["center", "Centro"], ["right", "Derecha"]].map(([value, label]) => {
      const selected = styles.marginLeft === "auto" ? styles.marginRight === "auto" ? "center" : "right" : "left";
      return <button type="button" key={value} aria-label={`Imagen: ${label}`} aria-pressed={selected === value} className={selected === value ? "selected" : ""} onClick={() => onPatch({ styles: { ...styles, display: "block", marginLeft: value === "left" ? "0" : "auto", marginRight: value === "right" ? "0" : "auto" } })}>{label}</button>;
    })}</div></div>
  </div>;
}
