import { useState } from "react";
import { createRoot } from "react-dom/client";
import { EmailEditor, type EmailToken } from "mailcanvas";
import "mailcanvas/style.css";

const tokens:EmailToken[]=[{token:"{{nombre}}",varName:"nombre",label:"Nombre",sample:"Lucía"}];
function App(){
  const [first,setFirst]=useState('<p>Hola <span th:text="${nombre}">Nombre</span>.</p>');
  const [second,setSecond]=useState('<p>Un segundo documento independiente.</p>');
  const [full,setFull]=useState(false);
  return <main style={{padding:24,fontFamily:"system-ui",background:"#f2f4f8",minHeight:"100vh"}}>
    <h1 style={{fontSize:22}}>Dos editores React en una aplicación</h1>
    <p>Importados desde la librería compilada. Cada instancia conserva su propio documento.</p>
    <EmailEditor title="Editor uno" value={first} onChange={setFirst} tokens={tokens} style={{height:520,minHeight:0}} onMaximizedChange={setFull}/>
    <p>Tamaño ampliado: <output aria-label="Estado maximizado">{full?"sí":"no"}</output> · <output aria-label="HTML primer editor">{first}</output></p>
    <EmailEditor title="Editor dos" value={second} onChange={setSecond} style={{height:380,minHeight:0}}/>
    <output aria-label="HTML segundo editor">{second}</output>
  </main>;
}
createRoot(document.getElementById("root")!).render(<App/>);
