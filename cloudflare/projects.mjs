// /api/* for the Amortization Calculator: named projects saved as JSON files in Dropbox
// (DROPBOX_DATA_ROOT, "/APPS DATABASE/AMORTIZATION CALCULATOR"). Nothing is stored on Cloudflare.
//
//   GET    /api/health                 public: { ok, storage: "dropbox", configured }
//   GET    /api/projects               list saved projects            (admin key)
//   GET    /api/projects/<id>          load the current version       (admin key)
//   GET    /api/projects/<id>?version=N  load an older saved version  (admin key)
//   PUT    /api/projects/<id>          save { name, baseVersion, data, savedBy } (admin key)
//   DELETE /api/projects/<id>?version=N  delete (N must be the current version) (admin key)
//
// Files: projects/<id>.json (current) and history/<id>/v000001.json ... (every saved version).
// A save names the version it revises (baseVersion). If another tab saved first, the save is
// refused with 409 and the newer version is named; Dropbox's rev check closes the race window.
// Fails closed: 503 when AMORT_ADMIN_KEY or the Dropbox secrets are missing, 401 on a wrong key.
import { AppError, Dropbox, isConflict } from "./dropbox.mjs";

export const FORMAT = "amortization-calculator-project";
const MAX_BODY = 2 * 1024 * 1024;
const LIST_READ_LIMIT = 40; // stays under the free plan's 50 subrequests per request

const json = (status, body, extra = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra },
});

export function projectId(name) {
  const id = String(name ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/g, "");
  return id;
}
const validId = (id) => /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(id);
const historyFile = (id, version) => `history/${id}/v${String(version).padStart(6, "0")}.json`;

async function sha256(text) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text))));
}
// Constant-time comparison: both sides are hashed to 32 bytes first, so neither the length nor
// the position of the first difference leaks through timing.
export async function keyMatches(supplied, expected) {
  if (!supplied || !expected) return false;
  const [a, b] = await Promise.all([sha256(supplied), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}
function suppliedKey(request) {
  const header = request.headers.get("x-amort-admin-key") || request.headers.get("authorization") || "";
  return header.replace(/^Bearer\s+/i, "").trim();
}

async function requireAdmin(request, env) {
  if (!env.AMORT_ADMIN_KEY || !Dropbox.configured(env)) {
    throw new AppError(503, "Project saves are not configured on this server yet (missing AMORT_ADMIN_KEY or Dropbox secrets). The calculator still works; use Save/Load files.");
  }
  if (!(await keyMatches(suppliedKey(request), env.AMORT_ADMIN_KEY))) throw new AppError(401, "Administrator key required for project saves.");
}

function summary(record, meta = {}) {
  const d = record?.data || {};
  return {
    id: record.id, name: record.name, version: record.version, savedAt: record.savedAt, savedBy: record.savedBy || null,
    loanType: d.loanType || null, caseName: d.caseName || "", size: meta.size ?? null,
  };
}

async function readBody(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY) throw new AppError(413, "Project is too large (2 MB limit).");
  const text = await request.text();
  if (text.length > MAX_BODY) throw new AppError(413, "Project is too large (2 MB limit).");
  try { return JSON.parse(text); } catch { throw new AppError(400, "Body must be JSON."); }
}

export async function projectsHandler(request, env, deps = {}) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  try {
    if (path === "/api/health") {
      if (request.method !== "GET" && request.method !== "HEAD") return json(405, { error: "Method not allowed." }, { Allow: "GET, HEAD" });
      return json(200, { ok: true, app: "amortization-calculator", storage: "dropbox", configured: Boolean(env.AMORT_ADMIN_KEY) && Dropbox.configured(env) });
    }
    const match = path.match(/^\/api\/projects(?:\/([^/]+))?$/);
    if (!match) return json(404, { error: "Not found." });
    await requireAdmin(request, env);
    const box = new Dropbox(env, deps.fetch || fetch);
    const id = match[1] ? decodeURIComponent(match[1]) : null;
    if (id !== null && !validId(id)) throw new AppError(400, "Invalid project id.");

    if (!id) {
      if (request.method !== "GET") return json(405, { error: "Method not allowed." }, { Allow: "GET" });
      const entries = (await box.list("projects")).filter((e) => e[".tag"] === "file" && e.name.endsWith(".json"));
      const items = entries.map((e) => ({ id: e.name.slice(0, -5), modified: e.server_modified, size: e.size }));
      const truncated = items.length > LIST_READ_LIMIT;
      const detailed = await Promise.all(items.slice(0, LIST_READ_LIMIT).map(async (item) => {
        try { const got = await box.read(`projects/${item.id}.json`); return got ? summary(got.value, item) : item; } catch { return item; }
      }));
      const projects = [...detailed, ...items.slice(LIST_READ_LIMIT)].sort((a, b) => String(b.savedAt || b.modified).localeCompare(String(a.savedAt || a.modified)));
      return json(200, { projects, truncated, root: env.DROPBOX_DATA_ROOT });
    }

    const file = `projects/${id}.json`;
    if (request.method === "GET") {
      const wanted = url.searchParams.get("version");
      const got = await box.read(wanted ? historyFile(id, Number(wanted)) : file);
      if (!got) return json(404, { error: wanted ? `Version ${wanted} of "${id}" not found.` : `Project "${id}" not found.` });
      return json(200, { project: got.value, current: !wanted });
    }

    if (request.method === "PUT") {
      const body = await readBody(request);
      const name = String(body.name ?? "").trim().slice(0, 120);
      if (!name || projectId(name) !== id) throw new AppError(400, "Project name must match the project id.");
      if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) throw new AppError(400, "Project data must be an object.");
      const base = body.baseVersion === null || body.baseVersion === undefined ? null : Number(body.baseVersion);
      if (base !== null && !Number.isInteger(base)) throw new AppError(400, "baseVersion must be an integer or null.");
      const existing = await box.read(file);
      const currentVersion = existing ? Number(existing.value?.version) || 0 : null;
      if (existing && base !== currentVersion) {
        return json(409, { error: `Conflict: "${existing.value?.name || id}" is already at version ${currentVersion} (saved ${existing.value?.savedAt || "earlier"}${existing.value?.savedBy ? ` by ${existing.value.savedBy}` : ""}). Load it first, or save under a new name.`, currentVersion, savedAt: existing.value?.savedAt || null });
      }
      if (!existing && base !== null) {
        return json(409, { error: `Conflict: "${id}" no longer exists in Dropbox (deleted elsewhere). Save again as a new project.`, currentVersion: null });
      }
      const version = (currentVersion || 0) + 1;
      const record = {
        format: FORMAT, formatVersion: 1, app: "Amortization Calculator", id, name, version,
        previousVersion: currentVersion, savedAt: new Date().toISOString(),
        savedBy: body.savedBy === "agent" ? "agent" : "user", data: body.data,
      };
      let saved;
      try { saved = await box.write(file, record, existing?.rev); }
      catch (e) { if (isConflict(e)) return json(409, { error: `Conflict: "${name}" was saved from another tab a moment ago. Load it and retry.`, currentVersion: null }); throw e; }
      let historySaved = true;
      try { await box.write(historyFile(id, version), record); } catch { historySaved = false; }
      return json(200, { ok: true, project: summary(record, saved), path: `${env.DROPBOX_DATA_ROOT}/${file}`, historySaved });
    }

    if (request.method === "DELETE") {
      const wanted = Number(url.searchParams.get("version"));
      const existing = await box.read(file);
      if (!existing) return json(404, { error: `Project "${id}" not found.` });
      if (!Number.isInteger(wanted) || wanted !== Number(existing.value?.version)) {
        return json(409, { error: `Refused: "${id}" is at version ${existing.value?.version}, not ${url.searchParams.get("version") || "(none given)"}. Read it again before deleting.`, currentVersion: existing.value?.version });
      }
      await box.remove(file);
      await box.remove(`history/${id}`);
      return json(200, { ok: true, deleted: id, version: wanted });
    }
    return json(405, { error: "Method not allowed." }, { Allow: "GET, PUT, DELETE" });
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    if (status === 500) console.error("amortization api error", error?.message || error);
    return json(status, { error: status === 500 ? "Server error." : error.message });
  }
}
