import type { EmailToken } from "./emailTemplateRenderer";

export type TemplateVariable = { value: string; label: string; sample: string };

function flattenSample(value: unknown, prefix: string, output: Map<string, TemplateVariable>, depth = 0) {
  if (depth > 4 || value == null || typeof value !== "object") return;
  const source = Array.isArray(value) ? value[0] : value;
  if (!source || typeof source !== "object") return;
  Object.entries(source).forEach(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const sample = child == null ? "null" : typeof child === "object" ? Array.isArray(child) ? "lista" : "objeto" : String(child).slice(0, 48);
    output.set(path, { value: path, label: path, sample });
    flattenSample(child, path, output, depth + 1);
  });
}

function sampleForPath(path: string, tokens: EmailToken[], localValues: Map<string, unknown>): unknown {
  if (localValues.has(path)) return localValues.get(path);
  const token = [...tokens].sort((a, b) => b.varName.length - a.varName.length).find(item => path === item.varName || path.startsWith(`${item.varName}.`));
  if (!token) return undefined;
  return path.slice(token.varName.length).split(".").filter(Boolean).reduce<unknown>((value, segment) => {
    const current = Array.isArray(value) ? value[0] : value;
    return current && typeof current === "object" ? (current as Record<string, unknown>)[segment] : undefined;
  }, token.sample);
}

export function getTemplateVariables(tokens: EmailToken[], source = ""): TemplateVariable[] {
  const variables = new Map<string, TemplateVariable>(); const localValues = new Map<string, unknown>();
  tokens.forEach(token => {
    variables.set(token.varName, { value: token.varName, label: token.label || token.varName, sample: token.sample == null ? "null" : typeof token.sample === "object" ? Array.isArray(token.sample) ? `${token.sample.length} elementos` : "objeto" : String(token.sample).slice(0, 48) });
    flattenSample(token.sample, token.varName, variables);
  });
  const each = /\bth:each\s*=\s*["']\s*(\w+)\s*:\s*\$\{([\w$.]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = each.exec(source))) {
    const [, alias, collection] = match; const sample = sampleForPath(collection, tokens, localValues);
    if (sample === undefined) continue;
    const item = Array.isArray(sample) ? sample[0] : sample;
    localValues.set(alias, item); variables.set(alias, { value: alias, label: `${alias} · elemento de ${collection}`, sample: "elemento de lista" });
    flattenSample(item, alias, variables);
  }
  return Array.from(variables.values());
}

export function inspectTemplate(source: string, variables: TemplateVariable[]) {
  const stack: { name: string; offset: number }[] = [];
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  const tags = /<!--[\s\S]*?-->|<\/?([\w:-]+)(?:\s+[^<>]*?)?\s*\/?>/g;
  let match: RegExpExecArray | null;
  while ((match = tags.exec(source))) {
    const text = match[0];
    if (text.startsWith("<!--")) continue;
    const name = match[1].toLowerCase();
    if (text.startsWith("</")) {
      const expected = stack.pop();
      if (!expected || expected.name !== name) return { kind: "error", message: `Etiqueta </${name}> sin apertura coincidente.`, offset: match.index };
    } else if (!text.endsWith("/>") && !voidTags.has(name)) stack.push({ name, offset: match.index });
  }
  const expression = /(?:\$\{|\*\{)[^}]*$/.exec(source);
  if (expression) return { kind: "error", message: "Expresión Thymeleaf incompleta: falta cerrar la llave.", offset: expression.index };
  const openTag = /<[^>]*$/.exec(source);
  if (openTag) return { kind: "error", message: "Etiqueta HTML incompleta: falta >.", offset: openTag.index };
  if (stack.length) return { kind: "warning", message: `<${stack.at(-1)!.name}> permanece abierto.`, offset: stack.at(-1)!.offset };
  const unknown = Array.from(source.matchAll(/\$\{([\w$]+(?:\.[\w$]+)*)\}/g)).find(item => !variables.some(variable => variable.value === item[1]));
  if (unknown) return { kind: "warning", message: `«${unknown[1]}» no aparece en los datos de muestra o en un bucle local.`, offset: unknown.index ?? 0 };
  return { kind: "valid", message: "HTML, Thymeleaf y variables locales sin errores detectados.", offset: source.length };
}

