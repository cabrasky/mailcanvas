import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { ColorInput, LengthInput } from "./StyleInputs";

afterEach(cleanup);
it("allows choosing the unit before entering a nonnegative decimal measure", () => {
  function Field() { const [value, setValue] = useState(""); return <LengthInput label="Radio" value={value} onChange={setValue} />; }
  render(<Field />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "rem" } });
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "1.5" } });
  expect(screen.getByRole("spinbutton")).toHaveValue(1.5);
  expect(screen.getByRole("combobox")).toHaveValue("rem");
});
it("preserves imported CSS shorthand until explicitly edited", () => {
  const change = vi.fn();
  render(<LengthInput label="Espaciado" value="12px 24px" onChange={change} />);
  expect(screen.getByRole("textbox")).toHaveValue("12px 24px");
  expect(change).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "8px 16px" } });
  expect(change).toHaveBeenCalledWith("8px 16px");
});
it("keeps CSS colors intact while offering a native color picker", () => {
  const change = vi.fn();
  render(<ColorInput label="Fondo" value="transparent" onChange={change} />);
  expect(screen.getByRole("textbox")).toHaveValue("transparent");
  fireEvent.change(screen.getByLabelText("Seleccionar color: Fondo"), { target: { value: "#23834d" } });
  expect(change).toHaveBeenCalledWith("#23834d");
});

it("does not show a pixel placeholder as a percentage", () => {
  const {rerender}=render(<LengthInput label="Ancho máximo" value="50%" placeholder="600px" onChange={()=>{}} />);
  fireEvent.change(screen.getByRole("combobox"),{target:{value:"%"}});
  rerender(<LengthInput label="Ancho máximo" value="" placeholder="600px" onChange={()=>{}} />);
  expect(screen.getByRole("spinbutton")).not.toHaveAttribute("placeholder","600");
});
