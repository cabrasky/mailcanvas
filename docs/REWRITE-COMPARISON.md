# Comparación de 1.0.3 con la reescritura

Este informe conserva la medición de la primera reescritura, commit `8ad73a3`. Los cinco pasos posteriores se documentan en [Reescrituras por pasos](REWRITE-STEPS.md).

Referencia anterior: commit `77f2ce5`, etiqueta `v1.0.3`, paquete público `mailcanvas@1.0.3`. Reescritura en `codex/editor-rewrite`.

El [inventario técnico](TECHNICAL-FEATURES.md) se escribió antes de comenzar. Enumera las funciones que se han conservado como contrato de compatibilidad.

## Alcance realizado

Se han reescrito la composición del editor, su controlador de operaciones, el almacenamiento del documento, el historial, la sincronización con el consumidor, la gestión de paneles y maximización, los gestos de manipulación, las mediciones y overlays, la interacción de la cámara, la preview, el guardado y el estado/composición de la demo.

Se reutilizan los servicios públicos de parseo, serialización, expresiones y componentes, y los controles especializados de tablas, propiedades y campos. Son las fronteras de compatibilidad del editor nuevo. La nueva arquitectura utiliza estos servicios y widgets como piezas compatibles y conserva la identidad visual, React y las dependencias existentes.

## Resultados funcionales

| Área | 1.0.3 | Reescritura |
| --- | --- | --- |
| Documento | Estado de bloques, HTML controlado y referencias de sincronización separados | Transacciones que publican HTML y bloques en una sola instantánea |
| Historial | Hasta 50 estados de bloques | Hasta 50 instantáneas completas, incluidas ediciones de código |
| Ediciones consecutivas | Operaciones construidas desde el render de React | Operaciones contra el estado actual de EditorDocument antes de emitir onChange |
| Acknowledgements del host | Marca de la última fuente generada | Cola de fuentes emitidas que reconoce respuestas tardías sin revertir el documento |
| Identificadores | Secuencia local reiniciada en cada editor | Generador que consulta el documento y evita colisiones con bloques importados |
| Guardado | Gestión local del estado de solicitud | Estado asíncrono con protección de montaje y snapshot, conservando la API |
| Sesiones de ratón | Varios juegos de listeners con cierres distintos | Gestión común para finalizar, cancelar, perder foco o desmontar |
| Redimensionado | Lectura de referencias durante el gesto | Geometría y unidades de referencia fijadas al comenzar la operación |
| Selección del lienzo | Medida ligada a actualizaciones de props | Medición con observación del documento y carga de imágenes |
| Repeticiones del lienzo | Segundo renderizador con comportamiento propio | Reutilización del serializador y motor de preview para las copias |
| Preview | Mutación de outlines del HTML y efecto dependiente de selección | Contorno externo y mediciones agrupadas mediante requestAnimationFrame |
| Aviso de desbordamiento | Revisión general inestable, con clic forzado en el script | Revisión general completa con clic normal |
| Varias instancias | Algunas búsquedas globales del documento | Selección desde preview acotada al editor que la contiene |
| Paneles | Resize con listeners propios | Sesión cancelable y liberación en desmontaje |
| Demo | Varias estructuras de estado dentro de la vista | Sesión de demo separada de su interfaz, mismo formato local v2 |

## Funciones preservadas

| Función del inventario | Validación |
| --- | --- |
| API pública y export por defecto | `src/index.ts` idéntico, declaraciones compiladas y tipos de consumidor |
| Instancias embebidas y maximización | Suite React y prueba de dos consumidores de dist |
| Código y Monaco con workers | Smoke test del paquete compilado |
| Insertar, capas, selección e historial | Pruebas de integración y recorrido de navegador |
| Datos estructurados, fórmulas y T/ƒ | Pruebas de servicios/campos y datos de demo |
| Tablas, columnas y filas combinadas | Pruebas existentes de bloques y tableRows |
| Componentes vinculados y valores tipados | Pruebas de componentes, biblioteca y recorrido de demo |
| Imágenes, tamaños y proporciones | Revisión de cuatro proporciones, subida local y controles |
| Arrastre, guías, márgenes y unidades | Revisión con ratón, teclado, cancelación y zoom del 50 % |
| Condiciones y tarjetas HTML simples | Escenario específico de contenedores/condiciones y centrado de 386 px |
| Guardado, fallo, reintento y recuperación | Pruebas del footer y recorrido con localStorage |
| Importación, exportación y restauración | Recorrido completo de demo y exportación JSON |
| Preview móvil, enlaces y selección | Navegador con enlace a destino interceptado, detección de desbordamiento y selección enlazada |

La matriz describe las comprobaciones ejecutadas. No equivale a probar cada combinación posible de HTML, datos y estilos.

## Medidas

- Pruebas automatizadas: **81 → 92**, todas pasan. Las once nuevas pruebas verifican transacciones, sincronización, historial de código, snapshots guardados, suscripciones y finalización/cancelación de gestos.
- `dist/index.js`: **217.716 → 217.424 bytes** sin comprimir, reducción de 292 bytes.
- Gzip de `index.js`, calculado con Python en ambas entradas: **54.137 → 55.042 bytes**, aumento de 905 bytes.
- CSS: **435.335 → 435.719 bytes**, aumento de 384 bytes. Gzip: **152.442 → 152.522 bytes**, aumento de 80 bytes.
- Se conservan seis correos y siete componentes de demo.

El baseline de tamaños se leyó del tarball público de npm. La segunda medición se leyó del build nuevo. Las cifras no son un benchmark de tiempo de ejecución. El aumento comprimido acompaña el historial completo y la nueva gestión de sesiones.

## Comparación visual

Capturas de 1680 × 1100. Cada imagen reúne versión anterior, reescritura y diferencia de píxeles amplificada cuatro veces.

- [Altura y alineación vertical](rewrite-comparison/comparison-vertical.png): cambia un **0,003 %** de píxeles al umbral de luminancia 20.
- [Centrado del recuadro](rewrite-comparison/comparison-centering.png): cambia un **0,006 %** de píxeles.
- [Selección y aviso de desbordamiento](rewrite-comparison/comparison-preview.png): cambia un **3,298 %**, correspondiente a la nueva composición de la preview y su contorno externo.

Las dos primeras escenas buscan continuidad visual. La tercera recoge una modificación funcional de la interfaz. Los porcentajes incluyen texto y diferencias de rasterizado y no expresan una puntuación de calidad.

[Galería de comparación](rewrite-comparison/index.html) · [Métricas originales](rewrite-comparison/metrics.json).

## Reproducir

```sh
npm test
npm run build
npm run test:consumer-types
node scripts/smoke-component.mjs
node scripts/review-demo.mjs
node scripts/review-demo.mjs --html-sizing-only
npm pack mailcanvas@1.0.3 --ignore-scripts --pack-destination artifacts
python scripts/compare-rewrite.py
```

El script de comparación usa Pillow. Las pruebas de navegador requieren Playwright y Chromium. Los destinos de enlaces y los errores de guardado se simulan, sin enviar correo.

## Límites de esta entrega

La rama es local y conserva la versión del manifiesto como referencia de desarrollo. No se ha publicado otro paquete ni actualizado el tarball de Yambo con la reescritura. Los formatos HTML, componentes y demo v2 se mantienen. La compatibilidad con clientes de correo y el subconjunto de Thymeleaf mantienen los límites documentados en el inventario. Deben asignarse versión y publicación cuando se decida distribuir esta rama.
