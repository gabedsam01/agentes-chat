// Gera landing/dist a partir de landing/src. Sem dependências: só copia os arquivos estáticos.
import { cpSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const dist = join(root, "dist");

if (!existsSync(join(src, "index.html"))) {
  console.error("landing/src/index.html não encontrado.");
  process.exit(1);
}

rmSync(dist, { recursive: true, force: true });
cpSync(src, dist, { recursive: true });

let files = 0;
let bytes = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else {
      files += 1;
      bytes += s.size;
    }
  }
};
walk(dist);
console.log(`landing: ${files} arquivos (${(bytes / 1024).toFixed(0)} KB) em ${relative(process.cwd(), dist) || "dist"}`);
