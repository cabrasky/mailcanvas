import { describe, expect, it } from "vitest";
import { componentHtml, type ComponentInstance, type EmailComponent } from "./emailComponents";
import { emailBlocksToHtml, parseEmailHtmlToBlocks } from "./emailBlocks";
import { renderEmail } from "./emailTemplateRenderer";
const definition:EmailComponent={key:"banner",name:"Aviso",category:"Contenido",description:"Un mensaje",html:'<section><h2 th:text="${title}">Título</h2><p th:if="${visible}" th:text="${message}">Mensaje</p></section>',properties:[{key:"title",label:"Título",type:"text",defaultValue:"Hola"},{key:"message",label:"Mensaje",type:"text",defaultValue:"Gracias, de verdad"},{key:"visible",label:"Visible",type:"boolean",defaultValue:"true"}]};
const instance:ComponentInstance={componentKey:definition.key,name:definition.name,values:{},properties:definition.properties,fallbackHtml:definition.html};
const tokens=[{token:"{{nombre}}",label:"Nombre",varName:"nombre",sample:"Lucía"}];
const render=(source:string,components=[definition])=>new DOMParser().parseFromString(renderEmail(source,tokens,"",{components}).html,"text/html");
describe("linked email components",()=>{
  it("keeps literal numeric properties numeric during rendering",()=>{
    const numeric:EmailComponent={...definition,html:'<p th:text="${quantity + 1}"></p>',properties:[{key:"quantity",label:"Cantidad",type:"number",defaultValue:"2"}]};
    const source=componentHtml({...instance,properties:numeric.properties,fallbackHtml:numeric.html});
    expect(render(source,[numeric]).querySelector("p")?.textContent).toBe("3");
  });
  it("propagates original defaults while preserving per-instance overrides",()=>{
    const source=componentHtml(instance)+componentHtml({...instance,values:{title:{mode:"literal",value:"Mi título"}}});
    const changed={...definition,properties:definition.properties.map(prop=>prop.key==="title"?{...prop,defaultValue:"Nuevo título"}:prop)};
    const doc=render(source,[changed]);
    expect([...doc.querySelectorAll("h2")].map(node=>node.textContent)).toEqual(["Nuevo título","Mi título"]);
    expect([...doc.querySelectorAll("section p")].map(node=>node.textContent)).toEqual(["Gracias, de verdad","Gracias, de verdad"]);
  });
  it("connects typed instance properties to variables and supports boolean overrides",()=>{
    const doc=render(componentHtml({...instance,values:{title:{mode:"expression",value:"nombre"},visible:{mode:"literal",value:"false"}}}));
    expect(doc.querySelector("h2")?.textContent).toBe("Lucía");
    expect(doc.querySelectorAll("section p")).toHaveLength(0);
  });
  it("preserves references, fallback content and overrides when switching code and blocks",()=>{
    const source=componentHtml({...instance,values:{title:{mode:"literal",value:"Una <oferta> & más"}}});
    const blocks=parseEmailHtmlToBlocks(source);
    expect(blocks[0].type).toBe("component");
    if(blocks[0].type!=="component")throw new Error("Expected instance");
    expect(blocks[0].componentKey).toBe("banner");
    expect(blocks[0].values.title.value).toBe("Una <oferta> & más");
    expect(render(emailBlocksToHtml(blocks),[]).querySelector("h2")?.textContent).toBe("Una <oferta> & más");
  });
  it("allows consistent ${…} syntax with mixed text in a component property",()=>{
    const doc=render(componentHtml({...instance,values:{title:{mode:"expression",value:"Hola ${nombre}, ¿qué tal? "},message:{mode:"literal",value:"${nombre}"}}}));
    expect(doc.querySelector("h2")?.textContent).toBe("Hola Lucía, ¿qué tal? ");
    expect(doc.querySelector("section p")?.textContent).toBe("${nombre}");
  });
});
