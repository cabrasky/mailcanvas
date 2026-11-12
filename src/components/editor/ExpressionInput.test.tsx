import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ExpressionInput from "./ExpressionInput";
afterEach(cleanup);
it("completes the current term in a formula without replacing the other operands",()=>{
  const onChange=vi.fn();
  render(<ExpressionInput label="Fórmula" value="item.qty * item.pr" onChange={onChange} options={[{value:"item.price",label:"Precio"}]}/>);
  const input=screen.getByRole("combobox");
  (input as HTMLInputElement).setSelectionRange(18,18);
  fireEvent.focus(input);
  expect(screen.getByRole("option")).toHaveTextContent("item.price");
  fireEvent.keyDown(input,{key:"Enter"});
  expect(onChange).toHaveBeenCalledWith("item.qty * item.price");
});
it("closes a variable marker when accepting a completion",()=>{
  const onChange=vi.fn();
  render(<ExpressionInput label="Valor" value="${item.pr" onChange={onChange} options={[{value:"item.price",label:"Precio"}]}/>);
  const input=screen.getByRole("combobox") as HTMLInputElement;
  input.setSelectionRange(9,9);
  fireEvent.focus(input);
  fireEvent.keyDown(input,{key:"Tab"});
  expect(onChange).toHaveBeenCalledWith("${item.price}");
});
