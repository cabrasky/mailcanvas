import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import type { TemplateVariable } from "./templateVariables";

const thymeleafDirectives = [
  ["th:each", 'th:each="item : ${items}"', "Repetir por cada elemento"], ["th:if", 'th:if="${condition}"', "Mostrar si se cumple"], ["th:unless", 'th:unless="${condition}"', "Mostrar salvo que se cumpla"],
  ["th:text", 'th:text="${variable}"', "Texto escapado"], ["th:utext", 'th:utext="${html}"', "HTML sin escapar"], ["th:with", 'th:with="name=${value}"', "Definir una variable local"],
  ["th:href", 'th:href="@{${url}}"', "Enlace dinámico"], ["th:src", 'th:src="@{${url}}"', "Imagen dinámica"], ["th:replace", 'th:replace="~{fragments/layout :: fragment}"', "Reemplazar por un fragmento"],
  ["th:insert", 'th:insert="~{fragments/layout :: fragment}"', "Insertar un fragmento"], ["th:classappend", 'th:classappend="${active ? \'active\' : \'\'}"', "Añadir clase condicional"],
  ["th:style", 'th:style="${style}"', "Estilo dinámico"], ["th:attr", 'th:attr="name=${value}"', "Atributos dinámicos"], ["th:object", 'th:object="${object}"', "Seleccionar objeto"], ["th:field", 'th:field="*{field}"', "Campo de formulario"],
].map(([label, insertText, detail]) => ({ label, insertText, detail }));
const htmlTags = "a article aside b blockquote body br button caption code div em footer h1 h2 h3 head header hr html img input label li main nav ol option p pre section small span strong table tbody td th thead tr ul".split(" ");
const htmlAttributes = "alt aria-label cellpadding cellspacing class colspan height href id lang name rel rowspan role scope style target title type width".split(" ");
export { getTemplateVariables, inspectTemplate } from "./templateVariables";
export type { TemplateVariable } from "./templateVariables";

export function registerThymeleafCompletions(getVariables: () => TemplateVariable[], modelUri?: string) {
  let forceGeneralSuggestions = false;
  const completionProvider = monaco.languages.registerCompletionItemProvider("html", {
    triggerCharacters: ["$", "{", "*", ":", "."],
    provideCompletionItems(model, position) {
      if(modelUri && model.uri.toString()!==modelUri)return {suggestions:[]};
      const lineText = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
      const expressionMatch = /(?:\$\{|\*\{)([\w$.]*)$/.exec(lineText);
      const directiveMatch = /\b(th:[\w-]*)$/.exec(lineText);
      const insideValue = /(?:=\s*["'][^"']*)$/.test(lineText);
      if (expressionMatch) {
        const query = expressionMatch[1]; const start = position.column - query.length;
        return { suggestions: getVariables().filter(variable => variable.value.toLowerCase().startsWith(query.toLowerCase())).map(variable => ({
          label: { label: variable.value, description: variable.sample }, kind: monaco.languages.CompletionItemKind.Variable,
          detail: `${variable.label} · muestra: ${variable.sample}`, insertText: variable.value,
          range: new monaco.Range(position.lineNumber, start, position.lineNumber, position.column), sortText: `0${variable.value}`,
        })) };
      }
      if (directiveMatch) {
        const query = directiveMatch[1]; const start = position.column - query.length;
        return { suggestions: thymeleafDirectives.filter(item => item.label.startsWith(query)).map(item => ({
          label: { label: item.label, description: item.detail }, kind: monaco.languages.CompletionItemKind.Property,
          detail: item.detail, insertText: item.insertText, range: new monaco.Range(position.lineNumber, start, position.lineNumber, position.column), sortText: `0${item.label}`,
        })) };
      }
      if (!insideValue) {
        const tagMatch = /<([A-Za-z][\w-]*)?$/.exec(lineText);
        if (tagMatch) {
          const query = tagMatch[1] ?? ""; const start = position.column - query.length;
          return { suggestions: htmlTags.filter(tag => tag.startsWith(query.toLowerCase())).map(tag => ({
            label: tag, kind: monaco.languages.CompletionItemKind.Struct, detail: `Elemento HTML <${tag}>`,
            insertText: ["br", "hr", "img", "input"].includes(tag) ? `<${tag} />` : `<${tag}>$0</${tag}>`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: new monaco.Range(position.lineNumber, start, position.lineNumber, position.column), sortText: `0${tag}`,
          })) };
        }
        const attributeMatch = /<[A-Za-z][\w-]*(?:\s+[^<>]*?)?\s+([\w:-]*)$/.exec(lineText);
        if (attributeMatch) {
          const query = attributeMatch[1]; const start = position.column - query.length;
          const custom = ["class", ...htmlAttributes, ...thymeleafDirectives.map(item => item.label)];
          return { suggestions: Array.from(new Set(custom)).filter(name => name.startsWith(query)).map(name => ({
            label: name, kind: monaco.languages.CompletionItemKind.Property,
            detail: name.startsWith("th:") ? "Atributo Thymeleaf" : "Atributo HTML",
            insertText: `${name}=\"$0\"`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: new monaco.Range(position.lineNumber, start, position.lineNumber, position.column), sortText: name.startsWith("th:") ? `1${name}` : `0${name}`,
          })) };
        }
      }
      if (forceGeneralSuggestions) {
        forceGeneralSuggestions = false;
        const word = model.getWordUntilPosition(position);
        const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, position.column);
        const variables = getVariables().map(variable => ({ label: variable.value, detail: `${variable.label} · muestra: ${variable.sample}`, insertText: variable.value, kind: monaco.languages.CompletionItemKind.Variable }));
        const directives = thymeleafDirectives.map(item => ({ label: item.label, detail: item.detail, insertText: item.insertText, kind: monaco.languages.CompletionItemKind.Property }));
        const elements = htmlTags.map(tag => ({ label: `<${tag}>`, detail: `Elemento HTML <${tag}>`, insertText: `<${tag}>$0</${tag}>`, kind: monaco.languages.CompletionItemKind.Struct }));
        const attributes = htmlAttributes.map(name => ({ label: name, detail: "Atributo HTML", insertText: `${name}="$0"`, kind: monaco.languages.CompletionItemKind.Property }));
        return { suggestions: [...variables, ...directives, ...elements, ...attributes].map((item, index) => ({
          ...item, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: `${String(index).padStart(3, "0")}${item.label}`,
        })) };
      }
      return { suggestions: [] };
    },
  });
  const hoverProvider = monaco.languages.registerHoverProvider("html", {
    provideHover(model, position) {
      if(modelUri && model.uri.toString()!==modelUri)return null;
      const before = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
      const match = /(?:\$\{|\*\{)([\w$.]+)$/.exec(before);
      if (!match) return null;
      const variable = getVariables().find(item => item.value === match[1]);
      if (!variable) return null;
      const sample = variable.sample.replace(/[`*_{}\[\]()<>#!|]/g, "\\$&");
      return {
        range: new monaco.Range(position.lineNumber, position.column - match[1].length, position.lineNumber, position.column),
        contents: [{ value: `**${variable.label}**\n\nMuestra: \`${sample}\`` }],
      };
    },
  });
  return {
    triggerGeneralSuggestions: () => { forceGeneralSuggestions = true; },
    dispose: () => { completionProvider.dispose(); hoverProvider.dispose(); },
  };
}
