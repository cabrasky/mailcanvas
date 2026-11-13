# Laboratorio de MailCanvas

La demo abre el editor maximizado. El selector superior permite editar seis ejemplos independientes: confirmación de pedido, bienvenida, actualización de envío, boletín con imagen, invitación a un encuentro y resumen con lista vacía. La biblioteca contiene siete componentes, con valores predeterminados tipados y personalizaciones por instancia.

En **Probar funciones** puedes:

- Editar los datos JSON sin perder números, booleanos, objetos ni arrays. Un JSON inválido mantiene la última muestra válida.
- Probar datos completos, listas vacías y nombres largos.
- Simular un fallo en el próximo guardado y comprobar que el documento sigue pendiente hasta reintentar.
- Exportar el HTML editable, el resultado con muestras o todos los documentos, componentes y datos como JSON.
- Importar HTML al correo activo o un archivo JSON de demo compatible.
- Restaurar un ejemplo y sus datos después de confirmar; los demás documentos y componentes se conservan.
- Ver el resultado local sin conectarse a un servidor de correo.

**Guardar cambios** conserva el correo activo, sus muestras y la biblioteca en `localStorage`, después de una pequeña espera. Si editas mientras se guarda, los cambios posteriores siguen pendientes. Las modificaciones de la biblioteca se propagan a los correos que la referencian; cada instancia mantiene sus valores personalizados.

La subida de imágenes de esta demo usa URLs `blob:` temporales para que puedas probar el selector sin servidor. Funcionan durante la sesión; tras recargar hay que volver a subirlas, y no sirven como URLs permanentes de un correo exportado. Los ejemplos incluidos usan una ilustración SVG servida como archivo. En Yambo, la subida utiliza el servicio real de archivos y devuelve una URL permanente.

No hay SMTP ni envío real. Las acciones de prueba y servidor abren paneles explicativos y la vista previa local.

## Verificación

`node scripts/review-demo.mjs` inicia su propio servidor local y comprueba guardado, recuperación, fallo/reintento, exportación, importación, restauración, componentes compartidos e imágenes. Guarda capturas y un informe en `docs/screenshots/demo-review/`.
