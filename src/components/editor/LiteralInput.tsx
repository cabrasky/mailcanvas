import { ColorInput } from "./StyleInputs";
export type LiteralType = "text" | "number" | "url" | "email" | "image" | "color" | "boolean" | "date" | "datetime";

/** Native controls for literal values; expressions keep their own text editor. */
export default function LiteralInput({ label, value, type, onChange }: {
  label: string; value: string; type: LiteralType; onChange: (value: string) => void;
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
    step={type === "number" ? "any" : undefined} value={type === "datetime" ? dateValue : value} onChange={event => change(event.target.value)} />
    {type === "image" && /^https?:\/\//i.test(value) && <img src={value} alt="Vista previa de la imagen" loading="lazy" referrerPolicy="no-referrer" style={{ maxWidth: "100%", maxHeight: 120, objectFit: "contain", marginTop: 8 }} />}
  </div>;
}
