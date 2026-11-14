import { useEffect, useMemo, useRef, useState } from "react";
import { renderEmail } from "../src/services/emailTemplateRenderer";
import { orderConfirmationTokens } from "./orderConfirmationTemplate";
import { demoEmails } from "./componentLibrary";
import { download, initialDemo, loadDemo, parseDemo, STORAGE_KEY, type DemoSnapshot, type Samples } from "./demoState";

export function useDemoSession() {
  const [initial] = useState(loadDemo);
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [activeKey, setActiveKey] = useState(demoEmails[0].key);
  const [failNext, setFailNext] = useState(false);
  const [notice, setNotice] = useState(initial.savedAt ? "Borradores recuperados del navegador" : "Datos ficticios · ningún correo se envía");
  const persisted = useRef(initial);
  const urls = useRef(new Set<string>());
  useEffect(() => () => { for (const url of urls.current) URL.revokeObjectURL(url); }, []);
  const active = demoEmails.find(email => email.key === activeKey)!;
  const html = draft.documents[activeKey];
  const data = draft.samples[activeKey];
  const tokens = useMemo(() => Object.entries(data).map(([varName, sample]) => ({
    token: `\${${varName}}`, varName, sample,
    label: orderConfirmationTokens.find(token => token.varName === varName)?.label || varName,
  })), [data]);
  const common = useMemo(() => ({ components: draft.components, footerHtml: "", showEnvelopeHeader: false }), [draft.components]);
  const final = useMemo(() => renderEmail(html,tokens,activeKey,common), [html,tokens,activeKey,common]);
  const dirty = html !== saved.documents[activeKey]
    || JSON.stringify(data) !== JSON.stringify(saved.samples[activeKey])
    || JSON.stringify(draft.components) !== JSON.stringify(saved.components);
  const setHtml = (value: string) => setDraft(current => ({ ...current, documents: { ...current.documents, [activeKey]: value } }));
  const setData = (value: Samples) => setDraft(current => ({ ...current, samples: { ...current.samples, [activeKey]: value } }));
  const setComponents = (components: DemoSnapshot["components"]) => setDraft(current => ({ ...current, components }));
  const save = async () => {
    const submitted = { key: activeKey, name: active.name, html, data, components: draft.components };
    const fail = failNext;
    if (fail) setFailNext(false);
    await new Promise(resolve => setTimeout(resolve,600));
    if (fail) { setNotice("Fallo simulado: el borrador sigue pendiente."); throw new Error("Fallo simulado"); }
    const previous = persisted.current;
    const next: DemoSnapshot = {
      ...previous,
      documents: { ...previous.documents, [submitted.key]: submitted.html },
      samples: { ...previous.samples, [submitted.key]: submitted.data },
      components: submitted.components,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
    persisted.current = next;
    setSaved(next);
    setNotice(`${submitted.name}: guardado en este navegador`);
    return true;
  };
  const upload = async (file: File) => {
    const url = URL.createObjectURL(file);
    urls.current.add(url);
    setNotice("Imagen local temporal: al recargar tendrás que volver a subirla.");
    return url;
  };
  const exportFile = (kind: "source"|"rendered"|"bundle") => {
    if (kind === "bundle") download("mailcanvas-demo.json",JSON.stringify({ ...draft, savedAt: null },null,2),"application/json");
    else download(`${activeKey}-${kind}.html`,kind === "source" ? html : final.html,"text/html");
    setNotice("Archivo exportado. Las imágenes locales solo funcionan en esta sesión.");
  };
  const importFile = async (file: File) => {
    if (file.size > 2*1024*1024) throw new Error("Usa un archivo HTML o JSON de menos de 2 MB.");
    const source = await file.text();
    if (/\.json$/i.test(file.name)) setDraft(parseDemo(source));
    else if (/\.html?$/i.test(file.name)) setHtml(source);
    else throw new Error("Selecciona un archivo .html o .json.");
    setNotice("Archivo importado como borrador. Guarda para conservarlo.");
  };
  const reset = () => {
    const baseline = initialDemo();
    setDraft(current => ({ ...current, documents: { ...current.documents, [activeKey]: baseline.documents[activeKey] }, samples: { ...current.samples, [activeKey]: baseline.samples[activeKey] } }));
    setNotice("Ejemplo original restaurado como borrador.");
  };
  return { active, activeKey, setActiveKey, html, data, components: draft.components, tokens, common, final, dirty, notice,
    failNext, setFailNext, setHtml, setData, setComponents, save, upload, exportFile, importFile, reset };
}
