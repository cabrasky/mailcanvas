import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import LiteralInput from "./LiteralInput";
import ValueInput from "./ValueInput";

afterEach(cleanup);
it("uploads an image through the host callback and reports broken previews", async () => {
  const change = vi.fn();
  const upload = vi.fn().mockResolvedValue("https://example.com/logo.png");
  render(<LiteralInput label="Imagen" type="image" value="https://example.com/broken.png" onChange={change} onUploadImage={upload} />);
  fireEvent.error(screen.getByAltText("Vista previa de la imagen"));
  expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar");
  const file = new File(["test"], "logo.png", { type: "image/png" });
  await act(async () => fireEvent.change(screen.getByLabelText("Subir imagen: Imagen"), { target: { files: [file] } }));
  expect(upload).toHaveBeenCalledWith(file);
  expect(change).toHaveBeenCalledWith("https://example.com/logo.png");
});
it("uses a numeric control for literals and keeps expressions editable", () => {
  const onChange = vi.fn();
  const props = { label: "Cantidad", value: "2", options: [], onChange, valueType: "number" as const };
  const { rerender } = render(<ValueInput {...props} mode="text" />);
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "2.5" } });
  expect(onChange).toHaveBeenCalledWith("2.5", "text");
  rerender(<ValueInput {...props} mode="dynamic" value="item.quantity" />);
  expect(screen.getByRole("combobox")).toHaveValue("${item.quantity}");
});
it("edits legacy date values through a native calendar without changing their display format", () => {
  const onChange = vi.fn();
  render(<LiteralInput label="Fecha" type="datetime" value="13/11/2026 10:00" onChange={onChange} />);
  expect(screen.getByLabelText("Fecha")).toHaveValue("2026-11-13T10:00");
  fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-12-20T11:30" } });
  expect(onChange).toHaveBeenCalledWith("20/12/2026 11:30");
});
