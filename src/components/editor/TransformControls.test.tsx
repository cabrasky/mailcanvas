import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, expect, it, vi } from "vitest";
import type { EmailBlock } from "../../services/emailBlocks";
import TransformControls from "./TransformControls";
afterEach(cleanup);

function Harness({ onContextMenu, onPatch }: { onContextMenu: (id: string, x: number, y: number) => void; onPatch: (patch: Partial<EmailBlock>) => void }) {
  const layerRef = useRef<HTMLDivElement>(null);
  const block: Extract<EmailBlock, { type: "image" }> = { id: "img-1", type: "image", width: "", src: "https://example.test/a.png", alt: "" };
  return <div ref={layerRef}>
    <img data-ee-block-id="img-1" src="" alt="" />
    <TransformControls block={block} rect={{ x: 0, y: 0, w: 200, h: 100 }} layerRef={layerRef} zoom={1}
      onPatch={onPatch} onPreview={() => {}} onBeginDrag={() => {}} onContextMenu={onContextMenu} />
  </div>;
}

it("forwards right-click on the drag surface to the canvas context menu instead of letting the browser show its own", () => {
  const onContextMenu = vi.fn();
  render(<Harness onContextMenu={onContextMenu} onPatch={() => {}} />);
  const surface = screen.getByRole("button", { name: "Mover imagen para alinear" });
  const notPrevented = fireEvent.contextMenu(surface, { clientX: 10, clientY: 20 });
  expect(notPrevented).toBe(false);
  expect(onContextMenu).toHaveBeenCalledWith("img-1", 10, 20);
});

it("aligns with margin-only styles on keyboard shortcuts, without leaking text-align onto the block", () => {
  const onPatch = vi.fn();
  render(<Harness onContextMenu={() => {}} onPatch={onPatch} />);
  const surface = screen.getByRole("button", { name: "Mover imagen para alinear" });
  fireEvent.keyDown(surface, { key: "ArrowLeft" });
  expect(onPatch).toHaveBeenCalledTimes(1);
  const patch = onPatch.mock.calls[0][0] as Partial<EmailBlock>;
  expect(patch.styles).toMatchObject({ display: "block", marginLeft: "0", marginRight: "auto" });
  expect(patch.styles).not.toHaveProperty("textAlign");
});
