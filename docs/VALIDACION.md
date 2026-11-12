# Validación y capturas

[Inicio](../README.md) · [Guía de uso](GUIA-DE-USO.md) · [Galería visual](screenshots/index.html)

## Estado de esta revisión

- Fecha documental: **12 de noviembre de 2026**.
- **21 capturas nuevas**, generadas desde la interfaz real del prototipo.
- Resolución: **1680 × 1100**, escala de dispositivo **1×**.
- El navegador y el inventario completo figuran en [manifest.json](screenshots/manifest.json).
- Los escenarios reinician la sesión antes de cada tema. La tabla combinada se configura a través de la interfaz, sin editar el DOM para simular el resultado.

Los PNG de paneles capturan solo el panel correspondiente. Las vistas generales incluyen el editor completo. La galería reduce las imágenes para navegar; abre el original para juzgar texto y espaciados a escala real.

## Pruebas automatizadas

```sh
npm test
npm run build
```

La suite actual contiene 45 pruebas en diez archivos. Comprueba también el tamaño integrado/controlado del componente y la restauración del scroll entre varias instancias. Incluye, entre otros casos:

| Área | Casos cubiertos |
| --- | --- |
| Árbol y bloques | Inserción, movimientos, estilos, atributos e importación Thymeleaf compatible |
| Texto | Edición de variables/fórmulas y preservación de saltos de línea sin duplicarlos |
| Tablas | Arrays independientes, cálculos, filas únicas, variables globales, formatos y reimportación de fuente generada |
| Arrays vacíos | No generar filas repetidas y conservar las filas únicas |
| Componentes | Actualizaciones del original, valores locales, booleanos, variables y respaldo |
| Inputs | Notación `${…}`, T/ƒ, texto interpolado y espacios finales |
| Autocompletado | Aceptación de términos en fórmulas y cierre del marcador |
| Variables | Objetos anidados, arrays, tipos, búsqueda y campos del elemento actual |

Vitest usa jsdom. Sus pruebas no sustituyen la comprobación visual de layout ni todos los gestos del navegador. Los tests de sintaxis y round-trip describen los casos soportados; no certifican importación sin pérdidas de cualquier HTML externo.

## Generar capturas de documentación

```sh
npm run docs:screenshots
```

El script:

1. Inicia Vite en `127.0.0.1:5204` con puerto estricto.
2. Abre Chromium headless a resolución fija.
3. Recorre la demo y configura los estados mediante controles reales.
4. Guarda PNG, manifiesto y galería en `docs/screenshots/`.
5. Cierra Chromium y el servidor temporal.

Se sobrescriben los archivos documentales con los mismos nombres. Las imágenes de `artifacts/visual/` no se reemplazan con este comando.

### Requisitos opcionales

El editor no necesita Playwright para funcionar. El generador intenta importar `playwright` y, si está disponible, el runtime local de Codex. En Windows también puede encontrar un Chromium headless ya instalado en la caché de Playwright.

Para prepararlo fuera de ese entorno, instala las herramientas de captura sin cambiar el contrato de dependencias de la aplicación:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run docs:screenshots
```

Si la herramienta ya está instalada en otra ubicación, usa variables de entorno. Ejemplo en PowerShell:

```powershell
$env:PLAYWRIGHT_MODULE = 'file:///C:/ruta/node_modules/playwright/index.mjs'
$env:CHROMIUM_EXECUTABLE = 'C:/ruta/chrome-headless-shell.exe'
$env:DOCS_PORT = '5204'
npm run docs:screenshots
```

`PLAYWRIGHT_MODULE` es un especificador importable, como `playwright`, o una URL `file:///` del módulo. `CHROMIUM_EXECUTABLE` es una ruta al ejecutable. `DOCS_PORT` permite evitar un puerto ocupado. No hace falta definir estas variables si la detección automática funciona.

## Comprobaciones de navegador adicionales

La librería compilada se comprueba con `npm run test:component`. Se han verificado React 18.3.1 y 19.2.3, dos instancias independientes, `onChange`, maximización y restauración del tamaño, edición de código y carga de workers. El ejemplo importa los exports públicos del paquete, no el componente desde `src/`. Véase [Integración React](REACT-COMPONENT.md).

Los scripts existentes en `artifacts/visual/` documentan escenarios funcionales:

| Script | Comprobación |
| --- | --- |
| `components.mjs` | Cambio de original entre correos, conservación/restablecimiento de personalizaciones, inserción de instancias y distinción T/ƒ |
| `tables.mjs` | Fórmulas, moneda, autocompletado, filas combinadas, arrastre nativo de columnas y coincidencia de filas con la preview |
| `layers.mjs` | Arrastrar desde el nombre de la capa y mantener el clic de selección |

Esos scripts de desarrollo conservan rutas locales del entorno donde se crearon. Para regenerar la documentación de forma portable, usa `scripts/capture-docs.mjs` y las variables anteriores. Los artefactos viejos no prueban automáticamente el estado de una revisión posterior.

## Comparación con visión por computador

La revisión histórica de `artifacts/visual/` contiene capturas del editor y la preview, superposiciones y diferencias absolutas con OpenCV. En aquella plantilla de escritorio se midió el exceso de altura de una tabla importada (141 px frente a 80 px) y se corrigieron los rellenos/bordes añadidos.

Esas métricas pertenecen a aquellas capturas y a su alineación. No se presentan como una medición actual de todos los correos, componentes o anchos móviles. La galería nueva es evidencia visual, no un porcentaje actualizado de paridad de píxeles.

Para una nueva medición comparable:

1. Usa los mismos datos y la misma biblioteca en las dos superficies.
2. Captura el mismo fragmento y ancho a escala 1×.
3. Oculta solo controles de edición; conserva el contenido y sus estilos.
4. Alinea el origen a píxeles enteros; no estires las imágenes para igualarlas.
5. Conserva originales, umbral, mapa de diferencias y geometría junto a la métrica.

## Accesibilidad y límites

Se han comprobado nombres de controles, estado de T/ƒ, navegación del autocompletado, foco visible y una biblioteca basada en `dialog` modal. El orden de capas dispone de botones como alternativa al arrastre. No se ha realizado una auditoría completa con lectores de pantalla, dispositivos táctiles ni todas las combinaciones de navegador.

El modo móvil de la preview y la captura de 375 px no certifican adaptación de todos los bloques, ni compatibilidad con motores de clientes de correo. La validación final de envío requiere el render del servidor y los clientes objetivo.

## Lista de revisión manual

- Cambiar entre los tres correos y comprobar que se conservan las fuentes durante la sesión.
- Alternar T/ƒ, escribir `${pedido}` como texto y como variable, y conservar un espacio al final.
- Buscar una propiedad anidada y un campo de array.
- Seleccionar, mover y contraer capas sin confundir la acción con arrastre.
- Cambiar el orden de columnas y comprobar que cada fórmula mantiene su columna.
- Combinar array y fila única; revisar Resultado y preview.
- Cambiar un original, comprobar una instancia personalizada y restablecerla.
- Recorrer Contenido/Diseño/Avanzado y abrir Código.
- Revisar preview de escritorio/móvil y maximizar/minimizar.
