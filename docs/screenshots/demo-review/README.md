# Capturas de la demo

- `01-boletin.png`: correo con imagen servida como archivo.
- `02-guardado-fallido.png`: fallo simulado que conserva el estado pendiente.
- `03-componentes-tipados.png`: propiedades numéricas y de color de la biblioteca.
- `04-imagen-local.png`: imagen subida temporalmente y medida adaptable.

`report.json` recoge las verificaciones del navegador. `demo-export.json` es una exportación real de los documentos y datos ficticios de la prueba. Ningún flujo envía correos ni modifica Yambo.

## Revisión de imágenes y Diseño

Las capturas 07 y 08 comprueban el ancho máximo de una instancia (52 px y 320 px con espaciado). Los estilos se conservan al exportar, expandir los componentes y reimportar. Diseño modifica el contenedor de la instancia; los estilos explícitos de los elementos interiores se editan en el componente original.

Las capturas 09 prueban imágenes horizontales, verticales, cuadradas y pequeñas, con ancho máximo de 180 px, esquinas de 20 px y alineación centrada. `image-sizes.json` guarda las dimensiones naturales y medidas: 180×45, 180×540, 180×180 y 64×32. La imagen pequeña mantiene su tamaño original.

Reproducir: `node scripts/review-demo.mjs`.
