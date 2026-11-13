import { useId, useState } from "react";

export function ColorInput({ label, value, onChange, placeholder = "#ffffff" }: {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string;
}) {
  const shorthand = value.match(/^#([\da-f])([\da-f])([\da-f])$/i);
  const hex = shorthand ? `#${shorthand[1].repeat(2)}${shorthand[2].repeat(2)}${shorthand[3].repeat(2)}` : value;
  return <div className="ee-color-input">
    <input type="color" aria-label={`Seleccionar color: ${label}`} value={/^#[\da-f]{6}$/i.test(hex) ? hex : placeholder} onChange={event => onChange(event.target.value)} />
    <input className="ee-input" aria-label={label} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} spellCheck={false} />
  </div>;
}

const LENGTH = /^(-?(?:\d+(?:\.\d*)?|\.\d+))(px|rem|em|%|pt|vw|vh)?$/;
const UNITS = ["px", "rem", "em", "%", "pt", "vw", "vh"];

/** Retain imported shorthand/calc values until the user explicitly replaces them. */
export function LengthInput({ label, value, onChange, placeholder = "12px" }: {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string;
}) {
  const id = useId();
  const parsed = value.trim().match(LENGTH);
  const [custom, setCustom] = useState(!!value && !parsed);
  const [preferredUnit, setPreferredUnit] = useState("px");
  const unit = parsed?.[2] ?? preferredUnit;
  return <div className="ee-field ee-length-field">
    <div className="ee-style-field-heading"><label htmlFor={id}>{label}</label><button type="button" title="Editar una expresión CSS o varias medidas" aria-label={`CSS personalizado: ${label}`} aria-pressed={custom} onClick={() => setCustom(!custom)}>CSS</button></div>
    {custom ? <input id={id} aria-label={label} className="ee-input" value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} /> : <div className="ee-length-input">
      <input id={id} aria-label={label} className="ee-input" type="number" min="0" step="any" value={parsed?.[1] ?? ""} placeholder={placeholder.match(LENGTH)?.[1]} onChange={event => {
        const next = event.target.value;
        if (next === "" || Number(next) >= 0) onChange(next === "" ? "" : `${next}${unit}`);
      }} />
      <select className="ee-select" aria-label={`Unidad de ${label}`} value={unit} onChange={event => {
        setPreferredUnit(event.target.value);
        if (parsed) onChange(`${parsed[1]}${event.target.value}`);
      }}>{UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}</select>
    </div>}
    {!custom && value && !parsed && <small>CSS conservado: {value}. Introduce una medida para sustituirlo.</small>}
  </div>;
}
