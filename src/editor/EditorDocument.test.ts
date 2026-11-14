import { describe, expect, it, vi } from "vitest";
import { EditorDocument } from "./EditorDocument";
import { createEmailBlock, insertEmailBlock } from "../services/emailBlocks";

describe("transactional editor document", () => {
  it("edits code and blocks in one undo history without losing the original source", () => {
    const original = '<p class="source">Original</p>';
    const change = vi.fn();
    const model = new EditorDocument(original,change);
    model.replace('<p>Desde código</p>');
    model.edit(blocks => insertEmailBlock(blocks,null,createEmailBlock("heading",[],"title")));
    expect(model.getSnapshot().present.blocks).toHaveLength(2);
    model.undo(); expect(model.getSnapshot().present.html).toBe('<p>Desde código</p>');
    model.undo(); expect(model.getSnapshot().present.html).toBe(original);
    model.redo(); expect(model.getSnapshot().present.html).toBe('<p>Desde código</p>');
  });
  it("applies consecutive edits against the latest committed blocks", () => {
    const model = new EditorDocument("",()=>{});
    for (const id of ["a","b","c"]) model.edit(blocks => [...blocks,createEmailBlock("paragraph",[],id)]);
    expect(model.getSnapshot().present.blocks.map(block=>block.id)).toEqual(["a","b","c"]);
    expect(model.getSnapshot().past).toHaveLength(3);
  });
  it("accepts delayed host acknowledgements without reverting newer edits", () => {
    const model = new EditorDocument("",()=>{});
    model.replace("<p>Uno</p>"); model.replace("<p>Dos</p>");
    expect(model.receive("<p>Uno</p>")).toBe(false);
    expect(model.getSnapshot().present.html).toBe("<p>Dos</p>");
    expect(model.receive("<p>Dos</p>")).toBe(false);
    expect(model.getSnapshot().past).toHaveLength(2);
  });
  it("resets history only for a new host document", () => {
    const model = new EditorDocument("",()=>{});
    model.replace("<p>Modificado</p>");
    expect(model.receive("<p>Otro correo</p>")).toBe(true);
    expect(model.getSnapshot().past).toHaveLength(0);
    expect(model.getSnapshot().savedHtml).toBe("<p>Otro correo</p>");
  });
  it("retains the saved snapshot when later edits occur", () => {
    const model = new EditorDocument("",()=>{});
    model.replace("<p>Guardando</p>");
    const submitted = model.getSnapshot().present.html;
    model.replace("<p>Más reciente</p>"); model.markSaved(submitted);
    expect(model.getSnapshot().present.html).not.toBe(model.getSnapshot().savedHtml);
  });
  it("does not emit no-op edits and invalidates redo on a new branch", () => {
    const change = vi.fn(); const model = new EditorDocument("",change);
    model.edit(blocks=>blocks); expect(change).not.toHaveBeenCalled();
    model.replace("<p>A</p>"); model.replace("<p>B</p>"); model.undo(); model.replace("<p>C</p>");
    expect(model.getSnapshot().future).toHaveLength(0);
  });
  it("bounds history and releases subscriptions", () => {
    const model = new EditorDocument("",()=>{});
    const listener = vi.fn(); const unsubscribe = model.subscribe(listener);
    for(let index=0; index<60; index++) model.replace(`<p>${index}</p>`);
    expect(model.getSnapshot().past).toHaveLength(50);
    expect(listener).toHaveBeenCalledTimes(60);
    unsubscribe(); model.replace("<p>Final</p>"); expect(listener).toHaveBeenCalledTimes(60);
  });
});
