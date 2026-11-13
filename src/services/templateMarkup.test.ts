import { describe, expect, it } from "vitest";
import { normalizeTemplateMarkup } from "./templateMarkup";
import { parseEmailHtmlToBlocks, emailBlocksToHtml } from "./emailBlocks";
import { renderEmail } from "./emailTemplateRenderer";

const body = `<h2>Hola</h2><p>Pedido confirmado</p>
<th:block th:replace="~{emails/fragments/layout :: orderDetails(\${orderId}, \${orderDate}, \${statusLabel}, \${statusColor})}"/>
<th:block th:replace="~{emails/fragments/layout :: productTable(\${products}, \${totalPrice})}"/>
<p>Seguiremos informando</p>
<th:block th:replace="~{emails/fragments/layout :: ctaButton(\${orderUrl}, 'Ver mi pedido', '#8B5CF6')}"/>`;

describe("Thymeleaf self-closing blocks", () => {
  it("keeps every following email block as a sibling on import and round trip", () => {
    const blocks = parseEmailHtmlToBlocks(body);
    expect(blocks).toHaveLength(6);
    expect(blocks[5].type).toBe("button");
    const saved = emailBlocksToHtml(blocks);
    expect(parseEmailHtmlToBlocks(saved)).toHaveLength(6);
    expect(saved).toContain("Seguiremos informando");
    expect(saved).toContain("productTable");
  });
  it("preserves content and CTA after replacing a self-closing fragment in preview", () => {
    const result = renderEmail(body, [
      { token: "{{pedido}}", varName: "orderId", label: "Pedido", sample: "P-10" },
      { token: "{{productos}}", varName: "products", label: "Productos", sample: [{ name: "Camiseta", quantity: 2, price: 10 }] },
      { token: "{{total}}", varName: "totalPrice", label: "Total", sample: 20 },
      { token: "{{enlace}}", varName: "orderUrl", label: "Enlace", sample: "https://yambo.example/orders/10" },
    ]);
    expect(result.html).toContain("Camiseta");
    expect(result.html).toContain("Seguiremos informando");
    expect(result.html).toContain("Ver mi pedido");
  });
  it("handles quoted greater-than signs without modifying comments, raw text or ordinary void tags", () => {
    const source = `<!-- <th:block/> --><script>"<th:block/>"</script><img src="test"/><th:block th:if="\${quantity > 1}" />`;
    const result = normalizeTemplateMarkup(source);
    expect(result).toBe('<!-- <th:block/> --><script>"<th:block/>"</script><img src="test"/><th:block th:if="${quantity > 1}" ></th:block>');
    expect(normalizeTemplateMarkup(result)).toBe(result);
  });
});
