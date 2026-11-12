// Builds the publish folder (_site/) from an explicit ALLOW-LIST of public files (adapted from Site
// Selector's tools/stage-site.mjs). wrangler.toml uploads only _site/, so nothing not listed here
// (cloudflare/, tools/, tests/, netlify.toml, package.json, the .tsx draft, readme, keys) can ever be
// served. _site/ is regenerated on every run.
import { cp, rm, mkdir, readdir, stat, access, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "_site");

export const PUBLIC = [
  "index.html", "404.html", "styles.css", "app-extras.css", "_headers",
  "llms.txt", "agent.md", ".well-known",
  "ai-agent-icon.png", "clf-shield-brass-final.png", "bluei.png",
  "js", "docx",
];
const FORBIDDEN = /(^|[\\/])(_site|node_modules|\.wrangler|\.dev\.vars|wrangler\.toml|netlify\.toml|_redirects|package(-lock)?\.json|cloudflare|tools|tests|netlify|\.git|\.claude|[^\\/]*\.tsx|[^\\/]*\.key|[^\\/]*\.tmp\.[^\\/]*|\.env|\.env\.[^\\/]*|[^\\/]*KEYS[^\\/]*\.md|CLOUDFLARE\.md|readme\.md|archive)([\\/]|$)/i;

if (path.basename(out) !== "_site" || path.dirname(out) !== root) throw new Error("stage-site: refusing to touch " + out);
// Dropbox can hold a folder open on Windows: retry the wipe, then move the folder aside.
for (const entry of await readdir(root)) if (entry.startsWith("_site.old-")) rm(path.join(root, entry), { recursive: true, force: true }).catch(() => {});
for (let attempt = 1; ; attempt += 1) {
  try { await rm(out, { recursive: true, force: true }); break; }
  catch (error) {
    if (!["EBUSY", "EPERM", "ENOTEMPTY"].includes(error.code)) throw error;
    if (attempt < 4) { await new Promise((r) => setTimeout(r, 1500 * attempt)); continue; }
    const aside = path.join(root, `_site.old-${Date.now().toString(36)}`);
    await rename(out, aside);
    console.warn(`stage-site: _site was locked (Dropbox); moved aside as ${path.basename(aside)}`);
    rm(aside, { recursive: true, force: true }).catch(() => {});
    break;
  }
}
await mkdir(out, { recursive: true });
if (process.platform === "win32") await writeFile(`${out}:com.dropbox.ignored`, "1").catch(() => {});
for (const item of PUBLIC) {
  const src = path.join(root, item);
  try { await access(src); } catch { throw new Error(`stage-site: required public file missing: ${item}`); }
  await cp(src, path.join(out, item), { recursive: true, filter: (s) => !FORBIDDEN.test(path.relative(root, s)) });
}
let files = 0, bytes = 0, largest = 0;
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(out, full);
    if (FORBIDDEN.test(rel)) throw new Error(`stage-site: forbidden path staged: ${rel}`);
    if (entry.isDirectory()) await walk(full);
    else { files += 1; const size = (await stat(full)).size; bytes += size; largest = Math.max(largest, size); if (size > 25 * 1024 * 1024) throw new Error(`stage-site: ${rel} exceeds the 25 MiB Cloudflare asset limit`); }
  }
}
await walk(out);
if (files > 20_000) throw new Error(`stage-site: ${files} files exceeds the 20,000-file Cloudflare asset limit`);
console.log(`stage-site: staged ${files} files (${(bytes / 1048576).toFixed(1)} MiB, largest ${(largest / 1048576).toFixed(1)} MiB) into _site/`);
