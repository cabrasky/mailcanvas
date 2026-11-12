import React, { useMemo, useState } from "react";
import EmailEditor from "../src/components/EmailEditor";
import { renderEmail } from "../src/services/emailTemplateRenderer";
import { orderConfirmationTokens } from "./orderConfirmationTemplate";
import "./demo.css";
import { demoEmails, initialComponents } from "./componentLibrary";
import ComponentLibraryManager from "./ComponentLibraryManager";

export default function EmailEditorDemo() {
  const [activeKey,setActiveKey]=useState(demoEmails[0].key);
  const [documents,setDocuments]=useState<Record<string,string>>(()=>Object.fromEntries(demoEmails.map(email=>[email.key,email.html])));
  const [components,setComponents]=useState(initialComponents);
  const [libraryOpen,setLibraryOpen]=useState(false);
  const active=demoEmails.find(email=>email.key===activeKey)!;
  const html=documents[activeKey];
  const setHtml=(value:string)=>setDocuments(current=>({...current,[activeKey]:value}));
  const common=useMemo(()=>({components,footerHtml:"",showEnvelopeHeader:false}),[components]);
  const final = useMemo(() => renderEmail(html, orderConfirmationTokens, activeKey, common), [html, activeKey, common]);
  return <main className="demo-shell">
    <header className="demo-header">
      <a className="demo-brand" href="#"><span className="demo-brand-mark">N</span><span>NORTE <small>STUDIO</small></span></a>
      <div className="demo-header-meta"><span className="demo-template-tag">PLANTILLA</span><strong>Confirmación de pedido</strong><span className="demo-dot">·</span><span>Actualizada ahora</span></div>
      <button className="demo-avatar" aria-label="Perfil">L</button>
    </header>
    <section className="demo-intro"><div><span className="demo-overline">MARKETING / EMAILS</span><h1>Diseña el mensaje, <em>cuida el detalle.</em></h1>
      <p>Un espacio visual para ordenar el contenido, conectar datos y revisar cada versión del correo.</p></div>
      <div className="demo-integration"><span className="demo-integration-icon">{`{ }`}</span><div><strong>Datos de prueba</strong><small>{orderConfirmationTokens.length} variables · listas, objetos y fórmulas</small></div><span className="demo-online">Conectado</span></div>
    </section>
    <EmailEditor defaultMaximized key={activeKey} commonElements={common} navigation={<div className="demo-editor-navigation"><select aria-label="Correo a editar" value={activeKey} onChange={event=>setActiveKey(event.target.value)}>{demoEmails.map(email=><option key={email.key} value={email.key}>{email.name}</option>)}</select><button className="ee-btn" onClick={()=>setLibraryOpen(true)}>◇ Biblioteca</button></div>} value={html} onChange={setHtml} tokens={orderConfirmationTokens} templateKey={activeKey}
      onSave={() => window.alert("Demo: plantilla guardada")}
      onReset={() => setHtml(active.html)}
      onSendTest={() => window.alert("Demo: correo de prueba enviado")}
      onServerPreview={() => window.alert("Demo: aquí se conectaría la vista previa del servidor")}
      title={active.name} />
    {libraryOpen && <ComponentLibraryManager components={components} onChange={setComponents} onClose={()=>setLibraryOpen(false)} />}
    <section className="demo-final">
      <div className="demo-final-heading">
        <span className="demo-overline">ASÍ QUEDARÍA EL CORREO</span>
        <h2>Resultado final, a tamaño real</h2>
        <p>Mismo motor de render que la vista previa del editor (modo «Lado a lado»), aquí sin los límites de ancho del panel — útil para comparar si algo se ve distinto a tamaño completo.</p>
      </div>
      <div className="demo-final-frame">
        <iframe title="Correo final renderizado a tamaño real" sandbox="" srcDoc={final.html} />
      </div>
      {final.warnings.length > 0 && <p className="demo-final-warning">⚠ {final.warnings.slice(0, 4).join(" · ")}</p>}
    </section>
    <footer className="demo-bottom"><span>ENTORNO DE DEMOSTRACIÓN</span><span>El guardado, envío y render del servidor son acciones simuladas.</span></footer>
  </main>;
}
