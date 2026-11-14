import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import EmailEditor from "./EmailEditor";

afterEach(cleanup);

const token = { token: "{{nombre}}", label: "Nombre", varName: "nombre", sample: "Ana" };

describe("EmailEditor", () => {
  it("cancels canvas link activation without blocking block selection",()=>{
    const {container}=render(<EmailEditor value='<p>Visita <a href="https://example.test/destination" target="_blank"><strong>el enlace</strong></a></p><details><summary>Abrir detalle</summary>Contenido</details>' onChange={()=>{}} />);
    const link=container.querySelector('.ee-email-page a')!;
    expect(fireEvent.click(link.querySelector('strong')!)).toBe(false);
    expect(container.querySelector('.ee-block-selected')).toBeInTheDocument();
    expect(fireEvent(link,new MouseEvent('auxclick',{bubbles:true,cancelable:true,button:1}))).toBe(false);
    expect(fireEvent.click(container.querySelector('.ee-email-page summary')!)).toBe(false);
  });

  it("renders protected server fragments in the canvas without hiding following blocks", () => {
    const { container } = render(<EmailEditor value={'<th:block th:replace="~{emails/fragments/layout :: productTable(${products}, ${totalPrice})}"/><p>Después del pedido</p>'} onChange={() => {}} tokens={[
      { token: "{{productos}}", varName: "products", label: "Productos", sample: [{ name: "Camiseta Yambo", quantity: 2, price: 10 }] },
      { token: "{{total}}", varName: "totalPrice", label: "Total", sample: 20 },
    ]} />);
    expect(container.querySelector(".ee-block-protected-live")).toHaveTextContent("Camiseta Yambo");
    expect(container.querySelectorAll("[data-ee-block-id]")).toHaveLength(2);
    expect(screen.getByText("Después del pedido")).toBeInTheDocument();
  });
  it("embeds by default, accepts host styling and restores it after maximizing",()=>{
    const onMaximizedChange=vi.fn();
    render(<EmailEditor title="Componente integrado" value="<p>Hola</p>" onChange={()=>{}} className="host-editor" style={{height:420,minHeight:0}} onMaximizedChange={onMaximizedChange}/>);
    const root=screen.getByRole("region",{name:"Componente integrado"});
    expect(root).not.toHaveClass("ee-maximized");
    expect(root).toHaveClass("host-editor");
    expect(root).toHaveStyle({height:"420px"});
    fireEvent.click(screen.getByRole("button",{name:"Maximizar editor"}));
    expect(root).toHaveClass("ee-maximized");
    expect(onMaximizedChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole("button",{name:"Minimizar editor"}));
    expect(root).toHaveStyle({height:"420px"});
    expect(onMaximizedChange).toHaveBeenLastCalledWith(false);
  });
  it("supports a parent-controlled maximized state",()=>{
    const changed=vi.fn();
    const {rerender}=render(<EmailEditor value="" onChange={()=>{}} maximized={false} onMaximizedChange={changed}/>);
    fireEvent.click(screen.getByRole("button",{name:"Maximizar editor"}));
    expect(changed).toHaveBeenCalledWith(true);
    expect(screen.getByRole("region",{name:"Editor de plantilla"})).not.toHaveClass("ee-maximized");
    rerender(<EmailEditor value="" onChange={()=>{}} maximized onMaximizedChange={changed}/>);
    expect(screen.getByRole("region",{name:"Editor de plantilla"})).toHaveClass("ee-maximized");
  });
  it("restores host scrolling only after the last maximized instance unmounts",()=>{
    const original=document.body.style.overflow;
    const first=render(<EmailEditor value="" onChange={()=>{}} defaultMaximized/>);
    const second=render(<EmailEditor value="" onChange={()=>{}} defaultMaximized/>);
    expect(document.body.style.overflow).toBe("hidden");
    first.unmount();
    expect(document.body.style.overflow).toBe("hidden");
    second.unmount();
    expect(document.body.style.overflow).toBe(original);
  });
  it("renders exactly one line break per totals row, including repeated blocks", () => {
    const totals = '<div><span>Subtotal</span><br/><span>Descuento</span><br/><span>Envío</span><br/><strong>Total calculado</strong></div>';
    const { container } = render(<EmailEditor value={`${totals}<div th:each="item : \${products}">${totals}</div>`} onChange={() => {}} tokens={[{ token: "{{products}}", label: "Productos", varName: "products", sample: [1, 2] }]} />);
    const page = container.querySelector(".ee-email-page")!;
    expect(page.querySelectorAll("br")).toHaveLength(9);
    expect(page.querySelectorAll("strong")).toHaveLength(3);
  });

  it("shows the blocks mode by default and switches to code mode", () => {
    const onChange = vi.fn();
    render(<EmailEditor value="<p>Hola</p>" onChange={onChange} tokens={[token]} />);
    const modeTablist = screen.getByRole("tablist", { name: /modo de edición/i });
    const tabs = within(modeTablist).getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.click(tabs[1]);
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
  });

  it("adds a block from the palette and reports the generated HTML", () => {
    const onChange = vi.fn();
    render(<EmailEditor value="" onChange={onChange} tokens={[token]} />);
    fireEvent.click(screen.getByRole("button", { name: /título/i }));
    const markup = onChange.mock.lastCall?.[0] ?? "";
    expect(markup).toContain("<h2");
    expect(markup).toContain("Tu actualización");
  });

  it("supports undo and redo for block edits", () => {
    const onChange = vi.fn();
    render(<EmailEditor value="" onChange={onChange} tokens={[token]} />);
    fireEvent.click(screen.getByRole("button", { name: /título/i }));
    expect(onChange.mock.lastCall?.[0]).toContain("<h2");
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(onChange.mock.lastCall?.[0]).not.toContain("<h2");
    fireEvent.click(screen.getByRole("button", { name: "Rehacer" }));
    expect(onChange.mock.lastCall?.[0]).toContain("<h2");
  });

  it("keeps the side-by-side preview independent from the mode tabs", () => {
    render(<EmailEditor value="" onChange={() => {}} tokens={[token]} />);
    const modeTablist = screen.getByRole("tablist", { name: /modo de edición/i });
    const tabs = within(modeTablist).getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    const compare = screen.getByRole("button", { name: /lado a lado/i });
    fireEvent.click(compare);
    expect(compare).toHaveAttribute("aria-pressed", "true");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  it("edits block CSS and attributes through the inspector", () => {
    const onChange = vi.fn();
    render(<EmailEditor value="" onChange={onChange} tokens={[token]} />);
    fireEvent.click(screen.getByRole("button", { name: /título/i }));
    fireEvent.click(screen.getByRole("tab", { name: "Avanzado" }));
    fireEvent.change(screen.getByLabelText("Clase CSS"), { target: { value: "hero-title" } });
    fireEvent.change(screen.getByLabelText("CSS en línea"), { target: { value: "color: #123456; font-size: 24px" } });
    fireEvent.click(screen.getByText("Atributos HTML"));
    fireEvent.click(screen.getByRole("button", { name: /añadir atributo/i }));
    const names = screen.getAllByLabelText("Nombre del atributo");
    fireEvent.change(names[0], { target: { value: "data-track" } });
    fireEvent.change(screen.getByLabelText("Valor del atributo"), { target: { value: "campaign-1" } });
    const markup = onChange.mock.lastCall?.[0] ?? "";
    expect(markup).toContain('class="hero-title"');
    expect(markup).toContain('style="color:#123456;font-size:24px"');
    expect(markup).toContain('data-track="campaign-1"');
  });

  it("imports existing Thymeleaf text as an editable block tree in blocks mode", () => {
    render(<EmailEditor value={'<p th:text="${nombre}">Nombre</p>'} onChange={() => {}} tokens={[token]} />);
    expect(screen.getByText("Ana", { selector: "[data-ee-inline-expression]" })).toBeInTheDocument();
  });

  it("shows a variable/formula as ${expression} while editing, and re-parses it on commit", () => {
    const onChange = vi.fn();
    render(<EmailEditor value={'<p th:text="${nombre}">Nombre</p>'} onChange={onChange} tokens={[token]} />);
    const chip = screen.getByText("Ana", { selector: "[data-ee-inline-expression]" });
    fireEvent.doubleClick(chip);
    const paragraph = screen.getAllByText("${nombre}").map(el => el.closest("p")).find((el): el is HTMLParagraphElement => !!el)!;
    paragraph.innerHTML = "${nombre + nombre}";
    fireEvent.blur(paragraph);
    const markup = onChange.mock.lastCall?.[0] ?? "";
    expect(markup).toContain('th:text="${nombre + nombre}"');
  });

  it("lets a standalone variable block's expression be edited by double-clicking it", () => {
    const onChange = vi.fn();
    render(<EmailEditor value="" onChange={onChange} tokens={[token]} />);
    fireEvent.click(screen.getByRole("button", { name: /dato/i }));
    const chip = screen.getByText("ƒ Ana");
    fireEvent.doubleClick(chip);
    const input = screen.getByPlaceholderText("nombre o item.campo o fórmula");
    fireEvent.change(input, { target: { value: "foo" } });
    fireEvent.keyDown(input, { key: "Enter" });
    const markup = onChange.mock.lastCall?.[0] ?? "";
    expect(markup).toContain('th:text="${foo}"');
  });

  const products = { token: "{{products}}", label: "Productos", varName: "products", sample: [{ name: "Camiseta", sku: "X1" }] };

  it("renames a table column header via double-click in the canvas", () => {
    const onChange = vi.fn();
    render(<EmailEditor value="" onChange={onChange} tokens={[token, products]} />);
    fireEvent.click(screen.getByRole("button", { name: /tabla/i }));
    const header = screen.getByRole("columnheader", { name: "name" });
    fireEvent.doubleClick(header);
    const input = within(header).getByDisplayValue("name");
    fireEvent.change(input, { target: { value: "Producto" } });
    fireEvent.keyDown(input, { key: "Enter" });
    const markup = onChange.mock.lastCall?.[0] ?? "";
    expect(markup).toContain(">Producto<");
  });

  // Column-resize and canvas drag-reorder aren't covered here: jsdom's PointerEvent
  // doesn't forward clientX to React handlers at all (confirmed directly — not just
  // flaky), so a pointer-drag test would only prove the test harness, not the code.
  // Verify those by hand in a real browser.
});
