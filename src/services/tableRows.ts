import type { EmailBlock, TableRowGroup, TableColumnFormat } from "./emailBlocks";
import { formatSample, resolveSample } from "./blockPreview";
import type { EmailToken } from "./emailTemplateRenderer";
export type TableBlock = Extract<EmailBlock, {type:"table"}>;
export function resolveCellTemplate(value: string, tokens: EmailToken[], locals: Record<string,unknown>, format?: TableColumnFormat) {
  const single = /^\$\{[^{}]+\}$/.test(value);
  return value.replace(/\$\{([^{}]+)\}/g,(_,expression:string)=>formatSample(resolveSample(single ? columnExpression(expression,format) : expression,tokens,locals)));
}
const quote = (text: string) => `'${text.replace(/\\/g,"\\\\").replace(/'/g,"\\'")}'`;
export function columnExpression(expression: string, format?: TableColumnFormat) {
  if (!format) return expression;
  const decimals = Math.max(0,Math.min(6,Math.round(Number(format.decimals) || 0)));
  const core = format.type === "text" ? `(${expression})` : `#numbers.formatDecimal((${expression}), 1, 'NONE', ${decimals}, 'COMMA')`;
  return [format.prefix ? quote(format.prefix) : "",core,(format.suffix ?? (format.type === "currency" ? " €" : "")) ? quote(format.suffix ?? " €") : ""].filter(Boolean).join(" + ");
}
export function tableRowGroups(block: TableBlock, collection = block.collection): TableRowGroup[] {
  return block.rowGroups ?? [{id:`${block.id}-rows`,type:"repeat",collection,cells:Object.fromEntries(block.fields.map(field=>[field,{mode:"template",value:`\${item.${field}}`}]))}];
}
export function tableSampleRows(block: TableBlock, tokens: EmailToken[], locals: Record<string,unknown> = {}) {
  return tableRowGroups(block).flatMap(group=>{
    const source = group.type === "repeat" ? resolveSample(group.collection ?? "",tokens,locals) : [undefined];
    const items = Array.isArray(source) ? source : [];
    return items.map((item,index)=>({key:`${group.id}-${index}`,groupId:group.id,values:Object.fromEntries(block.fields.map(field=>{
      const cell=group.cells[field];
      const context=group.type === "repeat" ? {...locals,item} : locals;
      return [field,!cell ? "" : cell.mode === "text" ? cell.value : cell.mode === "template" ? resolveCellTemplate(cell.value,tokens,context,block.columnFormats?.[field]) : formatSample(resolveSample(columnExpression(cell.value,block.columnFormats?.[field]),tokens,context))];
    }))}));
  });
}
