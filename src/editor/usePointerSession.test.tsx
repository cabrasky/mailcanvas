import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { usePointerSession } from "./usePointerSession";

afterEach(cleanup);
function Harness({ move, finish }: { move: () => void; finish: (commit: boolean) => void }) {
  const begin = usePointerSession();
  return <button onClick={() => begin({ move, finish })}>Empezar gesto</button>;
}
it("commits once and detaches the pointer listeners", () => {
  const move = vi.fn(), finish = vi.fn();
  render(<Harness move={move} finish={finish} />);
  fireEvent.click(screen.getByRole("button"));
  fireEvent.pointerMove(window); fireEvent.pointerUp(window); fireEvent.pointerMove(window); fireEvent.pointerUp(window);
  expect(move).toHaveBeenCalledTimes(1);
  expect(finish).toHaveBeenCalledTimes(1);
  expect(finish).toHaveBeenCalledWith(true);
});
it("cancels a replaced gesture before starting another", () => {
  const finish = vi.fn(); render(<Harness move={() => {}} finish={finish} />);
  fireEvent.click(screen.getByRole("button")); fireEvent.click(screen.getByRole("button"));
  expect(finish).toHaveBeenNthCalledWith(1,false);
  fireEvent.pointerUp(window); expect(finish).toHaveBeenNthCalledWith(2,true);
});
it("cancels on Escape without committing afterwards", () => {
  const finish = vi.fn(); render(<Harness move={() => {}} finish={finish} />);
  fireEvent.click(screen.getByRole("button")); fireEvent.keyDown(window,{key:"Escape"}); fireEvent.pointerUp(window);
  expect(finish).toHaveBeenCalledTimes(1);
  expect(finish).toHaveBeenCalledWith(false);
});
it("cancels on unmount and releases the active session", () => {
  const finish = vi.fn(), move = vi.fn();
  const {unmount} = render(<Harness move={move} finish={finish} />);
  fireEvent.click(screen.getByRole("button")); unmount(); fireEvent.pointerMove(window); fireEvent.pointerUp(window);
  expect(finish).toHaveBeenCalledTimes(1);
  expect(finish).toHaveBeenCalledWith(false);
  expect(move).not.toHaveBeenCalled();
});
