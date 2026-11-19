// Servidor estático local para desenvolver e conferir o build. Uso: node scripts/serve.mjs [src|dist]
// A página usa módulos JavaScript, então precisa ser aberta por http (não por file://).
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, process.argv[2] || "src");
const port = Number(process.env.PORT || 8788);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json",
};

if (!existsSync(dir)) {
  console.error(`Pasta ${dir} não existe. Rode "npm run build" antes do preview.`);
  process.exit(1);
}

createServer((req, res) => {
  const path = decodeURIComponent((req.url || "/").split("?")[0]);
  let file = normalize(join(dir, path));
  if (!file.startsWith(dir)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Não encontrado");
    return;
  }
  res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`landing em http://localhost:${port} (servindo ${process.argv[2] || "src"})`));
