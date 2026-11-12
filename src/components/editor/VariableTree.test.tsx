import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import VariableTree from "./VariableTree";
afterEach(cleanup);
const tokens = [
  {token:"{{cliente}}",varName:"cliente",label:"Cliente",sample:{direccion:{calle:"Prado"},activo:true}},
  {token:"{{products}}",varName:"products",label:"Productos",sample:[{name:"Bolso",quantity:2}]},
  {token:"{{empty}}",varName:"empty",label:"Vacío",sample:[]},
];
describe("VariableTree",()=>{
  it("shows typed nested objects, arrays and empty collections without offering invalid array paths",()=>{
    const onVariable=vi.fn();
    render(<VariableTree tokens={tokens} query="" onVariable={onVariable}/>);
    expect(screen.getAllByText("objeto").length).toBeGreaterThan(0);
    expect(screen.getByText("booleano")).toBeInTheDocument();
    expect(screen.getByText("array<objeto>")).toBeInTheDocument();
    expect(screen.getByText(/Array vacío/)).toBeInTheDocument();
    expect(screen.getByText("products[].name")).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Insertar products[].name"})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Insertar cliente.direccion.calle"}));
    expect(onVariable).toHaveBeenCalledWith("cliente.direccion.calle");
  });
  it("keeps ancestors when searching and offers valid item fields inside a loop",()=>{
    const {rerender}=render(<VariableTree tokens={tokens} query="" onVariable={()=>{}}/>);
    fireEvent.click(screen.getByRole("button",{name:"Contraer cliente"}));
    expect(screen.queryByText("cliente.direccion.calle")).not.toBeInTheDocument();
    const onVariable=vi.fn();
    rerender(<VariableTree tokens={tokens} query="calle" onVariable={onVariable}/>);
    expect(screen.getByText("cliente.direccion.calle")).toBeInTheDocument();
    expect(screen.getByText("Cliente")).toBeInTheDocument();
    rerender(<VariableTree tokens={tokens} loopCollection="products" query="item.name" onVariable={onVariable}/>);
    fireEvent.click(screen.getByRole("button",{name:"Insertar item.name"}));
    expect(onVariable).toHaveBeenCalledWith("item.name");
  });
});
