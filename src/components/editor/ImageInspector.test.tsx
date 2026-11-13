import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import type { EmailBlock } from "../../services/emailBlocks";
import ImageInspector from "./ImageInspector";
afterEach(cleanup);
it("offers one width control per sizing mode and retains image proportions", () => {
  function Harness() {
    const [block, setBlock] = useState<Extract<EmailBlock, {type:"image"}>>({ id:"photo", type:"image", src:"", alt:"Foto", width:"600" });
    return <><ImageInspector block={block} options={[]} onPatch={patch => setBlock(value => ({...value,...patch}))} /><output>{JSON.stringify(block)}</output></>;
  }
  render(<Harness />);
  expect(screen.getByLabelText("Ancho de imagen en píxeles")).toHaveValue(600);
  expect(screen.queryByRole("spinbutton", { name:"Ancho adaptable" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", {name:"Adaptable"}));
  expect(screen.queryByLabelText("Ancho de imagen en píxeles")).not.toBeInTheDocument();
  expect(screen.getByRole("spinbutton", {name:"Ancho adaptable"})).toHaveValue(100);
  expect(screen.getByRole("status")).toHaveTextContent('"height":"auto"');
  fireEvent.click(screen.getByRole("button", {name:"Original"}));
  expect(screen.queryByRole("spinbutton", {name:"Ancho adaptable"})).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent('"width":""');
});
