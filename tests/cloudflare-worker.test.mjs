// Worker tests (synthetic data only): routing, source/config 404s, fail-closed API auth,
// project save/version/conflict/delete against an in-memory Dropbox, and the host-store guardrails.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handle } from "../cloudflare/worker.mjs";
import { keyMatches, projectId } from "../cloudflare/projects.mjs";
import { fakeDropbox, SYNTHETIC_ENV } from "./helpers/fake-dropbox.mjs";
import { resetTokenCache } from "../cloudflare/dropbox.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://amortization-calculator.example.workers.dev";
const assets = { fetch: async (req) => new Response(`asset:${new URL(req.url).pathname}`, { status: 200 }) };
const KEY = SYNTHETIC_ENV.AMORT_ADMIN_KEY;

function call(method, p, { env = SYNTHETIC_ENV, key = KEY, body, box } = {}) {
  const headers = {};
  if (key) headers["X-Amort-Admin-Key"] = key;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const req = new Request(ORIGIN + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return handle(req, { ...env, ASSETS: assets }, {}, { fetch: (box || fakeDropbox()).fetch });
}
const synthetic = (n) => ({ caseName: `Synthetic Borrower ${n}`, loanType: "standard", timestamp: "2026-01-01T00:00:00.000Z", schedule: [], inputs: { loanAmount: "100,000", interestRate: 5 + n } });

test("static paths go to ASSETS; the Worker only owns /api/*", async () => {
  const r = await call("GET", "/");
  assert.equal(await r.text(), "asset:/");
  assert.equal(await (await call("GET", "/js/main.js")).text(), "asset:/js/main.js");
  assert.equal(await (await call("GET", "/.well-known/agent.json")).text(), "asset:/.well-known/agent.json");
});

test("source and config paths return 404", async () => {
  for (const p of ["/wrangler.toml", "/package.json", "/package-lock.json", "/netlify.toml", "/_redirects", "/netlify/functions/x.mjs", "/cloudflare/worker.mjs", "/tools/stage-site.mjs", "/tests/x", "/.env", "/.dev.vars"]) {
    assert.equal((await call("GET", p)).status, 404, p);
  }
});

test("_site/ holds only the allow-list (no source, config or keys)", async () => {
  execFileSync(process.execPath, [path.join(root, "tools/stage-site.mjs")], { stdio: "ignore" });
  const listed = [];
  async function walk(d) { for (const e of await readdir(d, { withFileTypes: true })) { const f = path.join(d, e.name); e.isDirectory() ? await walk(f) : listed.push(path.relative(path.join(root, "_site"), f)); } }
  await walk(path.join(root, "_site"));
  for (const bad of ["wrangler.toml", "package.json", "netlify.toml", "_redirects", "amortization-calculator.tsx", "readme.md", "CLOUDFLARE.md"]) assert.ok(!listed.includes(bad), bad);
  assert.ok(!listed.some((f) => /^(cloudflare|tools|tests|netlify|node_modules)[\\/]/.test(f)));
  for (const need of ["index.html", "404.html", ".well-known/agent.json", "llms.txt", "agent.md", "js/agent-bridge.js", "js/projects.js", "ai-agent-icon.png"]) assert.ok(listed.includes(need), need);
});

test("health is public and reveals no secret values", async () => {
  const r = await call("GET", "/api/health", { key: null });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.configured, true);
  const text = JSON.stringify(j);
  for (const v of Object.values(SYNTHETIC_ENV).filter((v) => !v.startsWith("/"))) assert.ok(!text.includes(v));
  const off = await (await call("GET", "/api/health", { env: { DROPBOX_DATA_ROOT: SYNTHETIC_ENV.DROPBOX_DATA_ROOT }, key: null })).json();
  assert.equal(off.configured, false);
});

test("project API fails closed: 503 without secrets, 401 without or with a wrong key", async () => {
  const { AMORT_ADMIN_KEY, ...noAdmin } = SYNTHETIC_ENV;
  const { DROPBOX_REFRESH_TOKEN, ...noDropbox } = SYNTHETIC_ENV;
  assert.equal((await call("GET", "/api/projects", { env: noAdmin })).status, 503);
  assert.equal((await call("GET", "/api/projects", { env: noDropbox })).status, 503);
  assert.equal((await call("GET", "/api/projects", { key: null })).status, 401);
  assert.equal((await call("GET", "/api/projects", { key: KEY + "x" })).status, 401);
  assert.equal((await call("PUT", "/api/projects/abc", { key: "wrong", body: { name: "abc", data: {} } })).status, 401);
  assert.equal((await call("DELETE", "/api/projects/abc?version=1", { key: null })).status, 401);
  assert.equal((await call("GET", "/api/projects")).status, 200);
  assert.equal((await call("GET", "/api/nope")).status, 404);
});

test("admin key comparison is exact (hash-then-compare, constant time)", async () => {
  assert.equal(await keyMatches("abc", "abc"), true);
  assert.equal(await keyMatches("abc", "abd"), false);
  assert.equal(await keyMatches("abc", "abcd"), false);
  assert.equal(await keyMatches("", "abc"), false);
  assert.equal(await keyMatches("abc", ""), false);
});

test("save creates version 1, a revising save makes version 2, a stale save is refused naming the newer version", async () => {
  const box = fakeDropbox();
  const id = projectId("ZZ Synthetic Test");
  assert.equal(id, "zz-synthetic-test");
  let r = await call("PUT", `/api/projects/${id}`, { box, body: { name: "ZZ Synthetic Test", baseVersion: null, data: synthetic(1) } });
  assert.equal(r.status, 200);
  let j = await r.json();
  assert.equal(j.project.version, 1);
  assert.equal(j.path, "/APPS DATABASE/AMORTIZATION CALCULATOR/projects/zz-synthetic-test.json");
  assert.ok(box.files.has("/apps database/amortization calculator/history/zz-synthetic-test/v000001.json"));
  r = await call("PUT", `/api/projects/${id}`, { box, body: { name: "ZZ Synthetic Test", baseVersion: 1, data: synthetic(2), savedBy: "agent" } });
  j = await r.json();
  assert.equal(j.project.version, 2);
  assert.equal(j.project.savedBy, "agent");
  r = await call("PUT", `/api/projects/${id}`, { box, body: { name: "ZZ Synthetic Test", baseVersion: 1, data: synthetic(3) } });
  assert.equal(r.status, 409);
  j = await r.json();
  assert.equal(j.currentVersion, 2);
  assert.match(j.error, /version 2/);
  r = await call("PUT", `/api/projects/${id}`, { box, body: { name: "ZZ Synthetic Test", baseVersion: null, data: synthetic(3) } });
  assert.equal(r.status, 409, "a new save over an existing name is refused");
  // load current and an older version
  j = await (await call("GET", `/api/projects/${id}`, { box })).json();
  assert.equal(j.project.version, 2);
  assert.equal(j.project.data.inputs.interestRate, 7);
  j = await (await call("GET", `/api/projects/${id}?version=1`, { box })).json();
  assert.equal(j.project.version, 1);
  assert.equal(j.current, false);
  // list
  j = await (await call("GET", "/api/projects", { box })).json();
  assert.deepEqual(j.projects.map((p) => [p.id, p.version, p.name]), [[id, 2, "ZZ Synthetic Test"]]);
  // delete needs the current version
  assert.equal((await call("DELETE", `/api/projects/${id}?version=1`, { box })).status, 409);
  assert.equal((await call("DELETE", `/api/projects/${id}`, { box })).status, 409);
  r = await call("DELETE", `/api/projects/${id}?version=2`, { box });
  assert.equal(r.status, 200);
  assert.equal(box.files.size, 0, "project and its history are gone");
  assert.equal((await call("GET", `/api/projects/${id}`, { box })).status, 404);
});

test("input validation: bad ids, mismatched names, non-object data, oversize bodies", async () => {
  assert.equal((await call("GET", "/api/projects/..%2Fsecrets")).status, 400);
  assert.equal((await call("PUT", "/api/projects/abc", { body: { name: "Other", data: {} } })).status, 400);
  assert.equal((await call("PUT", "/api/projects/abc", { body: { name: "abc", data: [] } })).status, 400);
  const big = { name: "abc", data: { blob: "x".repeat(2 * 1024 * 1024 + 10) } };
  assert.equal((await call("PUT", "/api/projects/abc", { body: big })).status, 413);
});

test("Dropbox calls use the refresh-token grant and the app's own data root", async () => {
  resetTokenCache();
  const box = fakeDropbox();
  await call("PUT", "/api/projects/root-check", { box, body: { name: "root check", baseVersion: null, data: synthetic(1) } });
  assert.ok(box.calls.some((c) => c.route === "oauth2/token"));
  for (const f of box.files.values()) assert.ok(f.path.startsWith("/APPS DATABASE/AMORTIZATION CALCULATOR/"), f.path);
  // optional team-space header is sent only when DROPBOX_PATH_ROOT is configured
  assert.ok(box.calls.filter((c) => c.route.startsWith("files/")).every((c) => !c.headers["Dropbox-API-Path-Root"]));
  const box2 = fakeDropbox();
  const pr = JSON.stringify({ ".tag": "root", root: "1234" });
  await call("GET", "/api/projects", { box: box2, env: { ...SYNTHETIC_ENV, DROPBOX_PATH_ROOT: pr } });
  assert.ok(box2.calls.filter((c) => c.route.startsWith("files/")).every((c) => c.headers["Dropbox-API-Path-Root"] === pr));
});

test("wrangler.toml: workers.dev only, ASSETS only, no host stores, Worker first only on /api/*", async () => {
  const toml = await readFile(path.join(root, "wrangler.toml"), "utf8");
  assert.match(toml, /^workers_dev = true$/m);
  assert.match(toml, /^preview_urls = false$/m);
  assert.match(toml, /^binding = "ASSETS"$/m);
  assert.match(toml, /^directory = "\.\/_site"/m);
  assert.match(toml, /^run_worker_first = \["\/api\/\*"\]$/m);
  assert.doesNotMatch(toml, /kv_namespaces|d1_databases|r2_buckets|durable_objects|^routes?\s*=|custom_domain/m);
});

test("no proxy: nothing outside /api/* reaches Worker code paths", async () => {
  // rate-fetching.js calls FRED directly from the browser (as on Netlify); there is no /proxy/*.
  const r = await call("GET", "/proxy/fred/series/observations");
  assert.equal(await r.text(), "asset:/proxy/fred/series/observations");
});

test("no host-store code anywhere in the Worker or the page", async () => {
  const files = ["cloudflare/worker.mjs", "cloudflare/projects.mjs", "cloudflare/dropbox.mjs", "js/projects.js", "js/agent-bridge.js"];
  for (const f of files) {
    const src = await readFile(path.join(root, f), "utf8");
    assert.doesNotMatch(src, /getStore|@netlify\/blobs|env\.\w*KV|\.idFromName|env\.DB\b|R2Bucket|caches\.default/, f);
  }
  assert.ok(!existsSync(path.join(root, "netlify")));
});
