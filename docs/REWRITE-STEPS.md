# Reescrituras por pasos

Rama `codex/editor-rewrite`. La versión de package.json y package-lock.json se mantiene en **1.0.3**. Esta entrega conserva los formatos de plantillas y la API pública.

## Estado inicial guardado

`51af02b` guarda la corrección de los marcos de componentes y su altura mínima antes de iniciar los cinco pasos.

## 1. Componentes y contenedores

Commit `cccaaa8`.

Modelo común de tamaño en `blockLayout.ts`, adaptación reversible del contenido de componentes en `componentLayout.ts` y controles explícitos de tamaño automático, fijo, relativo y CSS. Lienzo y exportación aplican el mismo modelo de caja. Se conservan los estilos originales del fallback.

Validado con 25 pruebas dirigidas, TypeScript y la regresión visual de crecimiento/reducción de la cabecera.

## 2. Gestos del lienzo

Commit `409a5ad`.

Máquina de estados de presión, redimensionado, alineación, reordenación y finalización/cancelación. La dirección del gesto se decide tras el umbral y se mantiene durante la operación. Cada sesión termina una sola vez. Señales visuales del estado y cursores por tirador.

Validado con ocho pruebas dirigidas y arrastre real de contenedores y condiciones, incluida cancelación y desplazamiento del lienzo.

## 3. Inspector de Diseño

Commit `f054c8d`.

Diseño separado del contenido y de los atributos avanzados. Tamaño, posición y alineación del contenido tienen controles distintos. El diagrama editable representa márgenes y padding y permite elegir cada lado. La lógica de shorthand y longhands vive en `boxModel.ts`. Los controles de disposición y apariencia se muestran según el tipo de bloque.

Validado con pruebas de padding/alineación, TypeScript y la revisión completa de la demo.

## 4. Tablas

Commit `4012442`.

Modelo de edición independiente en `tableModel.ts`. Selección de columnas en una muestra calculada, reordenación por arrastre, propiedades de una columna y valores por fuente visibles en un mismo panel. Las fuentes repetidas y estáticas se combinan en la misma tabla. Eliminar columnas limpia sus celdas y formatos. Al reordenar se normalizan las uniones y se descartan aquellas que dejan de ser contiguas, manteniendo los datos originales.

Validado con 17 pruebas dirigidas, TypeScript y navegador añadiendo/reordenando una columna y combinando una fila estática con las fuentes existentes.

## 5. Capas y selección anidada

Commit con descripción `refactor(layers): unify hierarchy, ancestry navigation and nested drops`.

Índice de jerarquía en `selectionModel.ts`, ruta seleccionable en capas y lienzo, árbol accesible con navegación por teclado y expansión de ancestros del elemento seleccionado. Arrastre antes/después/dentro de contenedores, con bloqueo de destinos propios y descendientes. Alt + clic en el lienzo permite seleccionar el padre. Las columnas y fuentes de tablas mantienen sus accesos desde capas.

La comprobación conjunta también sincroniza el ancho de tabla con los controles nuevos de tamaño y distingue las claves React de sus paneles de contenido/diseño. Las medidas del lienzo muestran los cuatro lados cuando el padding está desglosado.

## Validación final

- 102 pruebas automatizadas.
- Compilación de demo y biblioteca y tipos de consumidor.
- Recorrido completo de demo y pruebas específicas de componentes, tablas y capas.
- Paquete compilado con dos editores independientes, Monaco y workers.
- Nuevas capturas en `docs/screenshots/demo-review/21-tabla-fuentes-columna.png` y `22-capas-ruta-caja.png`.

```sh
npm test
npm run build
npm run test:consumer-types
node scripts/review-demo.mjs
node scripts/review-demo.mjs --component-fit-only
node scripts/review-demo.mjs --table-only
node scripts/review-demo.mjs --layers-only
node scripts/smoke-component.mjs
```

Los escenarios de navegador usan muestras y destinos interceptados. El paquete continúa orientado al navegador y el renderizado local mantiene su subconjunto de Thymeleaf. La publicación npm y la actualización de Yambo son operaciones posteriores a estos commits locales.
