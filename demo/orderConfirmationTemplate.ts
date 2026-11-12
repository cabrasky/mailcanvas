import type { EmailToken } from "../src/services/emailTemplateRenderer";

export const orderConfirmationTokens: EmailToken[] = [
  { token: "{{nombre}}", label: "Nombre", varName: "nombre", sample: "Lucía" },
  { token: "{{pedido}}", label: "Número de pedido", varName: "pedido", sample: "PED-48271" },
  { token: "{{products}}", label: "Productos", varName: "products", sample: [
    { name: "Bolso Atlas", sku: "AT-204", category: "Bolsos", quantity: 1, price: "€ 64,00", unitPrice: 64, lineTotal: "€ 64,00" },
    { name: "Botella Nébula", sku: "NB-018", category: "Accesorios", quantity: 2, price: "€ 18,50", unitPrice: 18.5, lineTotal: "€ 37,00" },
    { name: "Cuaderno Cobalto", sku: "CO-110", category: "Papelería", quantity: 1, price: "€ 12,00", unitPrice: 12, lineTotal: "€ 12,00" },
  ] },
  { token: "{{total}}", label: "Total formateado", varName: "total", sample: "€ 103,00" },
  { token: "{{totalNumerico}}", label: "Subtotal numérico", varName: "totalNumerico", sample: 113 },
  { token: "{{descuento}}", label: "Descuento", varName: "descuento", sample: 10 },
  { token: "{{costeEnvio}}", label: "Coste de envío", varName: "costeEnvio", sample: 0 },
  { token: "{{estado}}", label: "Estado del pedido", varName: "estado", sample: "Preparando tu pedido" },
  { token: "{{fechaEntrega}}", label: "Fecha estimada", varName: "fechaEntrega", sample: "14 de noviembre" },
  { token: "{{cliente}}", label: "Perfil del cliente", varName: "cliente", sample: {
    nombre: "Lucía Martín", email: "lucia@example.test", segmento: "Club Norte",
    direccion: { calle: "Calle del Prado, 18", ciudad: "Madrid", codigoPostal: "28014", pais: "España" },
    preferencias: { idioma: "es", novedades: true },
  } },
  { token: "{{seguimiento}}", label: "Seguimiento", varName: "seguimiento", sample: {
    url: "https://tienda.example/pedidos/PED-48271", transportista: "Correos Express", codigo: "CE-938271",
  } },
  { token: "{{enlace}}", label: "Enlace de seguimiento", varName: "enlace", sample: "https://tienda.example/pedidos/PED-48271" },
  { token: "{{ayuda}}", label: "Contacto de ayuda", varName: "ayuda", sample: {
    email: "hola@norte.example", horario: "L–V · 9:00–18:00", centro: "https://tienda.example/ayuda",
  } },
];

export const orderConfirmationHtml = `<div style="max-width:600px;margin:0 auto;padding:28px;background-color:#ffffff;font-family:Arial,sans-serif;color:#263247">
  <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:22px">
    <div><p style="margin:0 0 6px;font-size:12px;letter-spacing:2px;color:#65718a">NORTE / OBJETOS PARA CADA DÍA</p><h2 style="margin:0;font-size:27px;color:#213a70">Hola, <span th:text="\${nombre}">Lucía</span> 👋</h2></div>
    <div style="padding:9px 12px;border-radius:999px;background:#eff6ff;color:#315ee8;text-align:center"><strong>Pedido confirmado</strong><br/><span style="font-size:12px" th:text="\${pedido}">PED-48271</span></div>
  </div>
  <p>Hola <strong th:text="\${cliente.nombre}">Lucía Martín</strong>, ya estamos preparando tu pedido. Aquí tienes el resumen:</p>
  <div style="display:flex;justify-content:space-between;align-items:stretch;gap:14px;margin:18px 0">
    <div style="flex:1;padding:14px;border-radius:8px;background:#f4f6fb"><small style="color:#778198">ENTREGA A</small><p style="margin:6px 0 2px"><strong th:text="\${cliente.direccion.calle}">Calle del Prado, 18</strong></p><span th:text="\${cliente.direccion.codigoPostal}">28014</span> · <span th:text="\${cliente.direccion.ciudad}">Madrid</span></div>
    <div style="flex:1;padding:14px;border-radius:8px;background:#f4f6fb"><small style="color:#778198">SEGUIMIENTO</small><p style="margin:6px 0 2px"><strong th:text="\${seguimiento.transportista}">Correos Express</strong></p><span th:text="\${seguimiento.codigo}">CE-938271</span></div>
  </div>
  <h3 style="margin:24px 0 10px;font-size:17px">Artículos del pedido</h3>
  <table width="100%" style="border-collapse:collapse">
    <thead><tr><th align="left">Artículo</th><th align="left">Referencia</th><th align="center">Ud.</th><th align="right">Precio</th></tr></thead>
    <tbody><tr th:each="item : \${products}"><td th:text="\${item.name}">Producto</td><td th:text="\${item.sku}">SKU</td><td align="center" th:text="\${item.quantity}">1</td><td align="right" th:text="\${item.lineTotal}">€ 0,00</td></tr></tbody>
  </table>
  <div style="display:flex;justify-content:flex-end;gap:24px;margin:16px 0;padding:14px 0;border-top:1px solid #e5e9f0">
    <div><span>Subtotal</span><br/><span>Descuento</span><br/><span>Envío</span><br/><strong>Total calculado</strong></div>
    <div style="text-align:right"><span th:text="\${totalNumerico}">113</span> €<br/><span>− <span th:text="\${descuento}">10</span> €</span><br/><span th:text="\${costeEnvio}">0</span> €<br/><strong style="color:#213a70">€ <span th:text="\${totalNumerico - descuento + costeEnvio}">103</span></strong></div>
  </div>
  <p th:if="\${descuento} != null" style="padding:10px 12px;border-radius:7px;background:#effaf3;color:#28794f">Has ahorrado <strong th:text="\${descuento}">10</strong> € en este pedido. ¡Gracias por formar parte del Club Norte!</p>
  <div th:each="item : \${products}" style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid #edf0f4">
    <p style="margin:0"><strong th:text="\${item.name}">Producto</strong><br/><small style="color:#778198">SKU <span th:text="\${item.sku}">SKU</span></small></p>
    <p style="margin:0;text-align:right"><span th:text="\${item.quantity}">1</span> × € <span th:text="\${item.unitPrice}">0</span><br/><strong>Importe: € <span th:text="\${item.quantity * item.unitPrice}">0</span></strong></p>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;gap:14px;margin-top:18px;padding:14px;border-radius:8px;background:#f0f4fb">
    <p style="margin:0">Estado: <strong th:text="\${estado}">En preparación</strong></p>
    <p style="margin:0">Entrega estimada: <strong th:text="\${fechaEntrega}">Pronto</strong></p>
  </div>
  <div th:replace="~{emails/fragments/layout::ctaButton(\${enlace}, 'Seguir mi pedido', '#315ee8')}"></div>
  <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:22px;padding-top:14px;border-top:1px solid #e5e9f0;color:#7d8799;font-size:12px">
    <span>¿Necesitas ayuda? <a th:href="\${ayuda.centro}">Visita nuestro centro de ayuda</a></span><strong th:text="\${ayuda.email}">hola@norte.example</strong>
  </div>
</div>`;
