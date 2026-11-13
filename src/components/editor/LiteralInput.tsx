import { ColorInput } from "./StyleInputs";
import { useEffect, useRef, useState } from "react";
export type LiteralType = "text" | "number" | "url" | "email" | "image" | "color" | "boolean" | "date" | "datetime";

/** Native controls for literal values; expressions keep their own text editor. */
export default function LiteralInput({ label, value, type, onChange, onUploadImage, hideImageDetails = false }: {
  label: string; value: string; type: LiteralType; onChange: (value: string) => void; onUploadImage?: (file: File) => Promise<string>; hideImageDetails?: boolean;
}) {
  const legacyDate = value.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2})$/);
  const dateValue = legacyDate ? `${legacyDate[3]}-${legacyDate[2]}-${legacyDate[1]}T${legacyDate[4]}` : value;
  const change = (next: string) => {
    const date = type === "datetime" && next.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})$/);
    onChange(date ? `${date[3]}/${date[2]}/${date[1]} ${date[4]}` : next);
  };
  if (type === "boolean") return <label className="ee-field"><input type="checkbox" aria-label={label} checked={value === "true"} onChange={event => onChange(String(event.target.checked))} /> Activado</label>;
  if (type === "color") return <ColorInput label={label} value={value} onChange={onChange} />;
  return <div style={{ minWidth: 0 }}><input className="ee-input" aria-label={label}
    type={type === "image" ? "url" : type === "datetime" ? "datetime-local" : type}
    step={type === "number" ? "any" : undefined} aria-invalid={type === "number" && value !== "" && !Number.isFinite(Number(value)) || undefined} value={type === "datetime" ? dateValue : value} onChange={event => change(event.target.value)} />
    {type === "number" && value !== "" && !Number.isFinite(Number(value)) && <small role="alert">Introduce un número válido; el valor no se convertirá en cero.</small>}

    {type === "image" && !hideImageDetails && <ImageDetails label={label} value={value} onChange={onChange} onUploadImage={onUploadImage} />}
  </div>;
}

export function ImageDetails({ label, value, onChange, onUploadImage }: {
  label: string; value: string; onChange: (value: string) => void; onUploadImage?: (file: File) => Promise<string>;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => setDimensions(null), [value]);
  const [failedImage, setFailedImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const mounted = useRef(true);
  const latestChange = useRef(onChange); latestChange.current = onChange;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return <div className="ee-image-details">
    {onUploadImage && <div className="ee-image-upload"><button type="button" className="ee-btn" disabled={uploading} onClick={() => fileInput.current?.click()}>{uploading ? "Subiendo imagen…" : value ? "Cambiar imagen" : "Subir imagen"}</button><input hidden ref={fileInput} type="file" accept="image/*" disabled={uploading} aria-label={`Subir imagen: ${label}`} onChange={async event => {
      const file = event.target.files?.[0]; event.target.value = "";
      if (!file) return;
      if (!file.type.startsWith("image/")) { setUploadError("Selecciona un archivo de imagen."); return; }
      setUploading(true); setUploadError("");
      try { const url = await onUploadImage(file); if (mounted.current) latestChange.current(url); } catch { if (mounted.current) setUploadError("No se pudo subir la imagen. Inténtalo de nuevo."); } finally { if (mounted.current) setUploading(false); }
    }} /></div>}
    {uploadError && <small role="alert">{uploadError}</small>}
    {/^(https?:\/\/|blob:|\/(?!\/))/i.test(value) && <div className="ee-image-preview">
      {failedImage === value ? <div><small role="alert">No se pudo cargar la imagen. Revisa la URL.</small><button type="button" className="ee-btn" onClick={() => setFailedImage("")}>Reintentar imagen</button></div> : <img src={value} onError={() => setFailedImage(value)} onLoad={event => setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} alt="Vista previa de la imagen" loading="lazy" referrerPolicy="no-referrer" />}
    </div>}
    {dimensions && failedImage !== value && <small className="ee-image-dimensions">{dimensions.width} × {dimensions.height} px · imagen original</small>}
  </div>;
}
