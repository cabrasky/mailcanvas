import React, { useEffect, useMemo, useRef, useState } from "react";
import Editor, { loader, type OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/language/html/monaco.contribution";
import "monaco-editor/esm/vs/basic-languages/html/html.contribution";
import "monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestController";
import "monaco-editor/min/vs/editor/editor.main.css";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker&inline";
import HtmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker&inline";
import { emmetHTML } from "emmet-monaco-es";
import type { EmailToken } from "../../services/emailTemplateRenderer";
import { getTemplateVariables, inspectTemplate, registerThymeleafCompletions, type TemplateVariable } from "../../services/templateLanguageService";

type Props = { value: string; tokens: EmailToken[]; onChange: (value: string) => void };
const runtime = globalThis as typeof globalThis & { MonacoEnvironment?: { getWorker?: (_workerId: string, label: string) => Worker } };
const environment=runtime.MonacoEnvironment??(runtime.MonacoEnvironment={});
environment.getWorker ??= (_id, label) => label === "html" ? new HtmlWorker() : new EditorWorker();
loader.config({ monaco });
// The standard token adapter tolerates lines whose Monarch state is not initialized yet.
emmetHTML(monaco, ["html"], { tokenizer: "standard" });

export default function TemplateCodeEditor({ value, tokens, onChange }: Props) {
  const variables = useMemo(() => getTemplateVariables(tokens, value), [tokens, value]);
  const variablesRef = useRef(variables); variablesRef.current = variables;
  const [search, setSearch] = useState("");
  const [wrapLines, setWrapLines] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [position, setPosition] = useState({ line: 1, column: 1 });
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const triggerSuggestions = useRef<() => void>(() => undefined);
  const decorations = useRef<string[]>([]);
  const issue = useMemo(() => inspectTemplate(value, variables), [value, variables]);
  const variableGroups = variables.filter(variable => !variable.value.includes(".")).map(root => ({
    root, children: variables.filter(variable => variable.value.startsWith(`${root.value}.`)),
  })).filter(group => !search || `${group.root.label} ${group.root.value} ${group.root.sample} ${group.children.map(child => `${child.value} ${child.sample}`).join(" ")}`.toLowerCase().includes(search.toLowerCase()));
  const variableCount = variables.length;

  const handleMount: OnMount = editor => {
    editorRef.current = editor;
    monaco.editor.defineTheme("email-thymeleaf-dark", {
      base: "vs-dark", inherit: true,
      rules: [
        { token: "tag", foreground: "80B9FF" }, { token: "attribute.name", foreground: "9CDCFE" },
        { token: "attribute.value", foreground: "CE9178" }, { token: "comment", foreground: "75849A", fontStyle: "italic" },
      ],
      colors: {
        "editor.background": "#111827", "editorLineNumber.foreground": "#647187", "editorLineNumber.activeForeground": "#D9E2F0",
        "editorCursor.foreground": "#F4F7FB", "editor.selectionBackground": "#40516B88", "editorIndentGuide.background1": "#263244",
        "editorLineNumber.border": "#111827",
      },
    });
    editor.updateOptions({ theme: "email-thymeleaf-dark" });
    const languageFeatures = registerThymeleafCompletions(() => variablesRef.current,editor.getModel()?.uri.toString());
    const showSuggestions = () => {
      languageFeatures.triggerGeneralSuggestions();
      const suggestAction = editor.getAction("editor.action.triggerSuggest");
      if (suggestAction) void suggestAction.run();
    };
    triggerSuggestions.current = showSuggestions;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, showSuggestions);
    editor.onDidDispose(() => { languageFeatures.dispose(); triggerSuggestions.current = () => undefined; });
    editor.onDidChangeCursorPosition(event => setPosition({ line: event.position.lineNumber, column: event.position.column }));
  };

  useEffect(() => {
    const editor = editorRef.current; const model = editor?.getModel();
    if (!editor || !model) return;
    const start = model.getPositionAt(issue.offset); const end = model.getPositionAt(Math.min(issue.offset + 1, model.getValueLength()));
    const markers: monaco.editor.IMarkerData[] = issue.kind === "valid" ? [] : [{
      severity: issue.kind === "error" ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
      message: issue.message, startLineNumber: start.lineNumber, startColumn: start.column,
      endLineNumber: end.lineNumber, endColumn: Math.max(start.column + 1, end.column), source: "HTML / Thymeleaf",
    }];
    monaco.editor.setModelMarkers(model, "email-thymeleaf", markers);
    const source = model.getValue();
    const expressions = Array.from(source.matchAll(/(?:\$\{|\*\{)[^}]+\}/g)).map(match => {
      const from = model.getPositionAt(match.index ?? 0); const to = model.getPositionAt((match.index ?? 0) + match[0].length);
      return { range: new monaco.Range(from.lineNumber, from.column, to.lineNumber, to.column), options: { inlineClassName: "thymeleaf-expression" } };
    });
    const variableNames = Array.from(source.matchAll(/(?:\$\{|\*\{)([\w$.]+)(?=\})/g)).map(match => {
      const from = model.getPositionAt((match.index ?? 0) + match[0].length - match[1].length); const to = model.getPositionAt((match.index ?? 0) + match[0].length);
      const local = variables.some(variable => variable.value === match[1] && variable.label.includes("elemento de"));
      return { range: new monaco.Range(from.lineNumber, from.column, to.lineNumber, to.column), options: { inlineClassName: local ? "thymeleaf-local-variable" : "thymeleaf-global-variable" } };
    });
    const directives = Array.from(source.matchAll(/\bth:[\w-]+/g)).map(match => {
      const from = model.getPositionAt(match.index ?? 0); const to = model.getPositionAt((match.index ?? 0) + match[0].length);
      return { range: new monaco.Range(from.lineNumber, from.column, to.lineNumber, to.column), options: { inlineClassName: "thymeleaf-directive" } };
    });
    decorations.current = editor.deltaDecorations(decorations.current, [...expressions, ...variableNames, ...directives]);
  }, [issue, variables]);

  const insertVariable = (variable: TemplateVariable) => {
    const editor = editorRef.current; const model = editor?.getModel(); const cursor = editor?.getPosition();
    if (!editor || !model || !cursor) return;
    const selection = editor.getSelection() ?? new monaco.Selection(cursor.lineNumber, cursor.column, cursor.lineNumber, cursor.column);
    editor.executeEdits("insert-template-variable", [{ range: selection, text: `\${${variable.value}}`, forceMoveMarkers: true }]);
    editor.focus();
  };

  return <div className="ee-code-workbench">
    <style>{`
      .ee-code-workbench{display:flex;flex:1;min-height:0;flex-direction:column;overflow:hidden;background:#111827;color:#dbe4f0}
      .ee-code-titlebar{display:flex;align-items:center;justify-content:space-between;height:38px;flex:none;padding:0 12px;border-bottom:1px solid #263142;background:#171f2d;color:#97a6bc;font:10px Inter,system-ui,sans-serif}.ee-code-titlebar>div{display:flex;align-items:center;gap:7px}.ee-code-titlebar strong{color:#d8e0ed;font-weight:500}.ee-code-file-icon{color:#78a9ff;font-weight:700}.ee-code-badge{padding:2px 5px;border:1px solid #344158;border-radius:4px;color:#aab5c8;font-size:8px}.ee-code-tools{display:flex;align-items:center;gap:9px}.ee-code-tools button{padding:4px 7px;border:1px solid #354157;border-radius:4px;background:transparent;color:#91a0b5;font:9px Inter,system-ui,sans-serif;cursor:pointer}.ee-code-tools button.active{border-color:#545bb8;background:#282e4a;color:#d7d8ff}
      .ee-code-body{display:flex;flex:1;min-height:0}.ee-code-workbench .ee-variable-explorer{display:flex;flex:none;width:210px;flex-direction:column;border-right:1px solid #293446;background:#151e2b;font:10px Inter,system-ui,sans-serif}.ee-code-workbench .ee-variable-explorer>header{display:flex;align-items:center;justify-content:space-between;padding:12px 11px 8px;color:#d5deea}.ee-code-workbench .ee-variable-explorer>header strong{font-size:10px}.ee-code-workbench .ee-variable-explorer>header span{color:#8290a5;font-size:9px}.ee-code-workbench .ee-variable-search{display:flex;align-items:center;gap:6px;margin:0 8px 8px;padding:5px 7px;border:1px solid #344155;border-radius:5px;color:#92a0b4}.ee-code-workbench .ee-variable-search input{width:100%;border:0;outline:0;background:transparent;color:#dae3ef;font:9px Inter,system-ui,sans-serif}.ee-code-workbench .ee-variable-search input::placeholder{color:#7e8ba0}
      .ee-code-workbench .ee-variable-list{flex:1;overflow:auto;padding:0 5px}.ee-code-workbench .ee-variable-group{margin:0 0 5px}.ee-code-workbench .ee-variable-row{display:flex;align-items:center;gap:5px;min-height:29px;padding:3px 5px;border-radius:4px}.ee-code-workbench .ee-variable-row:hover{background:#263348}.ee-code-workbench .ee-variable-row button{display:grid;place-items:center;width:18px;height:19px;padding:0;border:0;border-radius:4px;background:transparent;color:#95a5bb;cursor:pointer;font-size:9px}.ee-code-workbench .ee-variable-row button:hover{background:#39495f;color:#fff}.ee-code-workbench .ee-variable-row>span:nth-child(2),.ee-code-workbench .ee-variable-row>span:nth-child(3){display:grid;gap:2px;min-width:0;flex:1}.ee-code-workbench .ee-variable-row strong{overflow:hidden;color:#c9d5e5;font:9px ui-monospace,monospace;text-overflow:ellipsis;white-space:nowrap}.ee-code-workbench .ee-variable-row small{overflow:hidden;color:#8291a6;font-size:8px;text-overflow:ellipsis;white-space:nowrap}.ee-code-workbench .ee-variable-row.root{margin-top:3px;background:#1c2939}.ee-code-workbench .ee-variable-row.root strong{color:#a9c8ff}.ee-code-workbench .ee-variable-row.root.local strong{color:#d6b2ff}.ee-code-workbench .ee-variable-type{display:grid;place-items:center;width:18px;height:18px;flex:none;border-radius:4px;background:#253d50;color:#81d5de;font:700 10px ui-monospace,monospace}.ee-code-workbench .ee-variable-row.root.local .ee-variable-type{background:#392e50;color:#d1a7ff}.ee-code-workbench .ee-variable-insert{font-size:12px!important;opacity:.65}.ee-code-workbench .ee-variable-row:hover .ee-variable-insert{opacity:1}.ee-code-workbench .ee-variable-explorer footer{padding:8px;border-top:1px solid #293446;color:#8290a5;font-size:8px}
      .ee-monaco-wrap{position:relative;flex:1;min-width:0;min-height:0}.ee-monaco-wrap .thymeleaf-expression{background:#6d4ca522}.ee-monaco-wrap .thymeleaf-global-variable{color:#74d5c2!important;font-weight:600}.ee-monaco-wrap .thymeleaf-local-variable{color:#d6a8ff!important;font-weight:600}.ee-monaco-wrap .thymeleaf-directive{color:#80b9ff!important;font-weight:600}
      .ee-code-problems{display:flex;align-items:center;gap:7px;min-height:31px;flex:none;padding:4px 14px;border-top:1px solid #293446;background:#151e2c;color:#aab7c8;font:9px Inter,system-ui,sans-serif}.ee-problem-indicator{display:grid;place-items:center;width:14px;height:14px;border-radius:50%;background:#1c6c50;color:#93e5bc;font-weight:700}.ee-code-problems.warning .ee-problem-indicator{background:#765820;color:#ffe39a}.ee-code-problems.error{color:#ffaaaa}.ee-code-problems.error .ee-problem-indicator{background:#7a3037;color:#ffc5c5}.ee-code-problems button{margin-left:auto;padding:3px 7px;border:1px solid #344155;border-radius:4px;background:#1c2635;color:#aab8cb;font:8px Inter,system-ui,sans-serif;cursor:pointer}.ee-code-status{display:flex;align-items:center;gap:14px;min-height:23px;flex:none;padding:0 12px;background:#4145a5;color:#f1f2ff;font:8px Inter,system-ui,sans-serif}.ee-code-status span:last-child{margin-left:auto}
      @media(max-width:720px){.ee-code-workbench .ee-variable-explorer{width:174px}.ee-code-status{gap:7px}.ee-code-status span:nth-child(2){display:none}}@media(max-width:540px){.ee-code-workbench .ee-variable-explorer{width:132px}.ee-code-workbench .ee-variable-row small{display:none}.ee-code-badge:nth-of-type(2){display:none}}
    `}</style>
    <div className="ee-code-titlebar"><div><span className="ee-code-file-icon">‹›</span><strong>plantilla.html</strong><span className="ee-code-badge">HTML + Thymeleaf</span><span className="ee-code-badge">Emmet · Tab</span></div><div className="ee-code-tools"><span>{variableCount} variables</span><button title="Abrir sugerencias (Ctrl + Espacio)" onClick={() => { editorRef.current?.focus(); triggerSuggestions.current(); }}>ƒ Sugerencias</button><button className={wrapLines ? "active" : ""} aria-pressed={wrapLines} title="Ajustar líneas largas" onClick={() => setWrapLines(current => !current)}>↵ Ajuste</button></div></div>
    <div className="ee-code-body">
      <aside className="ee-variable-explorer" aria-label="Estructura de variables de la plantilla">
        <header><strong>Datos de plantilla</strong><span>{variableCount}</span></header>
        <label className="ee-variable-search"><span>⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar dato o campo…" aria-label="Buscar variables" /></label>
        <div className="ee-variable-list">{variableGroups.map(({ root, children }) => {
          const collapsed = collapsedGroups.has(root.value); const local = root.label.includes("elemento de");
          const shownChildren = children.filter(child => !search || `${child.value} ${child.sample}`.toLowerCase().includes(search.toLowerCase()));
          return <section className="ee-variable-group" key={root.value}>
            <div className={`ee-variable-row root ${local ? "local" : ""}`}>
              <button aria-label={collapsed ? `Expandir ${root.value}` : `Contraer ${root.value}`} title={collapsed ? "Expandir" : "Contraer"} onClick={() => setCollapsedGroups(current => { const next = new Set(current); if (next.has(root.value)) next.delete(root.value); else next.add(root.value); return next; })}>{collapsed ? "›" : "⌄"}</button>
              <span className="ee-variable-type">{local ? "↻" : children.length ? "▱" : "ƒ"}</span><span><strong>{root.value}</strong><small>{root.label.includes("elemento de") ? root.label : root.sample}</small></span>
              <button className="ee-variable-insert" title={"Insertar ${" + root.value + "}"} aria-label={`Insertar variable ${root.value}`} onClick={() => insertVariable(root)}>＋</button>
            </div>
            {!collapsed && shownChildren.map(child => <div className="ee-variable-row" key={child.value} style={{ paddingLeft: 23 }}>
              <span className="ee-variable-type">ƒ</span><span><strong>{child.value.slice(root.value.length + 1)}</strong><small>{child.sample}</small></span>
              <button className="ee-variable-insert" title={"Insertar ${" + child.value + "}"} aria-label={`Insertar variable ${child.value}`} onClick={() => insertVariable(child)}>＋</button>
            </div>)}
          </section>;
        })}</div>
        <footer>Campos de muestra · pulsa + para insertar</footer>
      </aside>
      <div className="ee-monaco-wrap"><Editor height="100%" language="html" theme="email-thymeleaf-dark" value={value} onChange={next => onChange(next ?? "")} onMount={handleMount}
        options={{ automaticLayout: true, minimap: { enabled: false }, lineNumbers: "on", glyphMargin: true, folding: true, foldingStrategy: "auto", stickyScroll: { enabled: true }, bracketPairColorization: { enabled: true }, guides: { indentation: true, bracketPairs: true }, autoClosingBrackets: "always", autoClosingQuotes: "always", autoIndent: "full", formatOnPaste: true, formatOnType: true, suggestOnTriggerCharacters: true, quickSuggestions: { other: true, strings: true, comments: false }, tabCompletion: "on", tabSize: 2, insertSpaces: true, scrollBeyondLastLine: false, wordWrap: wrapLines ? "on" : "off", wrappingIndent: "indent", fontSize: 12, lineHeight: 20, fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", padding: { top: 14, bottom: 24 }, renderLineHighlight: "all", renderValidationDecorations: "on", overviewRulerBorder: false, contextmenu: true }} />
      </div>
    </div>
    <div className={`ee-code-problems ${issue.kind}`}><span className="ee-problem-indicator">{issue.kind === "error" ? "×" : issue.kind === "warning" ? "!" : "✓"}</span><span>{issue.message}</span>{issue.kind !== "valid" && <button onClick={() => { const model = editorRef.current?.getModel(); if (!model) return; const target = model.getPositionAt(issue.offset); editorRef.current?.setPosition(target); editorRef.current?.revealPositionInCenter(target); editorRef.current?.focus(); }}>Ir al problema</button>}</div>
    <div className="ee-code-status"><span>HTML</span><span>Thymeleaf · variables globales y locales ({variableCount})</span><span>Ln {position.line}, Col {position.column}</span><span>UTF-8</span></div>
  </div>;
}

