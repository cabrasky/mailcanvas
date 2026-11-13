/** Thymeleaf permits self-closing th:block; HTML parsers do not. */
export function normalizeTemplateMarkup(source: string): string {
  return source.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<\/?[\w:-]+\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi, tag =>
    /^<th:block\b/i.test(tag) && /\/\s*>$/.test(tag)
      ? tag.replace(/\/\s*>$/, "></th:block>")
      : tag,
  );
}
