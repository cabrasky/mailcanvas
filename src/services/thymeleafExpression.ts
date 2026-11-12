type Tok = { type: "id" | "str" | "num" | "op" | "eof"; value: string };
export function splitExpressionList(source:string):string[] {
  const parts:string[]=[];let start=0,depth=0,quoted=false;
  for(let i=0;i<source.length;i++){
    const char=source[i];
    if(char==="\\"&&quoted){i++;continue;}
    if(char==="'"){quoted=!quoted;continue;}
    if(quoted)continue;
    if(char==="(")depth++;
    if(char===")")depth--;
    if(char===","&&depth===0){parts.push(source.slice(start,i));start=i+1;}
  }
  parts.push(source.slice(start));return parts;
}
const truthy = (value: unknown) => Array.isArray(value) ? value.length > 0 : !!value;

function tokenize(source: string): Tok[] {
  const s = source.replace(/('(?:\\.|[^'\\])*')|\$\{([^{}]*)\}/g, (_,quoted:string|undefined,expression:string) => quoted??expression).trim();
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    if (/\s/.test(s[i])) { i++; continue; }
    const rest = s.slice(i);
    const str = rest.match(/^'((?:\\.|[^'])*)'/);
    if (str) { out.push({ type: "str", value: str[1].replace(/\\'/g, "'") }); i += str[0].length; continue; }
    const num = rest.match(/^-?\d+(?:\.\d+)?/);
    if (num) { out.push({ type: "num", value: num[0] }); i += num[0].length; continue; }
    const op = rest.match(/^(===|!==|==|!=|<=|>=|&&|\|\||[()+\-*/%<>,.!])/);
    if (op) { out.push({ type: "op", value: op[0] }); i += op[0].length; continue; }
    const id = rest.match(/^[\w$#]+/);
    if (id) { out.push({ type: "id", value: id[0] }); i += id[0].length; continue; }
    throw new Error(`Token no soportado cerca de "${rest.slice(0, 12)}"`);
  }
  out.push({ type: "eof", value: "" });
  return out;
}

export function evaluate(source: string, context: Record<string, unknown>, locals: Record<string, unknown> = {}): unknown {
  const tokens = tokenize(source);
  let p = 0;
  const peek = () => tokens[p];
  const take = () => tokens[p++];
  const accept = (v: string) => peek().value === v ? (take(), true) : false;
  const expect = (v: string) => { if (!accept(v)) throw new Error(`Se esperaba ${v}`); };
  const resolve = (name: string): unknown => {
    if (name === "null") return null;
    if (name === "true") return true;
    if (name === "false") return false;
    if (name === "this") return locals;
    if (name.startsWith("#strings.")) return name;
    if (name.startsWith("#numbers.")) return name;
    return name in locals ? locals[name] : context[name];
  };
  const primary = (): unknown => {
    const t = take();
    let value: unknown;
    if (t.type === "str") value = t.value;
    else if (t.type === "num") value = Number(t.value);
    else if (t.value === "(") { value = or(); expect(")"); }
    else if (t.type === "id") value = resolve(t.value);
    else throw new Error(`Expresión inesperada: ${t.value}`);

    while (accept(".")) {
      const prop = take();
      if (prop.type !== "id") throw new Error("Propiedad no válida");
      if (accept("(")) {
        if (t.value === "#numbers" && prop.value === "formatDecimal") {
          const args: unknown[] = [];
          if (!accept(")")) { do { args.push(or()); } while (accept(",")); expect(")"); }
          const number = Number(args[0]);
          const decimals = Math.max(0, Math.min(6, Number(args[3]) || 0));
          value = args[0] == null || !Number.isFinite(number) ? "" : number.toFixed(decimals).replace(".", args[4] === "COMMA" ? "," : ".");
          continue;
        }
        expect(")");
        if (prop.value === "size" || prop.value === "length") value = Array.isArray(value) || typeof value === "string" ? value.length : 0;
        else if (prop.value === "isEmpty") value = !value || (Array.isArray(value) && value.length === 0) || value === "";
        else throw new Error(`Método no soportado: ${prop.value}`);
      } else {
        value = value != null ? (value as Record<string, unknown>)[prop.value] : undefined;
      }
    }
    return value;
  };
  const unary = (): unknown => {
    if (accept("!") || (peek().type === "id" && peek().value === "not" && (take(), true))) return !truthy(unary());
    return primary();
  };
  const mul = (): unknown => {
    let a = unary();
    while (["*", "/", "%"].includes(peek().value)) {
      const op = take().value, b = Number(unary());
      a = op === "*" ? Number(a) * b : op === "/" ? Number(a) / b : Number(a) % b;
    }
    return a;
  };
  const add = (): unknown => {
    let a = mul();
    while (peek().value === "+" || peek().value === "-") {
      const op = take().value, b = mul();
      a = op === "+" ? (typeof a === "string" || typeof b === "string" ? String(a ?? "") + String(b ?? "") : Number(a) + Number(b)) : Number(a) - Number(b);
    }
    return a;
  };
  const compare = (): unknown => {
    let a = add();
    while (["==", "===", "!=", "!==", "<", ">", "<=", ">="].includes(peek().value)) {
      const op = take().value, b = add();
      switch (op) {
        case "==": case "===": a = a === b || String(a) === String(b); break;
        case "!=": case "!==": a = !(a === b || String(a) === String(b)); break;
        case "<": a = (a as never) < (b as never); break;
        case ">": a = (a as never) > (b as never); break;
        case "<=": a = (a as never) <= (b as never); break;
        case ">=": a = (a as never) >= (b as never); break;
      }
    }
    return a;
  };
  const and = (): unknown => {
    let a = compare();
    while ((peek().value === "and") || peek().value === "&&") { take(); const b = compare(); a = truthy(a) && truthy(b); }
    return a;
  };
  const or = (): unknown => {
    let a = and();
    while (peek().value === "or" || peek().value === "||") { take(); const b = and(); a = truthy(a) || truthy(b); }
    return a;
  };
  const result = or();
  if (peek().type !== "eof") throw new Error(`Parte no procesada: ${peek().value}`);
  return result;
}

