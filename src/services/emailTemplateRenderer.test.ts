import { describe, expect, it } from "vitest";
import { buildSampleContext, renderEmail, renderThymeleaf, type EmailToken } from "./emailTemplateRenderer";

const tokens: EmailToken[] = [
  { token: "{{nombre}}", label: "Nombre", varName: "nombre", sample: "Ana & Luis" },
  { token: "{{items}}", label: "Productos", varName: "items", sample: [{ name: "Café" }, { name: "Té" }] },
];

describe("emailTemplateRenderer", () => {
  it("builds sample context from configured tokens", () => {
    expect(buildSampleContext(tokens).nombre).toBe("Ana & Luis");
    expect(buildSampleContext(tokens).items).toHaveLength(2);
  });

  it("escapes values inserted into ordinary HTML tokens", () => {
    const result = renderEmail("<p>Hola {{nombre}}</p>", tokens);
    expect(result.html).toContain("Hola Ana &amp; Luis");
    expect(result.html).not.toContain("Hola Ana & Luis");
  });

  it("renders th:text and th:each", () => {
    const result = renderThymeleaf(
      '<ul><li th:each="item : ${items}" th:text="${item.name}">Producto</li></ul>',
      buildSampleContext(tokens),
    );
    expect(result.html).toContain("<li>Café</li>");
    expect(result.html).toContain("<li>Té</li>");
    expect(result.warnings).toHaveLength(0);
  });

  it("evaluates conditional attributes", () => {
    const result = renderThymeleaf(
      '<p th:if="${nombre} != null">Visible</p><p th:unless="${nombre} != null">Oculto</p>',
      buildSampleContext(tokens),
    );
    expect(result.html).toContain("Visible");
    expect(result.html).not.toContain("Oculto");
  });

  it("returns a warning for unsupported expressions instead of executing them", () => {
    const result = renderThymeleaf('<p th:text="${T(java.lang.Runtime).getRuntime()}">x</p>', {});
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
