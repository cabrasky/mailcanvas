import { chromium } from 'file:///C:/Users/javie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5198'], {windowsHide:true});
await new Promise(resolve=>server.stdout.on('data',data=>{if(data.toString().includes('5198'))resolve();}));
const browser = await chromium.launch({headless:true,executablePath:'C:/Users/javie/AppData/Local/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-win64/chrome-headless-shell.exe'});
try {
  const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});
  await page.goto('http://127.0.0.1:5198/');
  await page.getByLabel('Correo a editar').selectOption('welcome');
  await page.getByRole('tab',{name:'Capas',exact:true}).click();
  const panel=page.locator('.ee-left-panel');
  const first=panel.locator('[data-ee-layer-id]').first();
  const last=panel.locator('[data-ee-layer-id]').last();
  const id=await first.getAttribute('data-ee-layer-id');
  const name=first.locator('.ee-layer-select .ee-tree-name');
  await name.dragTo(last.locator('.ee-layer-select'),{targetPosition:{x:55,y:28}});
  const end=await panel.locator('[data-ee-layer-id]').last().getAttribute('data-ee-layer-id');
  if(end!==id)throw new Error('Dragging from layer name did not move the layer');
  await panel.locator('[data-ee-layer-id]').first().locator('.ee-layer-select').click();
  if(await panel.locator('[data-ee-layer-id]').first().locator('.ee-layer-select').getAttribute('aria-pressed')!=='true')throw new Error('Click selection broke');
  await panel.screenshot({path:'artifacts/visual/capas-arrastre-fila.png'});
  console.log('Verified native drag from the layer name (not the handle), document reordering and ordinary click selection.');
}finally{await browser.close();server.kill();}
