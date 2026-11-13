import type { EmailComponent } from "../src/services/emailComponents";
import { demoEmails, initialComponents } from "./componentLibrary";
import { orderConfirmationTokens } from "./orderConfirmationTemplate";
export type Samples = Record<string, unknown>;
export type DemoSnapshot = { format: "mailcanvas-demo/v2"; documents: Record<string, string>; components: EmailComponent[]; samples: Record<string, Samples>; savedAt: string | null };
export const STORAGE_KEY = "mailcanvas-demo-v2";
export function defaultSamples(empty = false): Samples {
  const values = Object.fromEntries(orderConfirmationTokens.map(token => [token.varName, token.sample]));
  return structuredClone({ ...values, anio: new Date().getFullYear(), enlace_preferencias: "https://tienda.example/preferencias", ...(empty ? { products: [], totalNumerico: 0, total: "€ 0,00", descuento: 0, costeEnvio: 0 } : {}) });
}
export function initialDemo(): DemoSnapshot {
  return { format: "mailcanvas-demo/v2", documents: Object.fromEntries(demoEmails.map(email => [email.key, email.html])), components: structuredClone(initialComponents), samples: Object.fromEntries(demoEmails.map(email => [email.key, defaultSamples(email.key === "summary")])), savedAt: null };
}
function parseJson(source: string): unknown {
  try { return JSON.parse(source); } catch { throw new Error("Revisa el JSON: falta una coma, una comilla o una llave."); }
}
export function parseSamples(source: string): Samples {
  const data: unknown = parseJson(source);
  if (!data || typeof data !== "object" || Array.isArray(data) || Object.keys(data).some(key => !/^[a-zA-Z_$][\w$]*$/.test(key) || ["__proto__", "constructor", "prototype"].includes(key))) throw new Error("Usa un objeto JSON con nombres de variables válidos.");
  return data as Samples;
}
export function parseDemo(source: string): DemoSnapshot {
  const data = parseJson(source) as DemoSnapshot;
  if (!data || typeof data !== "object" || data.format !== "mailcanvas-demo/v2" || !data.documents || !data.samples || !Array.isArray(data.components)) throw new Error("El archivo no es una demo de MailCanvas compatible.");
  const baseline = initialDemo();
  for (const email of demoEmails) {
    if (typeof data.documents[email.key] === "string") baseline.documents[email.key] = data.documents[email.key];
    if (data.samples[email.key]) baseline.samples[email.key] = parseSamples(JSON.stringify(data.samples[email.key]));
  }
  if (!data.components.every(component => component && typeof component.key === "string" && typeof component.name === "string" && typeof component.html === "string" && Array.isArray(component.properties) && component.properties.every(property => property && typeof property.key === "string" && typeof property.defaultValue === "string"))) throw new Error("Revisa las definiciones de los componentes.");
  baseline.components = data.components;
  baseline.savedAt = typeof data.savedAt === "string" ? data.savedAt : null;
  return baseline;
}
export function loadDemo(): DemoSnapshot {
  try { const source = localStorage.getItem(STORAGE_KEY); return source ? parseDemo(source) : initialDemo(); } catch { return initialDemo(); }
}
export function download(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
