import type { EmailBlock } from "../../services/emailBlocks";
import type { EmailComponent } from "../../services/emailComponents";
import ValueInput from "./ValueInput";
type Instance=Extract<EmailBlock,{type:"component"}>;
export default function ComponentInspector({block,components,options,onPatch}:{block:Instance;components:EmailComponent[];options:{value:string;label:string}[];onPatch:(patch:Partial<Instance>)=>void}) {
  const definition=components.find(item=>item.key===block.componentKey);
  const change=(key:string,mode:"literal"|"expression",value:string)=>onPatch({values:{...block.values,[key]:{mode,value}}});
  return <>
    <div className="ee-instance-summary"><strong>◇ {definition?.name??block.name}</strong><code>{block.componentKey}</code><p>Instancia vinculada. Las personalizaciones afectan solo a este uso; los demás valores siguen los del componente original.</p></div>
    {(definition?.properties??block.properties).map(property=>{
      const current=block.values[property.key];
      const value=current?.value??property.defaultValue;
      return <div className="ee-component-property" key={property.key}><div className="ee-field"><span>{property.label} {current&&<small>· Personalizado</small>}</span>
        <ValueInput label={`Propiedad ${property.key}`} value={value} mode={current?.mode==="expression"?"dynamic":"text"} options={options} onChange={(value,mode)=>change(property.key,mode==="dynamic"?"expression":"literal",value)}/>
      </div>{current&&<button className="ee-btn" onClick={()=>{const values={...block.values};delete values[property.key];onPatch({values});}}>Restablecer {property.label}</button>}</div>;
    })}
    <button className="ee-btn" disabled={!Object.keys(block.values).length} onClick={()=>onPatch({values:{}})}>Restablecer todos los valores</button>
  </>;
}
