import type {EmailBlock} from "../services/emailBlocks";
import {inlineTextOf} from "../services/inlineTextModel";
export type LayerEntry={block:EmailBlock;parentId:string|null;depth:number;index:number;siblingCount:number;path:string[]};
export const layerTypes:Record<EmailBlock["type"],string>={component:"Componente",html:"HTML protegido",heading:"Título",paragraph:"Texto",rich:"Texto",variable:"Dato",button:"Botón",image:"Imagen",divider:"Separador",spacer:"Espaciador",table:"Tabla",container:"Grupo",loop:"Repetir",if:"Condición"};
export const layerGlyphs:Record<EmailBlock["type"],string>={component:"◇",html:"<>",heading:"T",paragraph:"¶",rich:"¶",variable:"ƒ",button:"↗",image:"▧",divider:"—",spacer:"↕",table:"▦",container:"▱",loop:"⟳",if:"◇"};
export function blockChildren(block:EmailBlock):EmailBlock[] {
 return block.type === "container" || block.type === "loop" || block.type === "if"?block.children:[];
}
export function layerName(block:EmailBlock):string {
 switch(block.type){
  case "component":return block.name;
  case "heading":case "paragraph":case "button":return block.text || layerTypes[block.type];
  case "rich":return inlineTextOf(block.children) || "Texto";
  case "image":return block.alt || "Imagen";
  case "variable":return block.expression;
  case "if":return `Si ${block.variable}`;
  case "loop":return `Repetir ${block.collection}`;
  case "table":return block.collection?`Tabla · ${block.collection}`:"Tabla";
  case "container":return block.className || (block.styles?.display === "flex"?"Fila":"Grupo");
  default:return layerTypes[block.type];
 }
}
export function layerIndex(blocks:EmailBlock[]):Map<string,LayerEntry> {
 const result=new Map<string,LayerEntry>();
 const visit=(items:EmailBlock[],parentId:string|null,path:string[])=>items.forEach((block,index)=>{
  const nextPath=[...path,block.id];
  result.set(block.id,{block,parentId,path:nextPath,depth:path.length,index,siblingCount:items.length});
  visit(blockChildren(block),block.id,nextPath);
 });
 visit(blocks,null,[]);return result;
}
export function canDropLayer(index:Map<string,LayerEntry>,moving:string,target:string):boolean {
 return index.has(moving) && index.has(target) && !index.get(target)!.path.includes(moving);
}
