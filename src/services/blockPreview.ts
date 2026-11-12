import { evaluate } from "./thymeleafExpression";
import { buildSampleContext, type EmailToken } from "./emailTemplateRenderer";

export function resolveSample(expression: string, tokens: EmailToken[], locals: Record<string, unknown> = {}): unknown {
  try {
    return evaluate(expression, buildSampleContext(tokens), locals);
  } catch {
    return undefined;
  }
}

export function formatSample(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return `${value.length} elementos`;
  if (typeof value === "object") return "objeto";
  return String(value);
}

export function firstSampleItem(collectionExpression: string, tokens: EmailToken[]): unknown {
  const value = resolveSample(collectionExpression, tokens);
  return Array.isArray(value) ? value[0] : undefined;
}
