import { expect, it } from "vitest";
import { parseInlineText, inlineTextOf } from "./inlineTextModel";
import { evaluate } from "./thymeleafExpression";
import { templateExpression } from "./valueSyntax";
it("uses ${…} for simple values and formulas while accepting old markers",()=>{
  const current=parseInlineText("SKU ${item.sku} · ${item.qty * item.price} € ");
  expect(current.filter(node=>node.type==="variable")).toHaveLength(2);
  expect(inlineTextOf(current)).toBe("SKU ${item.sku} · ${item.qty * item.price} € ");
  expect(inlineTextOf(parseInlineText("{{nombre}} {{= item.qty * item.price}}"))).toBe("${nombre} ${item.qty * item.price}");
});
it("preserves literal markers inside strings and interpolates mixed text with spaces",()=>{
  expect(evaluate("'${pedido}'",{pedido:"PED-1"},{})).toBe("${pedido}");
  expect(evaluate(templateExpression("Pedido: ${pedido} "),{pedido:"PED-1"},{})).toBe("Pedido: PED-1 ");
});
