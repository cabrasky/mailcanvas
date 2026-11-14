import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import type { EmailBlock } from "../../services/emailBlocks";
import BlockInspector from "./BlockInspector";
afterEach(cleanup);

function Harness({ initial }: { initial: EmailBlock }) {
  const [block, setBlock] = useState<EmailBlock>(initial);
  return <><BlockInspector block={block} tokens={[]} onPatch={(_, patch) => setBlock(value => ({ ...value, ...patch, styles: { ...value.styles, ...patch.styles } } as EmailBlock))} onInsertVariable={() => {}} /><output>{JSON.stringify(block.styles)}</output></>;
}

it("aligns a button by moving its box (margin), not its inner text", () => {
  const button: EmailBlock = { id: "btn-1", type: "button", text: "Comprar", href: "https://example.test", className: "", classStyles: {}, attributes: {}, styles: {} };
  render(<Harness initial={button} />);
  fireEvent.click(screen.getByRole("tab", { name: "Diseño" }));
  fireEvent.click(screen.getByRole("button", { name: "Centrar" }));
  const output = screen.getByText(/marginLeft/);
  expect(output).toHaveTextContent('"display":"table"');
  expect(output).toHaveTextContent('"marginLeft":"auto"');
  expect(output).toHaveTextContent('"marginRight":"auto"');
  expect(output).not.toHaveTextContent("textAlign");
});

it("aligns a heading's text with text-align, not a position margin", () => {
  const heading: EmailBlock = { id: "h-1", type: "heading", text: "Hola", className: "", classStyles: {}, attributes: {}, styles: {} };
  render(<Harness initial={heading} />);
  fireEvent.click(screen.getByRole("tab", { name: "Diseño" }));
  fireEvent.click(screen.getByRole("button", { name: "Centrar" }));
  const output = screen.getByText(/textAlign/);
  expect(output).toHaveTextContent('"textAlign":"center"');
  expect(output).not.toHaveTextContent("marginLeft");
});

it("retains vertical layout when positioning a component horizontally", () => {
  render(<Harness initial={{id:"component",type:"component",componentKey:"test",name:"Test",values:{},properties:[],fallbackHtml:"<p>Contenido</p>",styles:{display:"flex",flexDirection:"column",justifyContent:"center"}}} />);
  fireEvent.click(screen.getByRole("tab",{name:"Diseño"}));
  fireEvent.click(screen.getByRole("button",{name:"Centrar"}));
  expect(screen.getByText(/marginLeft/)).toHaveTextContent('"display":"flex"');
  expect(screen.getByText(/marginLeft/)).toHaveTextContent('"justifyContent":"center"');
});

it("edits one padding side without losing imported shorthand values", () => {
  render(<Harness initial={{id:"text",type:"paragraph",text:"Texto",styles:{padding:"10px 20px"}}} />);
  fireEvent.click(screen.getByRole("tab",{name:"Diseño"}));
  fireEvent.click(screen.getByRole("checkbox",{name:"Editar cada lado"}));
  expect(screen.getByRole("spinbutton",{name:"Padding Arriba"})).toHaveValue(10);
  expect(screen.getByRole("spinbutton",{name:"Padding Derecha"})).toHaveValue(20);
  fireEvent.change(screen.getByRole("spinbutton",{name:"Padding Arriba"}),{target:{value:"30"}});
  expect(screen.getByRole("spinbutton",{name:"Padding Derecha"})).toHaveValue(20);
  expect(screen.getByText(/paddingTop/)).toHaveTextContent('"paddingTop":"30px"');
});


it("centres a narrow rich-text box while preserving its text alignment",()=>{
  render(<Harness initial={{id:"saving",type:"rich",tag:"p",children:[{type:"text",text:"Has ahorrado"}],styles:{width:"386px",textAlign:"center",padding:"10px 12px"}}} />);
  fireEvent.click(screen.getByRole("tab",{name:"Diseño"}));
  fireEvent.click(screen.getByRole("button",{name:"Bloque al centro"}));
  const output=screen.getByText(/marginLeft/);
  expect(output).toHaveTextContent('"marginLeft":"auto"');
  expect(output).toHaveTextContent('"marginRight":"auto"');
  expect(output).toHaveTextContent('"textAlign":"center"');
  expect(output).toHaveTextContent('"width":"386px"');
});
