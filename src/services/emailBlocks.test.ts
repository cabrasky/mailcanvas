import { describe, expect, it } from "vitest";
import {
  createEmailBlock, emailBlocksToHtml, insertEmailBlock, moveEmailBlock, removeEmailBlock,
  moveEmailBlockToContainer, parseEmailHtmlToBlocks, updateEmailBlock, type EmailBlock,
} from "./emailBlocks";

const tokens = [
  { token: "{{nombre}}", label: "Nombre", varName: "nombre", sample: "Ana" },
  { token: "{{productos}}", label: "Productos", varName: "productos", sample: [{ name: "Té" }] },
];

describe("emailBlocks", () => {
  it("compiles nested control blocks to ordered Thymeleaf", () => {
    const loop = createEmailBlock("loop", tokens, "loop-1");
    const conditional = createEmailBlock("if", tokens, "if-1");
    const nested = insertEmailBlock([loop], "loop-1", conditional);
    const updated = updateEmailBlock(nested, "if-1", block =>
      block.type === "if" ? { ...block, variable: "nombre" } : block
    );
    const html = emailBlocksToHtml(updated);
    expect(html).toContain('th:each="item : ${productos}"');
    expect(html).toContain('th:if="${nombre} != null"');
    expect(html.indexOf("th:each")).toBeLessThan(html.indexOf("th:if"));
  });

  it("supports reordering and removing nested instructions", () => {
    const first = createEmailBlock("heading", tokens, "first");
    const second = createEmailBlock("paragraph", tokens, "second");
    const ordered = moveEmailBlock([first, second], "second", -1);
    expect(ordered.map(block => block.id)).toEqual(["second", "first"]);
    expect(removeEmailBlock(ordered, "second").map(block => block.id)).toEqual(["first"]);
  });

  it("moves pieces between stacks without allowing a block to contain itself", () => {
    const heading = createEmailBlock("heading", tokens, "heading");
    const loop = createEmailBlock("loop", tokens, "loop");
    const moved = moveEmailBlockToContainer([heading, loop], "heading", "loop");
    const markup = emailBlocksToHtml(moved);
    expect(markup).toContain(`<div class="email-loop-loop" th:each="item : \${productos}">`);
    expect(markup).toContain('<h2 class="email-heading-heading">Tu actualización</h2>');
    expect(moveEmailBlockToContainer(moved, "loop", "loop")).toBe(moved);
    expect(moveEmailBlockToContainer(moved, "loop", "heading")).toBe(moved);
  });

  it("compiles editable CSS and safe attributes without event handlers", () => {
    const heading = createEmailBlock("heading", tokens, "heading-1");
    const styled: EmailBlock = {
      ...heading,
      className: 'headline" onmouseover="evil',
      styles: { color: "#123456", fontSize: "24px", "--brand": "blue" },
      attributes: { title: "Hola & adiós", "data-id": "welcome", onclick: "alert(1)", "th:if": "true" },
    };
    const html = emailBlocksToHtml([styled]);
    expect(html).toContain('style="color:#123456;font-size:24px;--brand:blue"');
    expect(html).toContain('title="Hola &amp; adiós"');
    expect(html).toContain('data-id="welcome"');
    expect(html).not.toContain('" onmouseover="');
    expect(html).not.toContain("onclick=");
    expect(html).not.toContain('th:if="true"');
  });

  it("includes image, divider, and spacer blocks in the generated email", () => {
    const blocks: EmailBlock[] = [
      createEmailBlock("image", tokens, "image-1"),
      createEmailBlock("divider", tokens, "divider-1"),
      createEmailBlock("spacer", tokens, "spacer-1"),
    ];
    const html = emailBlocksToHtml(blocks);
    expect(html).toContain("<img");
    expect(html).toContain("<hr");
    expect(html).toContain("height:24px");
  });

  it("neutralizes script-like URLs in link and image blocks", () => {
    const button = createEmailBlock("button", tokens, "button-1");
    const image = createEmailBlock("image", tokens, "image-1");
    const unsafeButton = button.type === "button" ? { ...button, href: "javascript:alert(1)" } : button;
    const unsafeImage = image.type === "image" ? { ...image, src: "data:text/html,attack" } : image;
    const html = emailBlocksToHtml([unsafeButton, unsafeImage]);
    expect(html).toContain('href="#"');
    expect(html).toContain('src="#"');
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:text/html");
  });

  it("keeps dynamic totals, currency and line breaks in one inline flow", () => {
    const blocks = parseEmailHtmlToBlocks('<div style="text-align:right"><span th:text="${subtotal}">113</span> €<br/><span>− <span th:text="${discount}">10</span> €</span><br/><strong>€ <span th:text="${subtotal - discount}">103</span></strong></div>');
    expect(blocks[0].type).toBe("container");
    if (blocks[0].type !== "container") throw new Error("Expected container");
    expect(blocks[0].children).toHaveLength(1);
    expect(blocks[0].children[0].type).toBe("rich");
    const html = emailBlocksToHtml(blocks);
    expect(html).toContain('th:text="${subtotal}"');
    expect(html.match(/<br/g)).toHaveLength(2);
    expect(html).not.toContain("</br>");
    expect(new DOMParser().parseFromString(html, "text/html").querySelectorAll("br")).toHaveLength(2);
    expect(html).toContain('th:text="${subtotal - discount}"');
  });

  it("imports a regular Thymeleaf email as editable text, table, condition, and CTA blocks", () => {
    const source = `<h2>Hola, <span th:text="\${nombre}">Nombre</span></h2>
<p>Tu pedido <strong th:text="\${pedido}">PED-0000</strong> se ha actualizado.</p>
<table width="100%"><tbody><tr th:each="item : \${products}">
<td th:text="\${item.name}">Producto</td><td th:text="\${item.quantity}">1</td><td th:text="\${item.price}">0 €</td>
</tr></tbody></table>
<p th:if="\${estado} != null">Estado: <b th:text="\${estado}">Estado</b></p>
<div th:replace="~{emails/fragments/layout::ctaButton(\${enlace}, 'Seguir mi pedido', '#315ee8')}"></div>`;
    const blocks = parseEmailHtmlToBlocks(source);
    expect(blocks.map(block => block.type)).toEqual(["rich", "rich", "table", "if", "button"]);
    const tableLoop = blocks[2];
    expect(tableLoop.type).toBe("table");
    if (tableLoop.type === "table") {
      expect(tableLoop.cellPadding).toBe("1px");
      expect(tableLoop.borderWidth).toBe("0px");
      expect(tableLoop.headerBackground).toBe("transparent");
    }
    const html = emailBlocksToHtml(blocks);
    expect(html).toContain('th:text="\${nombre}"');
    expect(html).toContain('th:text="\${pedido}"');
    expect(html).toContain('th:each="item : \${products}"');
    expect(html).toContain('th:if="\${estado} != null"');
    expect(html).toContain('th:href="\${enlace}"');
    expect(html).toContain("Seguir mi pedido");
  });
});
