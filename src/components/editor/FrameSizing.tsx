import { changeSizeMode, sizeMode, type Axis, type BlockStyles, type SizeMode } from "../../editor/blockLayout";
import { LengthInput } from "./StyleInputs";

export default function FrameSizing({styles,onChange}:{styles:BlockStyles;onChange:(styles:BlockStyles)=>void}) {
  return <fieldset className="ee-frame-sizing"><legend>Tamaño del bloque</legend>
    {([['width','Ancho'],['height','Altura']] as const).map(([axis,label])=><div key={axis} className="ee-frame-axis">
      <label><span>{label}</span><select className="ee-select" aria-label={`Modo de ${label.toLowerCase()}`} value={sizeMode(styles[axis])}
        onChange={event=>onChange(changeSizeMode(styles,axis as Axis,event.target.value as SizeMode))}>
        <option value="auto">Automático · contenido</option><option value="fixed">Fijo · px</option><option value="relative">Relativo</option><option value="css">CSS personalizado</option>
      </select></label>
      {sizeMode(styles[axis]) !== "auto" && <LengthInput key={`${axis}-${sizeMode(styles[axis])}`} label={label} value={styles[axis] || ""} onChange={value=>onChange({...styles,[axis]:value,boxSizing:"border-box"})} />}
    </div>)}
    <small>El contenido conserva su altura mínima al reducir el bloque.</small>
  </fieldset>;
}
