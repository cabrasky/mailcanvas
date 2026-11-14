import {it,expect} from "vitest";
import type {EmailBlock} from "../services/emailBlocks";
import {layerIndex,canDropLayer} from "./selectionModel";
it("records ancestry and rejects drops on the dragged node or its descendants",()=>{
 const blocks:EmailBlock[]=[{id:"parent",type:"container",children:[{id:"child",type:"paragraph",text:"Dentro"}]},{id:"other",type:"paragraph",text:"Fuera"}];
 const index=layerIndex(blocks);
 expect(index.get("child")?.path).toEqual(["parent","child"]);
 expect(canDropLayer(index,"parent","child")).toBe(false);
 expect(canDropLayer(index,"parent","parent")).toBe(false);
 expect(canDropLayer(index,"child","other")).toBe(true);
});
