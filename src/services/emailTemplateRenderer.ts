import { normalizeTemplateMarkup } from "./templateMarkup";
import { evaluate, splitExpressionList } from "./thymeleafExpression";
import { expandComponents, type EmailComponent } from "./emailComponents";

export type EmailToken = {
  token: string;
  label: string;
  varName: string;
  sample: unknown;
};

export type CommonElements = {
  components?: EmailComponent[];
  showEnvelopeHeader?: boolean;
  headerHtml?: string;
  footerHtml?: string;
  organization?: string;
  headerColor?: string;
  headerIcon?: string;
  headerTitle?: string;
};

export type RenderResult = { html: string; warnings: string[] };

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );

const truthy = (v: unknown) => Array.isArray(v) ? v.length > 0 : !!v;
export function buildSampleContext(
  tokens: EmailToken[] = [],
  templateKey = "",
): Record<string, unknown> {
  const context: Record<string, unknown> = {};
  for (const token of tokens) {
    context[token.varName] = token.sample;
    if (token.token) context[token.token.replace(/^\{\{|\}\}$/g, "")] ??= token.sample;
  }

  const defaults: Record<string, Partial<CommonElements>> = {
    "order-admin-updated": { headerColor: "#2563eb", headerIcon: "▣", headerTitle: "Pedido actualizado" },
    invitation: { headerColor: "#2563eb", headerIcon: "✉", headerTitle: "Invitación" },
    "order-created": { headerColor: "#2563eb", headerIcon: "▣", headerTitle: "Nuevo pedido" },
  };
  Object.assign(context, defaults[templateKey] ?? {});
  context.organizacion ??= "Organización de ejemplo";
  context.organization ??= context.organizacion;
  context.dominio ??= "example.test";
  context.anio ??= new Date().getFullYear();
  context.enlace_preferencias ??= "https://example.test/preferences";
  return context;
}

/** Small, deliberately safe expression evaluator. It never evaluates JavaScript. */
function replaceTokens(html: string, context: Record<string, unknown>, warnings: string[]) {
  return html.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key) => {
    const value = key.split(".").reduce((v: any, k: string) => v?.[k], context as any);
    if (value === undefined) warnings.push(`Token {{${key}}} sin valor de ejemplo`);
    return escapeHtml(value ?? "");
  });
}

const fragments: Record<string, (...args: unknown[]) => string> = {
  ctaButton: (href, label, color = "#3498db") =>
    `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${escapeHtml(color)};border-radius:6px"><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;color:#fff;text-decoration:none;font-weight:600">${escapeHtml(label)}</a></td></tr></table>`,
  orderDetails: (order: any) =>
    `<div style="padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px"><strong>Pedido ${escapeHtml(order?.number ?? "#1042")}</strong><p>Estado: ${escapeHtml(order?.status ?? "En preparación")}</p></div>`,
  productTable: (products: any, total: any) => {
    const rows = (Array.isArray(products) ? products : []).map((p) =>
      `<tr><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(p.name ?? p.nombre ?? "Producto")}</td><td style="padding:8px;text-align:right">${escapeHtml(p.quantity ?? p.cantidad ?? 1)}</td><td style="padding:8px;text-align:right">${escapeHtml(p.price ?? p.precio ?? "—")}</td></tr>`).join("");
    return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><thead><tr><th align="left">Producto</th><th align="right">Ud.</th><th align="right">Precio</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="2" style="padding:8px;text-align:right"><b>Total</b></td><td style="padding:8px;text-align:right"><b>${escapeHtml(total ?? "—")}</b></td></tr></tfoot></table>`;
  },
  issueDetails: (title, description) =>
    `<div style="padding:16px;border-left:4px solid #f59e0b;background:#fffbeb"><strong>${escapeHtml(title ?? "Incidencia")}</strong><p>${escapeHtml(description ?? "Descripción de ejemplo")}</p></div>`,
};

function resolveFragment(expression: string, context: Record<string, unknown>, locals: Record<string, unknown>) {
  const match = expression.match(/::\s*(\w+)\s*\((.*)\)/);
  if (!match) return null;
  const fn = fragments[match[1]];
  if (!fn) return null;
  const args = match[2].trim() ? splitExpressionList(match[2]).map((a) => evaluate(a.trim(), context, locals)) : [];
  return fn(...args);
}

function processElement(el: Element, context: Record<string, unknown>, locals: Record<string, unknown>, warnings: string[]) {
  const attrs = Array.from(el.attributes);
  for (const attr of attrs) {
    if (attr.name === "th:layout:decorate") { el.removeAttribute(attr.name); continue; }
    if (attr.name === "th:with") {
      for (const assignment of splitExpressionList(attr.value)) {
        const m = assignment.match(/^\s*(\w+)\s*=\s*(.+)$/);
        if (m) try { locals[m[1]] = evaluate(m[2], context, locals); } catch { warnings.push(`th:with no resuelto: ${m[1]}`); }
      }
      el.removeAttribute(attr.name);
    }
  }

  const each = el.getAttribute("th:each");
  if (each) {
    const m = each.match(/^\s*(\w+)(?:\s*,\s*(\w+))?\s*:\s*\$\{(.+)\}\s*$/);
    if (!m) { warnings.push(`th:each no soportado: ${each}`); el.remove(); return; }
    let values: unknown[] = [];
    try { const v = evaluate(m[3], context, locals); values = Array.isArray(v) ? v : []; }
    catch { warnings.push(`Lista no resuelta: ${m[3]}`); }
    const parent = el.parentNode;
    if (!parent) return;
    const fragment = el.ownerDocument.createDocumentFragment();
    values.forEach((value, index) => {
      const clone = el.cloneNode(true) as Element;
      clone.removeAttribute("th:each");
      const childLocals = { ...locals, [m[1]]: value };
      if (m[2]) childLocals[m[2]] = { index, count: index + 1, size: values.length, first: index === 0, last: index === values.length - 1 };
      processElement(clone, context, childLocals, warnings);
      fragment.appendChild(clone);
    });
    parent.replaceChild(fragment, el);
    return;
  }

  for (const attr of Array.from(el.attributes)) {
    const name = attr.name;
    try {
      if (name === "th:if" || name === "th:unless") {
        const visible = truthy(evaluate(attr.value, context, locals));
        el.removeAttribute(name);
        if ((name === "th:if" && !visible) || (name === "th:unless" && visible)) { el.remove(); return; }
      } else if (name === "th:text" || name === "th:utext") {
        const value = evaluate(attr.value, context, locals);
        el.innerHTML = name === "th:utext" ? String(value ?? "") : escapeHtml(value);
        el.removeAttribute(name);
      } else if (name === "th:href" || name === "th:src" || name === "th:style") {
        const value = evaluate(attr.value, context, locals);
        el.setAttribute(name.slice(3), String(value ?? ""));
        el.removeAttribute(name);
      } else if (name === "th:replace" || name === "th:insert") {
        const html = resolveFragment(attr.value, context, locals);
        if (html == null) {
          warnings.push(`Fragmento no disponible: ${attr.value}`);
          el.innerHTML = `<div style="padding:12px;border:1px dashed #d97706;color:#92400e;background:#fffbeb">▨ fragmento ${escapeHtml(attr.value)}</div>`;
        } else if (name === "th:replace") {
          const wrapper = el.ownerDocument.createElement("div");
          wrapper.innerHTML = html;
          el.replaceWith(...Array.from(wrapper.childNodes));
          return;
        } else el.innerHTML = html;
        el.removeAttribute(name);
      }
    } catch (error) {
      warnings.push(`${name}: ${error instanceof Error ? error.message : "expresión no resuelta"}`);
      if (name === "th:if" || name === "th:unless") { if (name === "th:if") { el.remove(); return; } }
      if (name === "th:text" || name === "th:utext") el.textContent = "";
      el.removeAttribute(name);
    }
  }
  for (const child of Array.from(el.children)) processElement(child, context, { ...locals }, warnings);
}

export function renderThymeleaf(source: string, context: Record<string, unknown>): RenderResult {
  const warnings: string[] = [];
  if (typeof DOMParser === "undefined") return { html: source, warnings: ["DOMParser no está disponible en este entorno"] };
  const doc = new DOMParser().parseFromString(normalizeTemplateMarkup(source), "text/html");
  for (const child of Array.from(doc.body.children)) processElement(child, context, {}, warnings);
  return { html: doc.body.innerHTML, warnings };
}

export function renderEnvelope(
  bodyHtml: string,
  common: CommonElements = {},
  context: Record<string, unknown> = {},
): string {
  const values = { ...context, organizacion: context.organizacion ?? common.organization ?? "Organización de ejemplo", dominio: context.dominio ?? (typeof window !== "undefined" ? window.location.host : "example.test") };
  const header = replaceTokens(common.headerHtml ?? "", values, []);
  const footer = replaceTokens(common.footerHtml ?? `<p style="margin:0;color:#94a3b8;font-size:12px">© {{anio}} · {{organizacion}} · <a href="{{enlace_preferencias}}">Preferencias</a></p>`, values, []);
  const color = escapeHtml(context.headerColor ?? common.headerColor ?? "#2563eb");
  const title = escapeHtml(context.headerTitle ?? common.headerTitle ?? "Notificación");
  const icon = escapeHtml(context.headerIcon ?? common.headerIcon ?? "✉");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;padding:32px 12px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#1e293b"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="table-layout:fixed;width:100%;max-width:600px;overflow-wrap:break-word;background:#fff;border-radius:12px;overflow:hidden">${common.showEnvelopeHeader === false ? "" : `<tr><td style="padding:24px 32px;background:${color};color:#fff;font-size:20px;font-weight:700">${icon}&nbsp; ${title}</td></tr>`}${header ? `<tr><td style="padding:24px 32px 0">${header}</td></tr>` : ""}<tr><td style="padding:32px">${bodyHtml}</td></tr>${footer ? `<tr><td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0">${footer}</td></tr>` : ""}</table></td></tr></table></body></html>`;
}

export function renderEmail(
  bodyHtml: string,
  tokens: EmailToken[] = [],
  templateKey = "",
  common: CommonElements = {},
): RenderResult {
  const context = buildSampleContext(tokens, templateKey);
  bodyHtml = expandComponents(bodyHtml,common.components??[]);
  const isThymeleaf = /\bth:/.test(bodyHtml);
  const rendered = isThymeleaf ? renderThymeleaf(bodyHtml, context) : { html: replaceTokens(bodyHtml, context, []), warnings: [] };
  return { html: renderEnvelope(rendered.html, common, context), warnings: rendered.warnings };
}

export const EMAIL_SNIPPETS = {
  cta: `<div th:replace="~{emails/fragments/layout::ctaButton(\${enlace}, 'Ver detalles', '#3498db')}"></div>`,
  loop: `<tr th:each="item : \${products}"><td th:text="\${item.name}">Producto</td><td th:text="\${item.quantity}">1</td></tr>`,
  condition: `<p th:if="\${nombre} != null" th:text="\${nombre}">Nombre</p>`,
  title: `<h2>Tu actualización</h2>`,
  paragraph: `<p>Hola, <span th:text="\${nombre}">Nombre</span>.</p>`,
  table: `<table><thead><tr><th>Concepto</th><th>Valor</th></tr></thead><tbody><tr><td th:text="\${nombre}">Nombre</td><td th:text="\${estado}">Estado</td></tr></tbody></table>`,
} as const;
