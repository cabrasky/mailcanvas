import { useId, useRef, useState } from "react";
type Option = {value:string;label:string};
export default function ExpressionInput({value,onChange,options,label,placeholder,wrapVariables=false,onFocus,onBlur}:{value:string;onChange:(value:string)=>void;options:Option[];label:string;placeholder?:string;wrapVariables?:boolean;onFocus?:()=>void;onBlur?:()=>void}) {
  const input=useRef<HTMLInputElement>(null);
  const id=useId();
  const [cursor,setCursor]=useState(value.length);
  const [open,setOpen]=useState(false);
  const [active,setActive]=useState(0);
  const term=value.slice(0,cursor).match(/[\w$.]*$/)?.[0] ?? "";
  const beforeCursor=value.slice(0,cursor);
  const insideMarker=beforeCursor.lastIndexOf("${")>beforeCursor.lastIndexOf("}");
  const canSuggest=!wrapVariables||!value.includes("${")||insideMarker;
  const candidates=canSuggest?options.filter(option=>option.value.toLowerCase().startsWith(term.toLowerCase())&&option.value!==term).slice(0,7):[];
  const accept=(option:Option)=>{
    const before=value.slice(0,cursor-term.length);
    const needsClose=before.lastIndexOf("${")>before.lastIndexOf("}")&&!value.slice(cursor).startsWith("}");
    const wrap=wrapVariables&&!needsClose&&!/[+*/]/.test(before)&&!value.slice(cursor).startsWith("}");
    const next=before+(wrap?"${":"")+option.value+(needsClose||wrap?"}":"")+value.slice(cursor);
    onChange(next);setOpen(false);
    const caret=before.length+(wrap?2:0)+option.value.length+(needsClose||wrap?1:0);
    requestAnimationFrame(()=>{input.current?.focus();input.current?.setSelectionRange(caret,caret);});
  };
  return <div className="ee-expression-input"><input ref={input} className="ee-input" aria-label={label} role="combobox" aria-autocomplete="list" aria-expanded={open&&!!candidates.length} aria-controls={id} aria-activedescendant={open&&candidates[active]?`${id}-${active}`:undefined} value={value} placeholder={placeholder}
    onChange={event=>{onChange(event.target.value);setCursor(event.target.selectionStart??event.target.value.length);setOpen(true);setActive(0);}}
    onClick={event=>{setCursor(event.currentTarget.selectionStart??value.length);setOpen(true);setActive(0);}}
    onFocus={event=>{onFocus?.();setCursor(event.currentTarget.selectionStart??value.length);setOpen(true);setActive(0);}}
    onBlur={()=>{setOpen(false);onBlur?.();}} onKeyDown={event=>{
      if(event.key==="Escape"){event.stopPropagation();setOpen(false);}
      if(!open||!candidates.length)return;
      if(event.key==="ArrowDown"||event.key==="ArrowUp"){event.preventDefault();event.stopPropagation();setActive(index=>(index+(event.key==="ArrowDown"?1:-1)+candidates.length)%candidates.length);}
      if((event.key==="Enter"||event.key==="Tab")&&candidates[active]){event.preventDefault();accept(candidates[active]);}
    }}/>
    {open&&!!candidates.length&&<div className="ee-expression-suggestions" role="listbox" id={id}>{candidates.map((option,index)=><button role="option" id={`${id}-${index}`} aria-selected={index===active} key={option.value} onMouseDown={event=>event.preventDefault()} onClick={()=>accept(option)}><code>{wrapVariables?"${"+option.value+"}":option.value}</code><small>{option.label}</small></button>)}</div>}
  </div>;
}
