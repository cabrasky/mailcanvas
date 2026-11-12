import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ValueInput from "./ValueInput";
afterEach(cleanup);
function Field(){const [value,setValue]=useState("pedido");const [mode,setMode]=useState<"text"|"dynamic">("dynamic");return <ValueInput label="Marca" value={value} mode={mode} options={[{value:"pedido",label:"Pedido"}]} onChange={(value,mode)=>{setValue(value);setMode(mode);}}/>;}
it("displays legacy expressions as ${…} and offers compact accessible T/ƒ controls",()=>{
  render(<Field/>);
  expect(screen.getByRole("combobox")).toHaveValue("${pedido}");
  fireEvent.click(screen.getByRole("button",{name:"Texto fijo: Marca"}));
  expect(screen.getByRole("button",{name:"Texto fijo: Marca"})).toHaveAttribute("aria-pressed","true");
  fireEvent.change(screen.getByRole("combobox"),{target:{value:"Texto literal"}});
  expect(screen.queryByRole("option")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"Valor dinámico: Marca"}));
  expect(screen.getByRole("combobox")).toHaveValue("${Texto literal}");
});
it("preserves mixed values and trailing spaces while typing",()=>{
  render(<Field/>);
  const input=screen.getByRole("combobox");
  fireEvent.focus(input);
  fireEvent.change(input,{target:{value:"Referencia: ${pedido} "}});
  expect(input).toHaveValue("Referencia: ${pedido} ");
  fireEvent.blur(input);
  expect(input).toHaveValue("Referencia: ${pedido} ");
});
