import { describe, expect, it } from "vitest";
import { componentHtml, type ComponentInstance, type EmailComponent } from "./emailComponents";
import { emailBlocksToHtml, parseEmailHtmlToBlocks } from "./emailBlocks";
import { renderEmail } from "./emailTemplateRenderer";
const definition:EmailComponent={key:"banner",name:"Aviso",category:"Contenido",description:"Un mensaje",html:'<section><h2 th:text="${title}">Título</h2><p th:if="${visible}" th:text="${message}">Mensaje</p></section>',properties:[{key:"title",label:"Título",type:"text",defaultValue:"Hola"},{key:"message",label:"Mensaje",type:"text",defaultValue:"Gracias, de verdad"},{key:"visible",label:"Visible",type:"boolean",defaultValue:"true"}]};
const instance:ComponentInstance={componentKey:definition.key,name:definition.name,values:{},properties:definition.properties,fallbackHtml:definition.html};
const tokens=[{token:"{{nombre}}",label:"Nombre",varName:"nombre",sample:"Lucía"}];
const render=(source:string,components=[definition])=>new DOMParser().parseFromString(renderEmail(source,tokens,"",{components}).html,"text/html");
describe("linked email components",()=>{
  it("preserves instance design through export, library expansion and reimport",()=>{
    const styles={maxWidth:"52px",padding:"7px",backgroundColor:"#abcdef",borderRadius:"9px",textAlign:"center"};
    const source=emailBlocksToHtml([{...instance,id:"design",type:"component",styles,className:"campaign-image"}]);
    const node=render(source).querySelector<HTMLElement>("[data-ee-component]")!;
    expect(node.style.maxWidth).toBe("52px");
    expect(node.style.padding).toBe("7px");
    expect(node.style.backgroundColor).toBe("rgb(171, 205, 239)");
    expect(node.style.borderRadius).toBe("9px");
    expect(node.style.textAlign).toBe("center");
    expect(node.className).toBe("campaign-image");
    expect(parseEmailHtmlToBlocks(source)[0].styles).toMatchObject(styles);
  });
  it("exports responsive image defaults without overriding explicit design",()=>{
    const source=emailBlocksToHtml([{id:"image",type:"image",src:"/portrait.png",alt:"Retrato",width:"600",styles:{maxWidth:"120px",borderRadius:"16px"}}]);
    const image=render(source).querySelector("img")!;
    expect(image.style.maxWidth).toBe("120px");
    expect(image.style.height).toBe("auto");
    expect(image.style.borderRadius).toBe("16px");
  });
  it("preserves invalid numeric metadata without exporting an invented zero",()=>{
    for (const value of ["", "not a number"]) {
      const numeric:EmailComponent={...definition,properties:[{key:"quantity",label:"Cantidad",type:"number",defaultValue:"2"}]};
      const source=componentHtml({...instance,properties:numeric.properties,values:{quantity:{mode:"literal",value}}},numeric);
      const node=new DOMParser().parseFromString(source,"text/html").body.firstElementChild!;
      expect(node.getAttribute("th:with")).toBe("quantity=null");
      expect(JSON.parse(node.getAttribute("data-ee-component-values")!).quantity.value).toBe(value);
    }
  });
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

it("fits component backgrounds to resized frames and restores original fallback styles",()=>{
  const source=emailBlocksToHtml([{id:'resized',type:'component',...instance,styles:{width:'360px',height:'200px'}}],{components:[{...definition,html:'<div style="padding:24px;background:#eff2ff"><strong>Cabecera</strong></div>'}]});
  const parsed=new DOMParser().parseFromString(source,'text/html');
  const root=parsed.querySelector<HTMLElement>('[data-ee-component] > div')!;
  expect(root.style.height).toBe('100%');
  expect(root.style.width).toBe('100%');
  expect(root.style.boxSizing).toBe('border-box');
  const reopened=parseEmailHtmlToBlocks(source)[0];
  expect(reopened.type).toBe('component');
  if(reopened.type!=='component')throw new Error('Expected component');
  expect(reopened.fallbackHtml).not.toContain('data-ee-fit-original-style');
  const reset=emailBlocksToHtml([{...reopened,styles:{}}]);
  const resetRoot=new DOMParser().parseFromString(reset,'text/html').querySelector<HTMLElement>('[data-ee-component] > div')!;
  expect(resetRoot.style.height).toBe('');
  expect(resetRoot.style.padding).toBe('24px');
});
