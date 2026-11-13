import { useEffect, useRef, useState } from "react";
import { displayDynamicValue } from "../../services/valueSyntax";
import ExpressionInput from "./ExpressionInput";
import LiteralInput, { ImageDetails, type LiteralType } from "./LiteralInput";
type Props={label:string;value:string;mode:"text"|"dynamic";options:{value:string;label:string}[];onChange:(value:string,mode:"text"|"dynamic")=>void;allowText?:boolean;placeholder?:string;valueType?:LiteralType;literalDefault?:string;onUploadImage?:(file:File)=>Promise<string>};
/** Shared literal/dynamic field; retain a local draft while a parent normalizes expressions. */
export default function ValueInput({label,value,mode,options,onChange,allowText=true,placeholder,valueType="text",literalDefault,onUploadImage}:Props){
  const focused=useRef(false);
  const [draft,setDraft]=useState(()=>mode==="dynamic"?displayDynamicValue(value):value);
  useEffect(()=>{if(!focused.current)setDraft(mode==="dynamic"?displayDynamicValue(value):value);},[value,mode]);
  const change=(text:string)=>{setDraft(text);onChange(text,mode);};
  const switchMode=(next:"text"|"dynamic")=>{const text=next==="dynamic"?displayDynamicValue(value):mode==="dynamic"&&literalDefault!==undefined?literalDefault:value;setDraft(text);onChange(text,next);};
  const field = <div className={`ee-value-input mode-${mode}`}>
    {allowText&&<div className="ee-value-modes" role="group" aria-label={`Tipo de valor: ${label}`}><button type="button" aria-label={`Texto fijo: ${label}`} aria-pressed={mode==="text"} title="Texto fijo" onClick={()=>switchMode("text")}>T</button><button type="button" aria-label={`Valor dinámico: ${label}`} aria-pressed={mode==="dynamic"} title="Variables y fórmulas con ${…}" onClick={()=>switchMode("dynamic")}>ƒ</button></div>}
    {mode==="text" && valueType!=="text" ? <LiteralInput hideImageDetails onUploadImage={onUploadImage} label={label} type={valueType} value={value} onChange={change}/> : <ExpressionInput label={label} value={draft} options={mode==="dynamic"?options:[]} wrapVariables onChange={change} placeholder={placeholder??(mode==="dynamic"?"${variable} o texto con ${variable}":"Texto fijo")}
      onFocus={()=>{focused.current=true;}} onBlur={()=>{focused.current=false;const normalized=mode==="dynamic"?displayDynamicValue(value):value;setDraft(normalized);if(normalized!==value)onChange(normalized,mode);}}/>}
  </div>;
  return valueType === "image" ? <div className="ee-image-field">{field}{mode === "text" && <ImageDetails label={label} value={value} onChange={change} onUploadImage={onUploadImage} />}</div> : field;
}
