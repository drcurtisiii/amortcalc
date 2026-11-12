// Local stand-in for the deployed Worker: serves _site/ as ASSETS (404 → 404.html) and runs the real
// cloudflare/worker.mjs for everything, with an in-memory Dropbox. Synthetic data only.
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { handle } from "../../cloudflare/worker.mjs";
import { fakeDropbox, SYNTHETIC_ENV } from "./fake-dropbox.mjs";

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".md": "text/markdown", ".txt": "text/plain", ".pdf": "application/pdf" };

export async function startServer(siteDir, env = SYNTHETIC_ENV) {
  const box = fakeDropbox();
  const ASSETS = {
    async fetch(req) {
      let p = decodeURIComponent(new URL(req.url).pathname);
      if (p.endsWith("/")) p += "index.html";
      const file = path.join(siteDir, p);
      if (!file.startsWith(siteDir)) return new Response("bad", { status: 400 });
      try { return new Response(await readFile(file), { headers: { "content-type": TYPES[path.extname(file)] || "application/octet-stream" } }); }
      catch { return new Response(await readFile(path.join(siteDir, "404.html")), { status: 404, headers: { "content-type": TYPES[".html"] } }); }
    },
  };
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body });
    const response = await handle(request, { ...env, ASSETS }, {}, { fetch: box.fetch });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${server.address().port}`, box, close: () => new Promise((r) => server.close(r)) };
}
