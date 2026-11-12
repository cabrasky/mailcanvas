import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
let playwright;
try{playwright=await import(process.env.PLAYWRIGHT_MODULE||'playwright');}
catch{playwright=await import(pathToFileURL(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);}
const cachedChromium=path.join(os.homedir(),'AppData/Local/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-win64/chrome-headless-shell.exe');
const chromium=process.env.CHROMIUM_EXECUTABLE||((await fs.stat(cachedChromium).catch(()=>null))?cachedChromium:undefined);
const artifactDir=process.env.COMPONENT_ARTIFACT_DIR||'artifacts/visual';
const port=Number(process.env.COMPONENT_TEST_PORT||5216);
const reactRoot=process.env.REACT_COMPAT_ROOT||path.resolve('node_modules');
const reactVersion=JSON.parse(await fs.readFile(path.join(reactRoot,'react/package.json'),'utf8')).version;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','examples/embedded/vite.config.ts','--host','127.0.0.1','--port',String(port),'--strictPort'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
let browser;
try{
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('No arrancó Vite.')),20000);
    server.stdout.on('data',data=>{if(data.toString().includes(`127.0.0.1:${port}`)){clearTimeout(timeout);resolve();}});
    server.once('exit',code=>{clearTimeout(timeout);reject(new Error(`Vite terminó: ${code}`));});
  });
  browser=await playwright.chromium.launch({headless:true,...(chromium?{executablePath:chromium}:{})});
  const page=await browser.newPage({viewport:{width:1680,height:1400},deviceScaleFactor:1});
  const errors=[];const workers=[];
  page.on('pageerror',error=>errors.push(error.stack??error.message));
  page.on('console',message=>{if(message.type()==='error'){errors.push(message.text());for(const arg of message.args())void arg.evaluate(value=>value instanceof Error?value.stack:null).then(stack=>{if(stack)console.log(stack);}).catch(()=>{});}});
  page.on('worker',worker=>workers.push(worker.url()));
  await page.goto(`http://127.0.0.1:${port}/`);
  const first=page.getByRole('region',{name:'Editor uno',exact:true});
  const second=page.getByRole('region',{name:'Editor dos',exact:true});
  await first.waitFor();await second.waitFor();
  if(await first.evaluate(element=>getComputedStyle(element).position)==='fixed')throw new Error('El componente ocupa la ventana por defecto.');
  await first.getByRole('button',{name:/Título/}).click();
  if(!(await page.getByLabel('HTML primer editor').innerText()).includes('<h2'))throw new Error('No se emitió onChange.');
  if((await page.getByLabel('HTML segundo editor').innerText()).includes('<h2'))throw new Error('Las instancias comparten documento.');
  await first.getByRole('button',{name:'Maximizar editor',exact:true}).click();
  if(await page.getByLabel('Estado maximizado').innerText()!=='sí')throw new Error('No se notificó la maximización.');
  await first.getByRole('button',{name:'Minimizar editor',exact:true}).click();
  if(await first.evaluate(element=>element.style.height)!=='520px')throw new Error('No se restauró el tamaño del padre.');
  await fs.mkdir(artifactDir,{recursive:true});
  await page.screenshot({path:path.join(artifactDir,`react-component-${reactVersion}.png`)});
  await first.getByRole('tab',{name:/Código/}).click();
  const input=first.locator('.monaco-editor textarea.inputarea');
  await input.waitFor({timeout:30000});
  await input.focus();
  await page.keyboard.press('Control+End');
  await page.keyboard.insertText('\n<!-- library-consumer -->');
  await page.waitForFunction(()=>document.querySelector('[aria-label="HTML primer editor"]')?.textContent.includes('library-consumer'));
  await page.keyboard.press('Control+Space');
  // Worker activation depends on Monaco services. Exercise the exported worker factory
  // directly as well, so both packaged worker URLs are verified deterministically.
  await page.evaluate(async()=>{
    globalThis.__componentTestWorkers=[];
    for(const label of ['html','editorWorkerService'])globalThis.__componentTestWorkers.push(await globalThis.MonacoEnvironment.getWorker('',label));
  });
  if(!workers.length)console.log(JSON.stringify({errors,workers:await page.evaluate(()=>globalThis.__componentTestWorkers.map(worker=>({type:worker.constructor.name,isWorker:worker instanceof Worker})))}));
  if(!workers.length)await page.waitForEvent('worker',{timeout:20000});
  await Promise.all(page.workers().map(worker=>worker.evaluate(()=>typeof self.onmessage)));
  await page.screenshot({path:path.join(artifactDir,`react-component-code-${reactVersion}.png`)});
  if(errors.length)throw new Error(errors.join('\n'));
  const report={reactVersion,source:'exports del paquete y CSS compilados en dist/',checks:['dos instancias embebidas','onChange independiente','maximizar/minimizar','callback de tamaño','Monaco diferido','edición de código','workers'],workers,errors};
  await fs.writeFile(path.join(artifactDir,`react-component-${reactVersion}.json`),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}finally{if(browser)await browser.close();server.kill();}
