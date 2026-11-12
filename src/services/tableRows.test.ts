import { describe, expect, it } from "vitest";
import { emailBlocksToHtml, parseEmailHtmlToBlocks, type EmailBlock } from "./emailBlocks";
import { tableSampleRows } from "./tableRows";
import { renderEmail } from "./emailTemplateRenderer";
const tokens=[{token:"{{products}}",varName:"products",label:"Productos",sample:[{name:"Bolso",qty:2,price:12.5},{name:"Libro",qty:1,price:3}]},{token:"{{extras}}",varName:"extras",label:"Extras",sample:[{label:"Envío",amount:4}]},{token:"{{total}}",varName:"total",label:"Total",sample:32}];
const table: Extract<EmailBlock,{type:"table"}>={id:"mixed",type:"table",collection:"products",fields:["concepto","importe"],header:true,columnLabels:{concepto:"Concepto",importe:"Importe"},columnFormats:{importe:{type:"currency",decimals:2}},rowGroups:[
  {id:"products-rows",type:"repeat",collection:"products",cells:{concepto:{mode:"expression",value:"item.name"},importe:{mode:"expression",value:"item.qty * item.price"}}},
  {id:"extras-rows",type:"repeat",collection:"extras",cells:{concepto:{mode:"expression",value:"item.label"},importe:{mode:"expression",value:"item.amount"}}},
  {id:"total-row",type:"single",cells:{concepto:{mode:"text",value:"Total <pedido>"},importe:{mode:"expression",value:"total"}}},
  {id:"note-row",type:"single",cells:{concepto:{mode:"text",value:"Gracias"},importe:{mode:"text",value:"Incluido"}}},
]};
describe("mixed-source tables",()=>{
  it("combines independent arrays, computed values, global variables and static rows in order",()=>{
    expect(tableSampleRows(table,tokens).map(row=>row.values)).toEqual([
      {concepto:"Bolso",importe:"25,00 €"},{concepto:"Libro",importe:"3,00 €"},{concepto:"Envío",importe:"4,00 €"},{concepto:"Total <pedido>",importe:"32,00 €"},{concepto:"Gracias",importe:"Incluido"},
    ]);
    const rendered=renderEmail(emailBlocksToHtml([table]),tokens,"");
    const doc=new DOMParser().parseFromString(rendered.html,"text/html");
    const body=doc.querySelector('table[data-ee-table-fields]')!;
    expect(body.querySelectorAll("thead tr")).toHaveLength(1);
    expect([...body.querySelectorAll(":scope > tbody > tr")].map(row=>[...row.querySelectorAll("td")].map(cell=>cell.textContent))).toEqual(tableSampleRows(table,tokens).map(row=>[row.values.concepto,row.values.importe]));
    expect(rendered.warnings).toEqual([]);
  });
  it("preserves row sources, formulas, formatting and literal text when reopening generated code",()=>{
    const imported=parseEmailHtmlToBlocks(emailBlocksToHtml([table]));
    expect(imported).toHaveLength(1);
    expect(imported[0].type).toBe("table");
    if(imported[0].type!=="table")throw new Error("Expected table");
    expect(imported[0].rowGroups).toEqual(table.rowGroups);
    expect(imported[0].columnFormats).toEqual(table.columnFormats);
    expect(tableSampleRows(imported[0],tokens)).toEqual(tableSampleRows(table,tokens));
  });
  it("keeps single rows when arrays are empty and escapes prefix/suffix literals",()=>{
    const empty=tokens.map(token=>token.varName==="products"||token.varName==="extras"?{...token,sample:[]}:token);
    expect(tableSampleRows(table,empty)).toHaveLength(2);
    const custom={...table,columnFormats:{importe:{type:"number" as const,decimals:1,prefix:"Precio: ",suffix:" neto"}}};
    expect(tableSampleRows(custom,tokens)[0].values.importe).toBe("Precio: 25,0 neto");
    expect(renderEmail(emailBlocksToHtml([custom]),tokens,"").html).toContain("Precio: 25,0 neto");
  });
  it("supports text with multiple interpolations and formulas, and preserves it through code",()=>{
    const mixed={...table,rowGroups:[{id:"template",type:"repeat" as const,collection:"products",cells:{concepto:{mode:"template" as const,value:"Producto: ${item.name} (${item.qty} uds.)"},importe:{mode:"template" as const,value:"${item.qty * item.price} € netos"}}}]};
    expect(tableSampleRows(mixed,tokens)[0].values).toEqual({concepto:"Producto: Bolso (2 uds.)",importe:"25 € netos"});
    const html=emailBlocksToHtml([mixed]);
    const result=renderEmail(html,tokens,"");
    expect(result.html).toContain("€ netos");
    const imported=parseEmailHtmlToBlocks(html)[0];
    if(imported.type!=="table")throw new Error("Expected table");
    expect(imported.rowGroups).toEqual(mixed.rowGroups);
    expect(tableSampleRows(imported,tokens)).toEqual(tableSampleRows(mixed,tokens));
  });
});
