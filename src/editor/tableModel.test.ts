import {it,expect} from "vitest";
import {addColumn,removeColumn,reorderColumns,newRowGroup,type TableBlock} from "./tableModel";
const table:TableBlock={id:"t",type:"table",collection:"products",fields:["name","price","qty"],mergedColumns:[["name","price"]],columnFormats:{price:{type:"currency"}},columnLabels:{price:"Precio"}};
it("removes a column from cells, formats and merges",()=>{
 const patch=removeColumn({...table,rowGroups:[{id:"s",type:"single",cells:{name:{mode:"text",value:"Total"},price:{mode:"text",value:"9"}}}]},"price");
 expect(patch.fields).toEqual(["name","qty"]);expect(patch.mergedColumns).toEqual([]);
 expect(patch.columnFormats).toEqual({});expect(patch.rowGroups?.[0].cells.price).toBeUndefined();
});
it("keeps mixed row sources and uses the visible template syntax for new cells",()=>{
 const block={...table,rowGroups:[newRowGroup(table,"repeat","products","r"),newRowGroup(table,"single","","s")]};
 const patch=addColumn(block,"sku")!;
 expect(patch.rowGroups?.[0].cells.sku).toEqual({mode:"template",value:"${item.sku}"});
 expect(patch.rowGroups?.[1].cells.sku).toEqual({mode:"text",value:""});
 expect(addColumn(table,"price")).toBeNull();
});
it("normalizes merged column order and drops noncontiguous groups after a move",()=>{
 expect(reorderColumns(table,"qty","price").mergedColumns).toEqual([]);
 expect(reorderColumns(table,"price","name").mergedColumns).toEqual([["price","name"]]);
 expect(reorderColumns(table,"missing","name")).toEqual({});
});
