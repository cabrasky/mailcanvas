import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const roots=['@monaco-editor/react','monaco-editor','emmet-monaco-es'];
const visited=new Set();const notices=[];
async function visit(name,parent=process.cwd()){
  if(name==='react'||name==='react-dom')return;
  const require=createRequire(path.join(parent,'package.json'));
  let directory;
  try{directory=path.dirname(require.resolve(`${name}/package.json`));}
  catch{
    directory=path.dirname(require.resolve(name));
    while(true){
      const candidate=await fs.readFile(path.join(directory,'package.json'),'utf8').then(JSON.parse).catch(()=>null);
      if(candidate?.name===name)break;
      const next=path.dirname(directory);if(next===directory)throw new Error(`Cannot locate ${name}`);directory=next;
    }
  }
  if(visited.has(directory))return;visited.add(directory);
  const pkg=JSON.parse(await fs.readFile(path.join(directory,'package.json'),'utf8'));
  const files=(await fs.readdir(directory)).filter(file=>/^(licen[sc]e|copying|notice)([.-]|$)/i.test(file));
  const texts=[];
  for(const file of files){const full=path.join(directory,file);if((await fs.stat(full)).isFile())texts.push(await fs.readFile(full,'utf8'));}
  if(!texts.length)throw new Error(`Missing license text for ${pkg.name}@${pkg.version}`);
  notices.push(`${pkg.name}@${pkg.version}\nLicense: ${typeof pkg.license==='string'?pkg.license:JSON.stringify(pkg.license)}\n\n${texts.join('\n\n')}`);
  for(const dependency of Object.keys(pkg.dependencies||{}))await visit(dependency,directory);
}
for(const root of roots)await visit(root);
notices.sort();
await fs.writeFile('THIRD_PARTY_LICENSES.txt','Third-party dependency license notices\n\nThis inventory includes the bundled editor dependencies and their runtime dependency closure. Some transitive helpers may be removed by tree shaking. React and React DOM are supplied by the host application. The project MIT license does not replace these third-party licenses.\n\n'+notices.join('\n\n'+'='.repeat(72)+'\n\n')+'\n');
console.log(`Generated license notices for ${notices.length} dependencies.`);
