import type { EmailBlock, TableRowGroup } from "../services/emailBlocks";
import {tableRowGroups} from "../services/tableRows";
export type TableBlock=Extract<EmailBlock,{type:"table"}>;

function validMerges(block:TableBlock,fields:string[]):string[][] {
  return (block.mergedColumns || []).map(group=>fields.filter(field=>group.includes(field))).filter(group=>{
    const indexes=group.map(field=>fields.indexOf(field));
    return group.length>1 && indexes.every((value,index)=>index===0 || value===indexes[index-1]+1);
  });
}
export function reorderColumns(block:TableBlock,moving:string,target:string):Partial<TableBlock> {
  if(moving===target || !block.fields.includes(moving) || !block.fields.includes(target))return {};
  const fields=block.fields.filter(field=>field!==moving);
  fields.splice(fields.indexOf(target),0,moving);
  return {fields,mergedColumns:validMerges(block,fields)};
}
export function removeColumn(block:TableBlock,field:string):Partial<TableBlock> {
  const fields=block.fields.filter(value=>value!==field);
  const keep=<T,>(map:Record<string,T>|undefined)=>Object.fromEntries(Object.entries(map || {}).filter(([key])=>fields.includes(key)));
  return {fields,columnLabels:keep(block.columnLabels),columnWidths:keep(block.columnWidths),columnAlignments:keep(block.columnAlignments),columnFormats:keep(block.columnFormats),
    mergedColumns:validMerges(block,fields),rowGroups:tableRowGroups(block).map(row=>({...row,cells:keep(row.cells)}))};
}
export function addColumn(block:TableBlock,field:string):Partial<TableBlock>|null {
  if(!/^[\w$]+(?:\.[\w$]+)*$/.test(field) || block.fields.includes(field))return null;
  return {fields:[...block.fields,field],rowGroups:tableRowGroups(block).map(row=>({...row,cells:{...row.cells,[field]:{mode:row.type === "repeat"?"template":"text",value:row.type === "repeat"?`\${item.${field}}`:""}}}))};
}
export function newRowGroup(block:TableBlock,type:"repeat"|"single",collection:string,id:string):TableRowGroup {
  return {id,type,...(type === "repeat"?{collection}:{}),cells:Object.fromEntries(block.fields.map(field=>[field,{mode:type === "repeat"?"template":"text",value:type === "repeat"?`\${item.${field}}`:""}]))};
}
