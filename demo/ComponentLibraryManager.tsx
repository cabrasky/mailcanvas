import { useEffect, useRef, useState } from "react";
import type { EmailComponent } from "../src/services/emailComponents";
export default function ComponentLibraryManager({components,onChange,onClose}:{components:EmailComponent[];onChange:(components:EmailComponent[])=>void;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [selected,setSelected]=useState(components[0]?.key??"");
  const [code,setCode]=useState(false);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>previous?.focus();},[]);
  const definition=components.find(component=>component.key===selected);
  const patch=(change:Partial<EmailComponent>)=>onChange(components.map(component=>component.key===selected?{...component,...change}:component));
  return <dialog ref={dialog} className="demo-library-modal" onCancel={onClose} aria-labelledby="library-title">
    <header><div><small>BIBLIOTECA COMPARTIDA</small><h2 id="library-title">Componentes originales</h2></div><button onClick={onClose} aria-label="Cerrar biblioteca">×</button></header>
    <p>Los cambios del original se propagan a todos los correos. Cada instancia conserva las propiedades que hayas personalizado.</p>
    <div className="demo-library-body"><nav aria-label="Componentes originales">{components.map(component=><button key={component.key} aria-pressed={selected===component.key} onClick={()=>{setSelected(component.key);setCode(false);}}><span>◇</span><div><strong>{component.name}</strong><small>{component.category}</small></div></button>)}<button onClick={()=>{const key=`componente-${crypto.randomUUID().slice(0,8)}`;onChange([...components,{key,name:"Nuevo componente",description:"Un bloque compartido",category:"Personalizados",properties:[{key:"title",label:"Título",type:"text",defaultValue:"Nuevo contenido"}],html:'<section style="padding:20px;background:#f5f2fa;border-radius:8px"><h3 th:text="${title}">Nuevo contenido</h3></section>'}]);setSelected(key);}}>＋ Crear componente</button></nav>
    {definition&&<section><label>Nombre<input value={definition.name} onChange={event=>patch({name:event.target.value})}/></label><label>Descripción<input value={definition.description} onChange={event=>patch({description:event.target.value})}/></label><code>{definition.key}</code>
      <div className="demo-library-view"><button aria-pressed={!code} onClick={()=>setCode(false)}>Propiedades</button><button aria-pressed={code} onClick={()=>setCode(true)}>HTML del original</button></div>
      {code?<label>Plantilla HTML compartida<textarea spellCheck={false} value={definition.html} onChange={event=>patch({html:event.target.value})}/><small>Usa Thymeleaf para conectar las propiedades: {"<span th:text=\"${title}\">Título</span>"}</small></label>:<><p>Valores predeterminados. Las instancias pueden usar estos valores o conectar variables.</p>{definition.properties.map((property,index)=><label key={property.key}>{property.label}<span className="demo-property-type">{property.type} · {property.key}</span><input aria-label={property.label} type={property.type==="color"?"color":"text"} value={property.defaultValue} onChange={event=>patch({properties:definition.properties.map((item,i)=>i===index?{...item,defaultValue:event.target.value}:item)})}/></label>)}</>}
    </section>}</div>
    <footer><span>Los cambios se aplican en esta demo. No se escribe en Yambo.</span><button onClick={onClose}>Volver al editor</button></footer>
  </dialog>;
}
