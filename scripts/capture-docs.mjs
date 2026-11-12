import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'docs', 'screenshots');
await fs.mkdir(output, { recursive: true });
let playwright;
try { playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'); }
catch {
  const bundled = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
  try { playwright = await import(pathToFileURL(bundled).href); }
  catch { throw new Error('Playwright no está disponible. Instala el paquete o define PLAYWRIGHT_MODULE con la URL file:/// de su módulo.'); }
}
let executablePath = process.env.CHROMIUM_EXECUTABLE;
if (!executablePath) {
  const cache = path.join(os.homedir(), 'AppData/Local/ms-playwright');
  const versions = (await fs.readdir(cache).catch(() => [])).filter(name => name.startsWith('chromium_headless_shell-')).sort((a,b) => b.localeCompare(a, undefined, { numeric:true }));
  for (const version of versions) {
    const candidate = path.join(cache, version, 'chrome-headless-shell-win64/chrome-headless-shell.exe');
    if (await fs.stat(candidate).catch(() => null)) { executablePath = candidate; break; }
  }
}
const port = Number(process.env.DOCS_PORT || 5204);
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd:root, windowsHide:true, stdio:['ignore','pipe','pipe'] });
let browser;
try {
  await new Promise((resolve,reject) => {
    const timeout = setTimeout(() => reject(new Error('Vite no respondió en 20 segundos.')), 20000);
    server.stdout.on('data',data => { if (data.toString().includes(`127.0.0.1:${port}`)) { clearTimeout(timeout); resolve(); } });
    server.once('error',error => {clearTimeout(timeout);reject(error);});
    server.once('exit',code => {clearTimeout(timeout);reject(new Error(`Vite terminó antes de arrancar (${code}).`));});
  });
  browser = await playwright.chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  const page = await browser.newPage({viewport:{width:1680,height:1100},deviceScaleFactor:1});
  const captures = [];
  const reset = async () => {
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.locator('.ee-email-page').waitFor();
    await page.evaluate(() => document.fonts.ready);
  };
  const shot = async (name,title,section,target=page) => {
    await target.screenshot({path:path.join(output,name),animations:'disabled',caret:'hide'});
    captures.push({file:name,title,section});
    console.log(`Capturada: ${name}`);
  };
  await reset();
  const panel=page.locator('.ee-left-panel');
  const inspector=page.getByLabel('Inspector de propiedades');
  await shot('01-editor.png','Editor maximizado · confirmación de pedido','Demo');
  await shot('02-insertar.png','Biblioteca de bloques','Paneles',panel);
  await page.getByRole('button',{name:/^Variables /}).click();
  await page.getByLabel('Buscar bloques y variables').fill('direccion');
  await shot('03-objetos.png','Objeto y propiedades anidadas','Datos',panel);
  await page.getByLabel('Buscar bloques y variables').fill('products');
  await shot('04-arrays.png','Array, tipos y elemento de muestra','Datos',panel);
  await page.getByRole('tab',{name:'Capas',exact:true}).click();
  await shot('05-capas.png','Árbol de capas y fuentes de tabla','Paneles',panel);
  await page.getByLabel('Buscar capas').fill('Calle');
  await shot('06-capas-busqueda.png','Búsqueda con los grupos padres','Paneles',panel);

  await reset();
  await page.locator('.ee-email-page th').filter({hasText:'Precio'}).click();
  await inspector.getByLabel('Formato lineTotal',{exact:true}).selectOption('currency');
  await shot('07-columnas.png','Columna: encabezado, formato y orden','Tablas',inspector);
  await inspector.getByRole('button',{name:'Filas',exact:true}).click();
  await inspector.getByLabel('Valor 1 lineTotal',{exact:true}).fill('${item.quantity * item.unitPrice}');
  await inspector.getByLabel('Valor 1 sku',{exact:true}).click();
  await page.keyboard.press('Escape');
  await shot('08-filas.png','Valores con T | ƒ y ejemplos calculados','Tablas',inspector);
  await inspector.getByRole('button',{name:'＋ Fila única',exact:true}).click();
  await inspector.locator('.ee-table-row-heading').filter({hasText:'2. Fila única'}).click();
  await inspector.getByLabel('Valor 2 name',{exact:true}).fill('Envío');
  await inspector.getByRole('button',{name:'Valor dinámico: Valor 2 lineTotal',exact:true}).click();
  await inspector.getByLabel('Valor 2 lineTotal',{exact:true}).fill('${costeEnvio}');
  await inspector.getByRole('button',{name:'Resultado',exact:true}).click();
  if (!await inspector.getByText('4 filas generadas',{exact:true}).count()) throw new Error('La tabla combinada no generó cuatro filas.');
  await shot('09-resultado.png','Array calculado y fila única en la misma tabla','Tablas',inspector);
  await shot('10-tabla-combinada.png','Tabla combinada en el lienzo y en el inspector','Tablas');
  await inspector.getByRole('tab',{name:'Diseño',exact:true}).click();
  await shot('11-diseno.png','Inspector: controles de diseño','Inspector',inspector);
  await inspector.getByRole('tab',{name:'Avanzado',exact:true}).click();
  await shot('12-avanzado.png','Inspector: CSS y atributos avanzados','Inspector',inspector);

  await reset();
  await page.getByRole('button',{name:/^Componentes /}).click();
  await shot('13-componentes.png','Catálogo de componentes compartidos','Componentes',panel);
  await page.locator('.ee-email-page [data-ee-block-kind="component"]').first().click();
  await page.getByRole('button',{name:'Valor dinámico: Propiedad brand',exact:true}).click();
  await page.getByLabel('Propiedad brand',{exact:true}).fill('${pedido} · ${nombre}');
  await page.keyboard.press('Escape');
  await shot('14-instancia.png','Instancia personalizada con texto y variables','Componentes',inspector);
  await page.getByRole('button',{name:'Restablecer Marca',exact:true}).click();
  await page.getByRole('button',{name:'◇ Biblioteca',exact:true}).click();
  await shot('15-biblioteca.png','Edición del original compartido','Componentes',page.getByRole('dialog'));
  await page.getByRole('button',{name:'Volver al editor',exact:true}).click();

  await reset();
  await page.getByLabel('Correo a editar').selectOption('welcome');
  await shot('16-bienvenida.png','Demo: correo de bienvenida','Demo');
  await page.getByLabel('Correo a editar').selectOption('order-update');
  await shot('17-envio.png','Demo: actualización del envío','Demo');
  await page.getByRole('button',{name:'Ocultar panel izquierdo',exact:true}).click();
  await page.getByRole('button',{name:'Ocultar inspector',exact:true}).click();
  await page.getByRole('button',{name:/Lado a lado/}).click();
  await page.locator('.ee-device iframe').waitFor();
  await shot('18-preview-escritorio.png','Vista previa local en escritorio','Preview');
  await page.getByRole('button',{name:/375px/}).click();
  await shot('19-preview-movil.png','Vista previa local con ancho móvil','Preview');

  await reset();
  await page.getByRole('tab',{name:/Código/}).click();
  await page.locator('.monaco-editor').first().waitFor({timeout:30000});
  await shot('20-codigo.png','Editor de código HTML y Thymeleaf','Código');
  await page.getByRole('tab',{name:/Bloques/}).click();
  await page.getByRole('button',{name:'Minimizar editor',exact:true}).click();
  await shot('21-minimizado.png','Editor en vista reducida','Demo',page.locator('.email-editor'));

  const manifest={date:'2026-11-12',browser:await browser.version(),viewport:{width:1680,height:1100},deviceScaleFactor:1,notes:'Capturas nuevas de la demo real. Cada sección reinicia la sesión. La tabla combinada se configura mediante la interfaz; los datos de ejemplo no se envían a servicios externos.',captures};
  await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
  const sections=[...new Set(captures.map(capture=>capture.section))];
  const cards=captures.map(capture=>`<figure data-section="${capture.section}"><figcaption><span>${capture.section}</span><h2>${capture.title}</h2><a href="${capture.file}" target="_blank">Abrir a tamaño original ↗</a></figcaption><a href="${capture.file}" target="_blank"><img loading="lazy" src="${capture.file}" alt="${capture.title}"></a></figure>`).join('\n');
  await fs.writeFile(path.join(output,'index.html'),`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Guía visual del editor</title><style>body{font:16px/1.6 system-ui;margin:0;background:#f5f2f8;color:#352c40}header,main{max-width:1400px;margin:auto;padding:28px}header h1{font-size:32px;margin:0}header p{color:#776780;max-width:850px}nav{display:flex;flex-wrap:wrap;gap:8px}button{border:1px solid #d5c8df;border-radius:20px;padding:8px 16px;background:white;color:#5f3b7a;cursor:pointer}button[aria-pressed=true]{background:#664184;color:white}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:24px}figure{margin:0;border:1px solid #e1d8e7;border-radius:12px;background:white;overflow:hidden;align-self:start}figcaption{padding:18px}figcaption span{font-size:11px;text-transform:uppercase;color:#9579a8;letter-spacing:.08em}h2{font-size:17px;margin:5px 0}a{color:#77508f;font-size:12px}img{display:block;width:100%;max-height:650px;object-fit:contain;object-position:top;background:#29252e}[hidden]{display:none!important}</style><header><h1>Guía visual del editor</h1><p>21 capturas nuevas · 12 de noviembre de 2026 · Chromium ${manifest.browser} · escritorio 1680 × 1100 a escala 1×. Abre cada imagen para verla sin reducir. Son estados reales del prototipo; no son diseños simulados.</p><nav aria-label="Filtrar capturas"><button aria-pressed="true" onclick="filter('Todas',this)">Todas</button>${sections.map(section=>`<button aria-pressed="false" onclick="filter('${section}',this)">${section}</button>`).join('')}</nav></header><main>${cards}</main><script>function filter(section,button){document.querySelectorAll('figure').forEach(card=>card.hidden=section!=='Todas'&&card.dataset.section!==section);document.querySelectorAll('nav button').forEach(item=>item.setAttribute('aria-pressed',String(item===button)))}</script></html>`);
  await page.goto(`http://127.0.0.1:${port}/docs/screenshots/index.html`);
  if(await page.locator('figure').count()!==captures.length)throw new Error('La galería no contiene todas las capturas.');
  await page.getByRole('button',{name:'Tablas',exact:true}).click();
  if(await page.locator('figure:visible').count()!==4)throw new Error('El filtro de tablas no funciona.');
  await page.getByRole('button',{name:'Todas',exact:true}).click();
  if(await page.locator('figure:visible').count()!==captures.length)throw new Error('El filtro Todas no restaura la galería.');
  console.log(`Guardadas ${captures.length} capturas, manifiesto y galería en docs/screenshots/. Galería y filtros comprobados.`);
} finally { if(browser)await browser.close();server.kill(); }
