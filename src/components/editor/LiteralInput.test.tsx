import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import LiteralInput from "./LiteralInput";
import ValueInput from "./ValueInput";

afterEach(cleanup);
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
