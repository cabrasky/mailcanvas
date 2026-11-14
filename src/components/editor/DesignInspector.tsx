import { positionAlignedBlockTypes, positionAlignStyles, type EmailBlock } from "../../services/emailBlocks";
import FrameSizing from "./FrameSizing";
import SpacingInspector from "./SpacingInspector";
import FlexLayoutInspector from "./FlexLayoutInspector";
import { ColorInput,LengthInput } from "./StyleInputs";

type Props={block:EmailBlock;onPatch:(patch:Partial<EmailBlock>)=>void};
export default function DesignInspector({block,onPatch}:Props) {
  const styles=block.styles || {};
  const change=(styles:Record<string,string>)=>onPatch({styles});
  const positional=(positionAlignedBlockTypes as readonly string[]).includes(block.type);
  const position=styles.marginLeft === "auto"?styles.marginRight === "auto"?"center":"right":"left";
  const align=(value:"left"|"center"|"right")=>change({...styles,...positionAlignStyles(value,block.type,styles.display)});
  const sizing=block.type === "image" && block.width?{width:`${block.width}px`,...styles}:styles;
  return <div className="ee-design-inspector">
    <FrameSizing styles={sizing} onChange={next=>onPatch(block.type === "image"?{styles:next,width:next.width?.endsWith("px")?next.width.slice(0,-2):next.width?block.width:""}:{styles:next})}/>
    <LengthInput label="Ancho máximo" value={styles.maxWidth || ""} onChange={maxWidth=>change({...styles,maxWidth})} placeholder="600px"/>
    <fieldset className="ee-design-group"><legend>Posición del bloque</legend>
      <div className="ee-alignment-control" role="group" aria-label="Posición del bloque">
        {([["left","Izquierda","Bloque a la izquierda"],["center","Centrar","Bloque al centro"],["right","Derecha","Bloque a la derecha"]] as const).map(([value,label,boxLabel])=><button type="button" key={value} aria-label={positional?label:boxLabel} aria-pressed={position===value} onClick={()=>align(value)}>{positional?label:boxLabel}</button>)}
      </div>
    </fieldset>
    {block.type !== "image" && <fieldset className="ee-design-group"><legend>Contenido</legend>
      {!positional && <div className="ee-alignment-control" role="group" aria-label="Alineación del texto">{([["left","Izquierda"],["center","Centrar"],["right","Derecha"]] as const).map(([value,label])=><button type="button" key={value} aria-label={label} aria-pressed={styles.textAlign===value} onClick={()=>change({...styles,textAlign:value})}>{label}</button>)}</div>}
      {(["component","container","if","rich","paragraph","heading"].includes(block.type)) && <div className="ee-alignment-control" role="group" aria-label="Alineación vertical del contenido">{([["flex-start","Arriba"],["center","Centro vertical"],["flex-end","Abajo"]] as const).map(([value,label])=><button type="button" key={value} aria-label={label} aria-pressed={(styles.justifyContent||styles.alignContent||"flex-start")===value} onClick={()=>change({...styles,...(["component","container","if"].includes(block.type)?{display:"flex",flexDirection:"column",justifyContent:value}:{alignContent:value})})}>{label}</button>)}</div>}
    </fieldset>}
    <SpacingInspector block={block} onChange={change}/>
    {(block.type === "container" || block.type === "loop") && <FlexLayoutInspector styles={styles} onChange={change}/>}
    <details className="ee-inspector-section" open><summary>Apariencia</summary><div className="ee-inspector-section-body"><div className="ee-row2">
      {block.type !== "image" && <ColorInput label="Color del texto" value={styles.color || ""} onChange={color=>change({...styles,color})} placeholder="#172033"/>}
      <ColorInput label="Color del fondo" value={styles.backgroundColor || ""} onChange={backgroundColor=>change({...styles,backgroundColor})}/>
      {block.type !== "image" && <LengthInput label="Tamaño del texto" value={styles.fontSize || ""} onChange={fontSize=>change({...styles,fontSize})} placeholder="16px"/>}
      <LengthInput label="Radio de las esquinas" value={styles.borderRadius || ""} onChange={borderRadius=>change({...styles,borderRadius})} placeholder="8px"/>
    </div></div></details>
  </div>;
}
