# Inventario técnico previo a la reescritura

Referencia: Mailcanvas 1.0.3, commit 77f2ce5. Fecha: 14 de noviembre de 2026.

## Distribución y API

Biblioteca ESM de React 18/19 y TypeScript. React y React DOM son peer dependencies. Vite compila la biblioteca y una demo separada. Se exportan EmailEditor (default y nombrado), sus props, los modelos de bloques, tokens y componentes, parseEmailHtmlToBlocks, emailBlocksToHtml, renderEmail, renderThymeleaf y normalizeTemplateMarkup. CSS importable como mailcanvas/style.css. Monaco y sus workers se cargan de forma diferida.

EmailEditor es controlado mediante value/onChange. Admite tokens, templateKey, commonElements, navigation, title, className y style. Callbacks opcionales de guardado, restablecimiento, prueba y vista de servidor. onSave admite resultado síncrono o asíncrono y false para indicar fallo. dirty permite incluir modificaciones del host. onUploadImage entrega una URL desde el almacenamiento del consumidor. Maximización interna o controlada mediante maximized/onMaximizedChange.

## Documento y lógica

Modelo discriminado EmailBlock con tipos component, html, heading, paragraph, rich, variable, button, image, divider, spacer, table, container, loop e if. Cada bloque conserva identificador, estilos inline, clases, reglas CSS y atributos. Texto enriquecido con nodos inline, enlaces, saltos, formato y expresiones. Parser HTML/Thymeleaf y serializador con metadatos de edición. Conservación de fragmentos no reconocidos como HTML protegido. Normalización de etiquetas Thymeleaf autocerradas.

Historial de hasta 50 estados de bloques, deshacer/rehacer, duplicación con identificadores nuevos, inserción, eliminación, reordenación y anidamiento. Selección única/múltiple y selección de campos de tabla. El historial de la versión base no incluye las ediciones de código como transacciones de documento.

## Superficie de edición

Lienzo de 600 px, zoom 25–300 %, ajustar a pantalla, desplazamiento y zoom bajo el cursor. Paneles laterales plegables y redimensionables. Modo código, modo bloques y vista lado a lado con divisor. Maximización con bloqueo de scroll compartido entre instancias. Atajos de selección, borrar, duplicar, mover, deshacer y rehacer. Menú contextual y edición inline con doble clic, Enter, Escape y blur.

Capas con búsqueda y estructura jerárquica, expansión/contracción, selección, operaciones y arrastre desde las filas. Insertar reúne paleta de bloques, componentes y árbol de datos. Drag and drop de inserción y movimiento antes/después/dentro de bloques compatibles, con indicador de destino.

## Manipulación directa

Tiradores de ancho, altura y esquinas para imágenes, componentes, contenedores, condiciones y texto. Los lados separan ejes. Las esquinas de imágenes mantienen proporción. Arrastre horizontal para posicionar y vertical para reordenar. Guías de bordes y centro. Ajuste de tamaños a contenedor, mitad del ancho y hermanos, con referencia resaltada. Alt omite el ajuste. Escape cancela y un gesto produce un paso de historial.

Unidades px, %, rem, em, pt, vw y vh. Medidas fijas, relativas y automáticas visibles en la barra del lienzo. Márgenes sombreados. Posición del bloque separada de alineación de texto. Arriba/centro/abajo para contenido con altura disponible. Alineación con otro objeto del mismo contenedor e igualación de dimensiones. Las medidas copiadas de otro objeto se fijan en píxeles.

## Inspector y campos

Pestañas Contenido, Diseño y Avanzado. Texto, color, fondo, tipografía, altura, ancho máximo, radio, padding y márgenes por lado. Contenedores con configuración flex. Atributos y CSS avanzados. Campos T/ƒ para literal o expresión. Autocompletado con datos de muestra, ejemplos resueltos y rutas anidadas. Tipos text, url, color, boolean, number, email, image, date y datetime. Preservación de CSS complejo en controles de longitud.

## Tablas

Columnas reordenables y editables con etiqueta, ancho, alineación y formato. Filas procedentes de arrays, fórmulas, texto interpolado y filas únicas/estáticas en una misma tabla. Muestras locales para cada grupo repetido. Cabecera, bordes, padding, colores, alternancia y ancho de tabla. Edición de etiquetas y ancho de columnas desde el lienzo. Selección de campos y unión/desunión de columnas contiguas mediante metadatos de grupos.

## Datos y renderizado

Tokens con nombres, etiquetas y muestras primitivas, objetos y arrays. Árbol de rutas e inferencia de tipos. Sintaxis visible ${ruta}, expresiones y texto mixto. Compatibilidad con {{token}} y {{= expresión}}. Variables locales item en repeticiones. Subconjunto local de Thymeleaf con condiciones, bucles, texto, enlaces, imágenes, estilos, asignaciones y fragmentos compatibles. Vista de contenidos condicionales ocultos para poder editarlos. Los campos numéricos inválidos se exportan como null conservando su metadato.

## Componentes reutilizables e imágenes

Biblioteca externa con clave, nombre, categoría, HTML y esquema de propiedades. Instancias vinculadas con valores por defecto y personalizaciones literales/dinámicas. Actualización desde definición actual, componentes anidados, fallback y límites de expansión. Restablecimiento de una propiedad o de todas. Estilos propios de instancia conservados en HTML.

Imágenes por URL, variable o callback de subida. Miniatura, dimensiones originales, estados de error y reintento. Tamaño original, fijo o adaptable, límite de ancho, altura y object-fit. Texto alternativo. La demo usa URLs blob temporales y el host puede aportar almacenamiento permanente.

## Vista previa y acciones

Iframe aislado sin scripts de plantilla, vistas de escritorio y móvil. Enlaces de preview con destino separado. El lienzo cancela enlaces, botones, acciones auxiliares y envío de formularios, manteniendo selección/edición. Selección enlazada con preview, contorno y dimensión renderizada. Avisos de muestras ausentes y de bloques que exceden el ancho visible. Selección desde el aviso. Existe una inestabilidad conocida del aviso de desbordamiento en la revisión visual general, pendiente al comenzar la reescritura.

Guardado asíncrono con bloqueo de duplicados, error/reintento y protección ante cambios durante una solicitud. Las acciones de servidor pertenecen al consumidor.

## Demo, integración y validación

Seis correos y siete componentes compartidos. Biblioteca editable con propiedades tipadas. Datos JSON, presets, lista vacía y nombres largos. Importar HTML/JSON, exportar fuente/renderizado/bundle y restablecer ejemplos. Borradores y biblioteca en localStorage, formato versionado mailcanvas-demo/v2. Simulación de latencia y fallo de guardado. Preview final e imágenes temporales.

81 pruebas unitarias/integración al comenzar. Comprobaciones de tipos consumidores, build de demo y biblioteca, prueba de consumo y scripts de revisión visual. Capturas de regresiones de tamaño, condiciones, alineación, móvil y guardado. GitHub Actions valida matrices de Node/React y publica en npm al subir un tag de versión.

Yambo consume un paquete local reproducible con la integración más reciente. La aplicación anfitriona administra plantillas, comunicados, componentes, datos, almacenamiento, base de datos, envío y renderizado de servidor. La reescritura de este repositorio se centra en Mailcanvas y su demo.

## Límites que deben permanecer explícitos

El motor local implementa un subconjunto de Thymeleaf. Las capturas en Chromium no certifican renderizado en clientes de correo. Los envíos y previews de servidor requieren callbacks del host. La demo no envía correo. Las URLs blob no sobreviven a recargas. HTML protegido no equivale a edición estructurada completa de cualquier HTML. Se requiere DOM para parseo y preview, con montaje cliente en aplicaciones SSR.
