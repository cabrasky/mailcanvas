import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import EditorFooter from "./EditorFooter";
afterEach(cleanup);
const base = { mode: "blocks" as const, hasThymeleaf: false, value: "original" };

it("waits for persistence and prevents duplicate saves", async () => {
  let finish!: () => void;
  const save = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const complete = vi.fn();
  render(<EditorFooter {...base} onSave={save} onSaveComplete={complete} />);
  fireEvent.click(screen.getByText("Guardar cambios"));
  expect(screen.getByText("Guardando…")).toBeDisabled();
  expect(complete).not.toHaveBeenCalled();
  await act(async () => finish());
  expect(complete).toHaveBeenCalledOnce();
  expect(save).toHaveBeenCalledOnce();
});
it.each(["throw", "false"])("retains unsaved status after a %s result", async kind => {
  const complete = vi.fn();
  render(<EditorFooter {...base} onSave={async () => { if (kind === "throw") throw new Error("offline"); return false; }} onSaveComplete={complete} />);
  await act(async () => fireEvent.click(screen.getByText("Guardar cambios")));
  expect(complete).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toBeInTheDocument();
});
it("does not mark later edits as saved when an older request finishes", async () => {
  let finish!: () => void;
  const save = () => new Promise<void>(resolve => { finish = resolve; });
  const complete = vi.fn();
  const { rerender } = render(<EditorFooter {...base} onSave={save} onSaveComplete={complete} />);
  fireEvent.click(screen.getByText("Guardar cambios"));
  rerender(<EditorFooter {...base} value="new edit" onSave={save} onSaveComplete={complete} />);
  await act(async () => finish());
  expect(complete).not.toHaveBeenCalled();
});
