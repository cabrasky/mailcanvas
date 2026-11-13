# Usar como componente React

El editor se distribuye como una librería ESM independiente de la demo. React y React DOM son peer dependencies: utiliza las copias de la aplicación consumidora. El paquete compilado no importa `demo/`, sus estilos ni sus datos de ejemplo.

## Compilar e instalar

Desde este repositorio:

```sh
npm install
npm run build:lib
npm pack --ignore-scripts --pack-destination artifacts
```

En la aplicación de destino:

```sh
npm install /ruta/mailcanvas-1.0.0.tgz
```

Este comando crea un archivo local y no publica en npm. El paquete está preparado para publicación pública con licencia MIT; el workflow y la configuración se explican en [CI y publicación](CI-Y-PUBLICACION.md). El archivo `.tgz` incluye JavaScript, estilos, chunks de Código y declaraciones TypeScript.

## Uso mínimo

```tsx
import { useState } from "react";
import { EmailEditor, type EmailToken } from "mailcanvas";
import "mailcanvas/style.css";

const tokens: EmailToken[] = [
  { token: "{{nombre}}", varName: "nombre", label: "Nombre", sample: "Lucía" },
];

export default function MiEditor() {
  const [html, setHtml] = useState('<p>Hola <span th:text="${nombre}">Nombre</span>.</p>');

  return (
    <EmailEditor
      title="Confirmación de pedido"
      value={html}
      onChange={setHtml}
      tokens={tokens}
      style={{ height: 720, minHeight: 0 }}
      onSave={() => guardarPlantilla(html)}
    />
  );
}

// Implementación de la aplicación consumidora.
async function guardarPlantilla(html: string) {
  console.log(html);
}
```

También existe un export por defecto: `import EmailEditor from "mailcanvas"`.

Importa el CSS una vez. No importes `src/styles.css`, `demo/demo.css` ni los archivos internos del paquete. El layout y los callbacks de guardado pertenecen al padre.

## Tamaño integrado o maximizado

El componente se integra en el flujo de la página **por defecto**. La demo conserva la apertura maximizada mediante `defaultMaximized`.

```tsx
<EmailEditor value={html} onChange={setHtml} defaultMaximized />
```

Para controlarlo desde la aplicación:

```tsx
const [maximized, setMaximized] = useState(false);

<EmailEditor
  value={html}
  onChange={setHtml}
  maximized={maximized}
  onMaximizedChange={setMaximized}
  className="mi-editor"
  style={{ height: 600, minHeight: 0 }}
/>
```

| Propiedad | Uso |
| --- | --- |
| `value` / `onChange` | Fuente HTML controlada |
| `tokens` | Muestras y nombres de variables |
| `commonElements` | Envoltura y biblioteca de componentes compartidos |
| `title` | Título y nombre accesible del editor |
| `className`, `style` | Estilos del contenedor integrable |
| `defaultMaximized` | Estado inicial no controlado, `false` por defecto |
| `maximized` | Estado controlado por el padre |
| `onMaximizedChange` | Notifica la intención de cambiar de tamaño |
| `navigation` | ReactNode para selector de correos u otras acciones |
| `onSave` | Guardado opcional; admite `void`, `boolean` o `Promise<void \| boolean>`. Se espera su resolución. Devuelve `false` si el host ya ha gestionado un error o una validación. |
| `onReset`, `onSendTest`, `onServerPreview` | Acciones opcionales sin parámetros |
| `onUploadImage` | `(file: File) => Promise<string>`: sube una imagen usando el almacenamiento del host y devuelve su URL permanente. Sin este callback se mantiene la entrada manual por URL. |
| `dirty` | Estado pendiente opcional controlado por el host, útil cuando también cambian el asunto, los datos o propiedades ajenas al HTML. El host lo limpia cuando confirma el guardado. |

Con `maximized` controlado, el padre debe actualizar la propiedad para aplicar el cambio. No combines un estado controlado con la expectativa de que el editor lo cambie por su cuenta. Al minimizar, se restaura el tamaño del contenedor; al desmontar, se libera el bloqueo de scroll usado al maximizar.

## Biblioteca compartida

```tsx
import type { EmailComponent } from "mailcanvas";

const components: EmailComponent[] = [{
  key: "aviso",
  name: "Aviso compartido",
  category: "Contenido",
  description: "Un mensaje reutilizable",
  properties: [{ key: "title", label: "Título", type: "text", defaultValue: "Hola" }],
  html: '<section><h3 th:text="${title}">Hola</h3></section>',
}];

<EmailEditor
  value={html}
  onChange={setHtml}
  tokens={tokens}
  commonElements={{ components }}
/>
```

El padre mantiene el catálogo. El diálogo de biblioteca de la demo es un ejemplo de administración, no una dependencia del componente. Cambiar la definición actualiza los valores no personalizados de las instancias; los valores locales se conservan.

## Varios documentos o instancias

Cada instancia tiene documento, selección e historial independientes. Para varios correos en una sola superficie, conserva un mapa de fuentes en el padre y utiliza `key={documentId}` al cambiar de documento.

El ejemplo [examples/embedded/main.tsx](../examples/embedded/main.tsx) monta **dos editores** e importa únicamente los exports y el CSS del paquete compilado:

```sh
npm run build:lib
npm run dev:component
```

## Código, workers y entorno

El modo Código carga Monaco de forma diferida. Sus workers están incluidos en ese módulo; no hay que copiar archivos a `public/` ni configurar un CDN. Si la aplicación usa una CSP estricta, debe permitir los workers `blob:` o proporcionar su propia `MonacoEnvironment.getWorker` antes de abrir Código. Se conserva un factory del host ya configurado.

Es un editor orientado al navegador. Para frameworks con render de servidor, móntalo en un límite cliente o después de la hidratación: el parser de bloques y la preview necesitan APIs DOM. No se promete hidratación idéntica entre un servidor sin DOM y el navegador.

El formato de distribución es ESM; no hay entrada CommonJS. Los cambios de la demo siguen viviendo en memoria: convertirlo en librería no añade persistencia ni llamadas a Yambo.

## Salidas y comprobaciones

| Comando / carpeta | Uso |
| --- | --- |
| `npm run build:lib` → `dist/` | Librería, CSS y tipos |
| `npm run build:demo` → `demo-dist/` | Aplicación de demostración |
| `npm run build` | Compila ambas salidas |
| `npm run preview` | Sirve la demo compilada |
| `npm run test:consumer-types` | Comprueba un consumidor TypeScript contra las declaraciones públicas |
| `npm run test:component` | Prueba de navegador del paquete compilado; necesita Playwright/Chromium |

Se ha comprobado el consumo con React **18.3.1** y **19.2.3**. Los informes y capturas están en `artifacts/visual/react-component-*.json` y `.png`. El rango de peers admite React/React DOM 18.3.1 y 19; las versiones concretas anteriores son las efectivamente verificadas.

Para comprobar otra instalación local de React, `REACT_COMPAT_ROOT` puede apuntar a su directorio `node_modules`; ese directorio se usa en lectura para la prueba. `COMPONENT_TEST_PORT`, `PLAYWRIGHT_MODULE` y `CHROMIUM_EXECUTABLE` permiten adaptar el entorno.
