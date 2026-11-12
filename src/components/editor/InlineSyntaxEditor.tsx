import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { isSafeInlineExpression } from "../../services/emailBlocks";

type Option = { value: string; label: string };
type Props = {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  onSelect: React.ReactEventHandler<HTMLTextAreaElement>;
};

const simplePath = /^[\w$]+(?:\.[\w$]+)*$/;

const InlineSyntaxEditor = forwardRef<HTMLTextAreaElement, Props>(function InlineSyntaxEditor({ value, options, onChange, onSelect }, forwardedRef) {
  const localRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  useImperativeHandle(forwardedRef, () => localRef.current!, [value]);
  const [suggestion, setSuggestion] = useState<{ open: number; termStart: number; query: string; math: boolean } | null>(null);
  const [active, setActive] = useState(0);
  const candidates = useMemo(() => suggestion
    ? options.filter(item => item.value.toLowerCase().startsWith(suggestion.query.toLowerCase())).slice(0, 8)
    : [], [options, suggestion]);

  const updateSuggestions = (text: string, cursor: number) => {
    const before = text.slice(0, cursor);
    const open = before.lastIndexOf("${");
    if (open < 0 || before.slice(open + 2).includes("}")) { setSuggestion(null); return; }
    const expression = before.slice(open + 2);
    const math = /[+*/()\-]/.test(expression);
    const term = expression.match(/([\w$.]*)$/)?.[1];
    if (term === undefined) { setSuggestion(null); return; }
    const termStart = cursor - term.length;
    setSuggestion({ open, termStart, query: term, math }); setActive(0);
  };

  useEffect(() => {
    const input = localRef.current;
    if (input && document.activeElement === input) updateSuggestions(value, input.selectionStart);
  }, [value, options]);

  const accept = (option: Option) => {
    if (!suggestion) return;
    const input = localRef.current;
    const cursor = input?.selectionStart ?? value.length;
    let next: string, caret: number;
    if (suggestion.math) {
      next = value.slice(0, suggestion.termStart) + option.value + value.slice(cursor);
      caret = suggestion.termStart + option.value.length;
    } else {
      const close = value.indexOf("}", cursor);
      const end = close >= 0 ? close + 1 : cursor;
      const marker = `\${${option.value}}`;
      next = value.slice(0, suggestion.open) + marker + value.slice(end);
      caret = suggestion.open + marker.length;
    }
    onChange(next); setSuggestion(null);
    requestAnimationFrame(() => { input?.focus(); input?.setSelectionRange(caret, caret); });
  };

  const highlight = useMemo(() => {
    const parts: React.ReactNode[] = [];
    const pattern = /\$\{([^{}]*)\}/g;
    let offset = 0;
    for (const match of value.matchAll(pattern)) {
      const index = match.index ?? 0;
      if (index > offset) parts.push(value.slice(offset, index));
      const raw = match[1].trim();
      const math = !simplePath.test(raw);
      const expression = raw;
      const valid = math ? isSafeInlineExpression(expression) : simplePath.test(expression);
      const known = options.some(option => option.value === expression);
      const className = !valid ? "invalid" : !known && !math ? "unknown" : math ? "math" : "variable";
      parts.push(<mark className={`ee-syntax-mark ${className}`} key={`mark-${index}`} title={valid ? expression : "Sintaxis no válida"}>{match[0]}</mark>);
      offset = index + match[0].length;
    }
    if (offset < value.length) parts.push(value.slice(offset));
    return parts.length ? parts : " ";
  }, [value, options]);

  const validation = useMemo(() => {
    const tokens = Array.from(value.matchAll(/\$\{([^{}]*)\}/g));
    const invalid = tokens.filter(match => {
      const raw = match[1].trim();
      return !isSafeInlineExpression(raw);
    });
    const openCount = (value.match(/\$\{/g) ?? []).length;
    const closeCount = (value.match(/\}/g) ?? []).length;
    const remainder = value.replace(/\$\{[^{}]*\}/g, "");
    if (invalid.length || openCount !== closeCount || /[{}]/.test(remainder)) return { kind: "error", text: "Revisa la sintaxis de las expresiones ${…}." };
    const unknown = tokens.filter(match => {
      const raw = match[1].trim();
      return simplePath.test(raw) && !options.some(option => option.value === raw);
    });
    if (unknown.length) return { kind: "warning", text: `${unknown.length} variable${unknown.length > 1 ? "s" : ""} no encontrada${unknown.length > 1 ? "s" : ""} en los datos disponibles.` };
    return { kind: "valid", text: "Sintaxis correcta · las variables se muestran en color." };
  }, [value, options]);

  return <div className="ee-syntax-editor">
    <pre ref={highlightRef} className="ee-syntax-highlight" aria-hidden="true">{highlight}</pre>
    <textarea ref={localRef} value={value} spellCheck={false} onChange={event => { onChange(event.target.value); updateSuggestions(event.target.value, event.target.selectionStart); }}
      onSelect={event => { onSelect(event); updateSuggestions(event.currentTarget.value, event.currentTarget.selectionStart); }}
      onClick={event => updateSuggestions(event.currentTarget.value, event.currentTarget.selectionStart)}
      onKeyUp={event => updateSuggestions(event.currentTarget.value, event.currentTarget.selectionStart)}
      onFocus={event => updateSuggestions(event.currentTarget.value, event.currentTarget.selectionStart)}
      onScroll={event => { if (highlightRef.current) { highlightRef.current.scrollTop = event.currentTarget.scrollTop; highlightRef.current.scrollLeft = event.currentTarget.scrollLeft; } }}
      onKeyDown={event => {
        if (suggestion && candidates.length && event.key === "ArrowDown") { event.preventDefault(); setActive(index => (index + 1) % candidates.length); }
        else if (suggestion && candidates.length && event.key === "ArrowUp") { event.preventDefault(); setActive(index => (index + candidates.length - 1) % candidates.length); }
        else if (suggestion && candidates.length && (event.key === "Enter" || event.key === "Tab")) { event.preventDefault(); accept(candidates[active]); }
        else if (event.key === "Escape") setSuggestion(null);
      }} />
    {suggestion && candidates.length > 0 && <div className="ee-autocomplete" role="listbox" aria-label="Variables disponibles">
      <div className="ee-autocomplete-heading">{suggestion.math ? "EXPRESIONES" : "VARIABLES"}</div>
      {candidates.map((item, index) => <button type="button" role="option" aria-selected={index === active} key={item.value} className={index === active ? "active" : ""}
        onMouseDown={event => event.preventDefault()} onClick={() => accept(item)}>
        <span className="ee-autocomplete-token">ƒ</span><span><strong>{item.label}</strong><small>{"${"+item.value+"}"}</small></span>
      </button>)}
      <footer>↑↓ navegar · Enter insertar · Esc cerrar</footer>
    </div>}
    <div className={`ee-syntax-status ${validation.kind}`} role="status"><span />{validation.text}</div>
  </div>;
});

export default InlineSyntaxEditor;
