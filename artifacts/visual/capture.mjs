import { chromium } from 'file:///C:/Users/javie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5199'], { windowsHide:true });
await new Promise(resolve => server.stdout.on('data', data => { if (data.toString().includes('5199')) resolve(); }));
const browser = await chromium.launch({headless:true,executablePath:"C:/Users/javie/AppData/Local/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-win64/chrome-headless-shell.exe"});
const page = await browser.newPage({viewport:{width:1600,height:1800},deviceScaleFactor:1});
await page.goto('http://127.0.0.1:5199/');
await page.locator('.ee-email-page > div').first().waitFor();
await page.addStyleTag({content:'.ee-container-label,.ee-scope-tag,.ee-overlay-layer,.ee-table-resize-handle{visibility:hidden!important}.ee-canvas-layer{transform:none!important;position:relative!important}.ee-viewport{overflow:visible!important}.ee-email-page{box-shadow:none!important}.ee-scope-loop,.ee-scope-if{box-shadow:none!important}'});
const editor = page.locator('.ee-email-page > div').first();
const frame = page.frames().find(f=>f!==page.mainFrame() && f.name()==='');
const previewFrame = await page.locator('.demo-final iframe').elementHandle();
const preview = await previewFrame.contentFrame();
const target = preview.locator('body > table > tbody > tr > td > table > tbody > tr > td > div').first();
// Align both roots to integer pixel coordinates; otherwise iframe placement introduces
// subpixel antialiasing differences across every text line.
await page.locator('.demo-final iframe').evaluate(el=>Object.assign(el.style,{position:'absolute',top:'0px',left:'800px',height:'1400px',border:'0',borderRadius:'0'}));
const align = el => {const r=el.getBoundingClientRect(); el.style.position='relative';el.style.top=`${Math.round(r.y)-r.y}px`;el.style.left=`${Math.round(r.x)-r.x}px`;};
await editor.evaluate(align);
await target.evaluate(align);
await page.locator('.demo-final iframe').evaluate(e=>e.style.visibility='hidden');
await page.locator('.ee-email-page').evaluate(e=>e.style.zIndex='2147483647');
await editor.screenshot({path:'artifacts/visual/editor.png'});
await page.locator('.ee-email-page').evaluate(e=>e.style.visibility='hidden');
await page.locator('.demo-final iframe').evaluate(e=>{e.style.visibility='visible';e.style.zIndex='2147483647';});
await target.screenshot({path:'artifacts/visual/preview.png'});
const geometry = async root => root.evaluate(el=>{
 const base=el.getBoundingClientRect();
 return {width:base.width,height:base.height,items:[...el.querySelectorAll('h2,h3,p,table,div')].map(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {tag:n.tagName,text:n.textContent.trim().slice(0,65),x:r.x-base.x,y:r.y-base.y,width:r.width,height:r.height,font:s.fontSize,lineHeight:s.lineHeight,margin:s.margin,padding:s.padding}})};
});
await fs.writeFile('artifacts/visual/geometry.json',JSON.stringify({editor:await geometry(editor),preview:await geometry(target)},null,2));
console.log('Saved editor.png, preview.png and geometry.json');
await browser.close();
server.kill();



