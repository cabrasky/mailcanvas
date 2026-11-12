import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root=fileURLToPath(new URL("../../",import.meta.url));
const compatibilityRoot=process.env.REACT_COMPAT_ROOT;
export default defineConfig({
  root:fileURLToPath(new URL("./",import.meta.url)),
  plugins:[react()],
  cacheDir:path.join(root,"node_modules/.vite-library-consumer"+(compatibilityRoot?"-compat":"")),
  resolve:{
    dedupe:["react","react-dom"],
    alias:compatibilityRoot?[
      {find:/^react$/,replacement:path.join(compatibilityRoot,"react/index.js")},
      {find:/^react\/jsx-runtime$/,replacement:path.join(compatibilityRoot,"react/jsx-runtime.js")},
      {find:/^react\/jsx-dev-runtime$/,replacement:path.join(compatibilityRoot,"react/jsx-dev-runtime.js")},
      {find:/^react-dom\/client$/,replacement:path.join(compatibilityRoot,"react-dom/client.js")},
      {find:/^react-dom$/,replacement:path.join(compatibilityRoot,"react-dom/index.js")},
    ]:[],
  },
  server:{fs:{allow:[root,...(compatibilityRoot?[compatibilityRoot]:[])]}},
});
