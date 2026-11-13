import { useEffect, useMemo, useRef, useState } from "react";
import EmailEditor from "../src/components/EmailEditor";
import { renderEmail } from "../src/services/emailTemplateRenderer";
import { orderConfirmationTokens } from "./orderConfirmationTemplate";
import { demoEmails } from "./componentLibrary";
import ComponentLibraryManager from "./ComponentLibraryManager";
import DemoTools, { type DemoTool } from "./DemoTools";
import { download, initialDemo, loadDemo, parseDemo, STORAGE_KEY, type DemoSnapshot, type Samples } from "./demoState";
import "./demo.css";

export default function EmailEditorDemo() {
  const [initial] = useState(loadDemo);
  const [activeKey, setActiveKey] = useState(demoEmails[0].key);
  const [documents, setDocuments] = useState(initial.documents);
  const [components, setComponents] = useState(initial.components);
  const [samples, setSamples] = useState(initial.samples);
  const [saved, setSaved] = useState(initial);
  const savedRef = useRef(initial); savedRef.current = saved;
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [tool, setTool] = useState<DemoTool | null>(null);
  const [failNext, setFailNext] = useState(false);
  const [notice, setNotice] = useState(initial.savedAt ? "Borradores recuperados del navegador" : "Datos ficticios · ningún correo se envía");
  const localImages = useRef(new Set<string>());
  useEffect(() => () => { for (const url of localImages.current) URL.revokeObjectURL(url); }, []);
  const active = demoEmails.find(email => email.key === activeKey)!;
  const html = documents[activeKey];
  const data = samples[activeKey];
  const setHtml = (value: string) => setDocuments(current => ({ ...current, [activeKey]: value }));
  const setData = (value: Samples) => setSamples(current => ({ ...current, [activeKey]: value }));
  const tokens = useMemo(() => Object.entries(data).map(([varName, sample]) => ({ token: `\${${varName}}`, varName, label: orderConfirmationTokens.find(token => token.varName === varName)?.label ?? varName, sample })), [data]);
  const common = useMemo(() => ({ components, footerHtml: "", showEnvelopeHeader: false }), [components]);
  const final = useMemo(() => renderEmail(html, tokens, activeKey, common), [html, tokens, activeKey, common]);
  const dirty = html !== saved.documents[activeKey] || JSON.stringify(data) !== JSON.stringify(saved.samples[activeKey]) || JSON.stringify(components) !== JSON.stringify(saved.components);
  const save = async () => {
    const key = activeKey; const name = active.name;
    const snapshot = { html, components, data };
    const fail = failNext; if (fail) setFailNext(false);
    await new Promise(resolve => setTimeout(resolve, 600));
    if (fail) { setNotice("Fallo simulado: el borrador sigue pendiente."); throw new Error("Fallo simulado"); }
    const previous = savedRef.current;
    const next: DemoSnapshot = { ...previous, documents: { ...previous.documents, [key]: snapshot.html }, samples: { ...previous.samples, [key]: snapshot.data }, components: snapshot.components, savedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    savedRef.current = next; setSaved(next);
    setNotice(`${name}: guardado en este navegador`);
    return true;
  };
  const upload = async (file: File) => {
    const url = URL.createObjectURL(file); localImages.current.add(url);
    setNotice("Imagen local temporal: al recargar tendrás que volver a subirla.");
    return url;
  };
  const exportFile = (kind: "source" | "rendered" | "bundle") => {
    if (kind === "bundle") download("mailcanvas-demo.json", JSON.stringify({ format: "mailcanvas-demo/v2", documents, components, samples, savedAt: null }, null, 2), "application/json");
    else download(`${activeKey}-${kind}.html`, kind === "source" ? html : final.html, "text/html");
    setNotice("Archivo exportado. Las imágenes locales solo funcionan en esta sesión.");
  };
  const importFile = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) throw new Error("Usa un archivo HTML o JSON de menos de 2 MB.");
    const source = await file.text();
    if (/\.json$/i.test(file.name)) { const imported = parseDemo(source); setDocuments(imported.documents); setComponents(imported.components); setSamples(imported.samples); }
    else if (/\.html?$/i.test(file.name)) setHtml(source);
    else throw new Error("Selecciona un archivo .html o .json.");
    setNotice("Archivo importado como borrador. Guarda para conservarlo.");
  };
  return <main className="demo-shell">
    <header className="demo-header"><a className="demo-brand" href="#"><span className="demo-brand-mark">N</span><span>NORTE <small>STUDIO</small></span></a><div className="demo-header-meta"><span className="demo-template-tag">DEMO</span><strong>{active.name}</strong><span>Guardado local en este navegador</span></div></header>
    <section className="demo-intro"><div><span className="demo-overline">MAILCANVAS / LABORATORIO</span><h1>Diseña, prueba <em>y compara.</em></h1><p>{demoEmails.length} correos y {components.length} componentes compartidos. Cambia los datos, prueba un fallo al guardar y exporta el resultado.</p></div><div className="demo-integration"><div><strong>Datos de ejemplo</strong><small>{tokens.length} variables · objetos, listas y números</small></div></div></section>
    <EmailEditor defaultMaximized key={activeKey} commonElements={common} dirty={dirty}
      navigation={<div className="demo-editor-navigation"><select aria-label="Correo a editar" value={activeKey} onChange={event => setActiveKey(event.target.value)}>{demoEmails.map(email => <option key={email.key} value={email.key}>{email.name}</option>)}</select><button className="ee-btn" onClick={() => setLibraryOpen(true)}>◇ Biblioteca</button><button className="ee-btn" onClick={() => setTool("data")}>Probar funciones</button><span className="demo-session-notice" role="status" title={notice}>{notice}</span></div>}
      value={html} onChange={setHtml} tokens={tokens} templateKey={activeKey} onSave={save} onUploadImage={upload}
      onReset={() => setTool("reset")} onSendTest={() => setTool("test")} onServerPreview={() => setTool("preview")} title={active.name} />
    {libraryOpen && <ComponentLibraryManager components={components} onChange={setComponents} onClose={() => setLibraryOpen(false)} />}
    {tool && <DemoTools tool={tool} samples={data} onSamples={setData} failNext={failNext} onFailNext={setFailNext} onClose={() => setTool(null)} onExport={exportFile} onImport={importFile} onReset={() => { const defaults = initialDemo(); setHtml(defaults.documents[activeKey]); setData(defaults.samples[activeKey]); setNotice("Ejemplo original restaurado como borrador."); }} preview={final.html} />}
    <section className="demo-final"><div className="demo-final-heading"><span className="demo-overline">RESULTADO LOCAL</span><h2>{active.name}</h2><p>La misma vista previa que el editor, a tamaño real. Usa Probar funciones para cambiar datos y descargar el HTML.</p></div><div className="demo-final-frame"><iframe title="Correo final renderizado a tamaño real" sandbox="allow-same-origin" srcDoc={final.html} /></div>{final.warnings.length > 0 && <p className="demo-final-warning">{final.warnings.slice(0, 4).join(" · ")}</p>}</section>
    <footer className="demo-bottom"><span>ENTORNO DE DEMOSTRACIÓN</span><span>Guardado local · imágenes subidas temporales · sin servidor ni envío real</span></footer>
  </main>;
}
