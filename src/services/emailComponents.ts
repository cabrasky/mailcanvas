import { normalizeTemplateMarkup } from "./templateMarkup";
import { templateExpression } from "./valueSyntax";
export type ComponentProperty = {key:string;label:string;type:"text"|"url"|"color"|"boolean"|"number"|"email"|"image"|"date"|"datetime";defaultValue:string};
export type ComponentValue = {mode:"literal"|"expression";value:string};
export type EmailComponent = {key:string;name:string;description:string;category:string;html:string;properties:ComponentProperty[]};
export type ComponentInstance = {componentKey:string;name:string;values:Record<string,ComponentValue>;fallbackHtml:string;properties:ComponentProperty[]};
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const quote=(value:string)=>`'${value.replace(/\\/g,"\\\\").replace(/'/g,"\\'")}'`;
export function componentHtml(instance:ComponentInstance,definition?:EmailComponent):string {
  const properties=definition?.properties??instance.properties;
  const assignments=properties.filter(prop=>/^[\w$]+$/.test(prop.key)).map(prop=>{
    const value=instance.values[prop.key]??{mode:"literal",value:prop.defaultValue};
    const literal=prop.type==="boolean"?String(value.value==="true"):prop.type==="number"?String(Number.isFinite(Number(value.value))?Number(value.value):0):quote(value.value);
    return `${prop.key}=${value.mode==="expression"?(value.value.includes("${")?templateExpression(value.value):value.value):literal}`;
  }).join(", ");
  return `<div data-ee-component="${escape(instance.componentKey)}" data-ee-component-name="${escape(definition?.name??instance.name)}" data-ee-component-values="${escape(JSON.stringify(instance.values))}" data-ee-component-properties="${escape(JSON.stringify(properties))}"${assignments?` th:with="${escape(assignments)}"`:""}>${definition?.html??instance.fallbackHtml}</div>`;
}
export function readComponent(element:Element):ComponentInstance|undefined {
  const key=element.getAttribute("data-ee-component");
  if(!key)return undefined;
  try {
    const values=JSON.parse(element.getAttribute("data-ee-component-values")??"{}");
    const properties=JSON.parse(element.getAttribute("data-ee-component-properties")??"[]");
    if(!values||typeof values!=="object"||Array.isArray(values)||!Array.isArray(properties))return undefined;
    if(Object.values(values).some((value:any)=>!value||!["literal","expression"].includes(value.mode)||typeof value.value!=="string"))return undefined;
    if(properties.some(prop=>!prop||typeof prop.key!=="string"||typeof prop.defaultValue!=="string"))return undefined;
    return {componentKey:key,name:element.getAttribute("data-ee-component-name")??key,values,properties,fallbackHtml:element.innerHTML};
  }catch{return undefined;}
}
export function expandComponents(source:string,definitions:EmailComponent[],depth=0):string {
  if(typeof DOMParser==="undefined"||depth>8)return source;
  const doc=new DOMParser().parseFromString(normalizeTemplateMarkup(source),"text/html");
  // Resolve only outer instances, then recurse into each definition so nested instances stay linked.
  for(const element of Array.from(doc.body.querySelectorAll("[data-ee-component]"))){
    if(element.parentElement?.closest("[data-ee-component]"))continue;
    const instance=readComponent(element);
    if(!instance)continue;
    const definition=definitions.find(item=>item.key===instance.componentKey);
    const rendered=new DOMParser().parseFromString(componentHtml(instance,definition),"text/html").body.firstElementChild!;
    rendered.innerHTML=expandComponents(rendered.innerHTML,definitions,depth+1);
    element.replaceWith(rendered);
  }
  return doc.body.innerHTML;
}
