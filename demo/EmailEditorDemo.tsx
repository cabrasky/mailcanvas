import { useState } from "react";
import { previewDocument, PREVIEW_SANDBOX } from "../src/services/previewDocument";
import EmailEditor from "../src/components/EmailEditor";
import { demoEmails } from "./componentLibrary";
import ComponentLibraryManager from "./ComponentLibraryManager";
import DemoTools, { type DemoTool } from "./DemoTools";
import { useDemoSession } from "./useDemoSession";
import "./demo.css";

export default function EmailEditorDemo() {
  const session = useDemoSession();
  const [library, setLibrary] = useState(false);
  const [tool, setTool] = useState<DemoTool | null>(null);
  const navigation = <div className="demo-editor-navigation">
    <select aria-label="Correo a editar" value={session.activeKey} onChange={event => session.setActiveKey(event.target.value)}>
      {demoEmails.map(email => <option key={email.key} value={email.key}>{email.name}</option>)}
    </select>
    <button className="ee-btn" onClick={() => setLibrary(true)}>◇ Biblioteca</button>
    <button className="ee-btn" onClick={() => setTool("data")}>Probar funciones</button>
    <span className="demo-session-notice" role="status" title={session.notice}>{session.notice}</span>
  </div>;

  return <main className="demo-shell">
    <header className="demo-header">
      <a className="demo-brand" href="#"><span className="demo-brand-mark">N</span><span>NORTE <small>STUDIO</small></span></a>
      <div className="demo-header-meta"><span className="demo-template-tag">DEMO</span><strong>{session.active.name}</strong><span>Guardado local en este navegador</span></div>
    </header>
    <section className="demo-intro">
      <div><span className="demo-overline">MAILCANVAS / LABORATORIO</span><h1>Diseña, prueba <em>y compara.</em></h1>
        <p>{demoEmails.length} correos y {session.components.length} componentes compartidos. Cambia los datos, prueba un fallo al guardar y exporta el resultado.</p>
      </div>
      <div className="demo-integration"><div><strong>Datos de ejemplo</strong><small>{session.tokens.length} variables · objetos, listas y números</small></div></div>
    </section>
    <EmailEditor key={session.activeKey} defaultMaximized title={session.active.name} navigation={navigation}
      value={session.html} onChange={session.setHtml} tokens={session.tokens} templateKey={session.activeKey}
      commonElements={session.common} dirty={session.dirty} onSave={session.save} onUploadImage={session.upload}
      onReset={() => setTool("reset")} onSendTest={() => setTool("test")} onServerPreview={() => setTool("preview")} />
    {library && <ComponentLibraryManager components={session.components} onChange={session.setComponents} onClose={() => setLibrary(false)} />}
    {tool && <DemoTools tool={tool} samples={session.data} onSamples={session.setData} failNext={session.failNext} onFailNext={session.setFailNext}
      onClose={() => setTool(null)} onExport={session.exportFile} onImport={session.importFile} onReset={session.reset} preview={session.final.html} />}
    <section className="demo-final">
      <div className="demo-final-heading"><span className="demo-overline">RESULTADO LOCAL</span><h2>{session.active.name}</h2>
        <p>La misma vista previa que el editor, a tamaño real. Usa Probar funciones para cambiar datos y descargar el HTML.</p>
      </div>
      <div className="demo-final-frame"><iframe title="Correo final renderizado a tamaño real" sandbox={`allow-same-origin ${PREVIEW_SANDBOX}`} srcDoc={previewDocument(session.final.html)} /></div>
      {session.final.warnings.length > 0 && <p className="demo-final-warning">{session.final.warnings.slice(0,4).join(" · ")}</p>}
    </section>
    <footer className="demo-bottom"><span>ENTORNO DE DEMOSTRACIÓN</span><span>Guardado local · imágenes subidas temporales · sin servidor ni envío real</span></footer>
  </main>;
}
