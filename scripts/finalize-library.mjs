import fs from 'node:fs/promises';
import path from 'node:path';
// CSS is a separate public entry, so declarations must not reference source-only CSS paths.
async function clean(directory) {
  for(const entry of await fs.readdir(directory,{withFileTypes:true})) {
    const file=path.join(directory,entry.name);
    if(entry.isDirectory())await clean(file);
    else if(entry.name.endsWith('.d.ts')) {
      const source=await fs.readFile(file,'utf8');
      await fs.writeFile(file,source.replace(/^import\s+["'][^"']+\.css["'];?\r?\n/gm,''));
    }
  }
}
await clean('dist/types');
