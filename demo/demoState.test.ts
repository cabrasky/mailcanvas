import { beforeEach, expect, it } from "vitest";
import { defaultSamples, initialDemo, loadDemo, parseDemo, parseSamples, STORAGE_KEY } from "./demoState";
beforeEach(() => localStorage.clear());
it("provides six independent documents with typed and empty example data", () => {
  const state = initialDemo();
  expect(Object.keys(state.documents)).toHaveLength(6);
  expect(state.samples.summary.products).toEqual([]);
  expect(defaultSamples().totalNumerico).toBe(113);
  expect(Array.isArray(defaultSamples().products)).toBe(true);
});
it("round-trips saved drafts without losing component properties or structured data", () => {
  const state = initialDemo(); state.documents.welcome = "<h1>Mi borrador</h1>";
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  expect(loadDemo().documents.welcome).toBe("<h1>Mi borrador</h1>");
  expect(parseDemo(JSON.stringify(state)).components.find(item => item.key === "metric")?.properties[0].type).toBe("number");
});
it("rejects invalid data and bundles without replacing usable defaults", () => {
  expect(() => parseSamples("[]")).toThrow();
  expect(() => parseSamples('{"__proto__":{}}')).toThrow();
  expect(() => parseDemo("null")).toThrow();
  localStorage.setItem(STORAGE_KEY, "invalid"); expect(Object.keys(loadDemo().documents)).toHaveLength(6);
});
