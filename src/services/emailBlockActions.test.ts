import { describe, expect, it } from "vitest";
import { createEditorBlock, getSampleObjectPaths } from "./emailBlockActions";

describe("getSampleObjectPaths", () => {
  it("lists the keys of a sample object (regression: a double-escaped regex used to make this always return [])", () => {
    expect(getSampleObjectPaths({ name: "Camiseta", sku: "X1" })).toEqual(["name", "sku"]);
  });

  it("uses the first item of a sample array", () => {
    expect(getSampleObjectPaths([{ name: "Camiseta" }, { name: "Pantalón" }])).toEqual(["name"]);
  });
});

describe("createEditorBlock", () => {
  it("auto-detects table columns from the sample data of an array token", () => {
    const tokens = [
      { token: "{{nombre}}", label: "Nombre", varName: "nombre", sample: "Ana" },
      { token: "{{products}}", label: "Productos", varName: "products", sample: [{ name: "Camiseta", sku: "X1" }] },
    ];
    const block = createEditorBlock("table", tokens, "block-1");
    expect(block.type).toBe("table");
    const table = block;
    expect(table?.type === "table" && table.fields).toEqual(["name", "sku"]);
  });
});
