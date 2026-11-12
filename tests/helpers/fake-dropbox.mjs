// In-memory stand-in for the Dropbox HTTP API (synthetic data only). Implements just what
// cloudflare/dropbox.mjs uses: oauth2/token, files/download, files/upload, files/list_folder,
// files/delete_v2. Upload honours mode add / update(rev) with strict conflicts like Dropbox.
export function fakeDropbox() {
  const files = new Map(); // lower-case path -> { path, text, rev, modified }
  const calls = [];
  let revN = 0;
  const reply = (status, body, headers = {}) => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
  const notFound = (summary = "path/not_found/") => reply(409, { error_summary: summary, error: { ".tag": "path", path: { ".tag": "not_found" } } });
  async function fetcher(url, init = {}) {
    const u = String(url);
    const route = u.replace(/^https:\/\/(api|content)\.dropboxapi\.com\/(2\/)?/, "");
    calls.push({ route, headers: init.headers || {} });
    if (route === "oauth2/token") {
      const p = new URLSearchParams(String(init.body));
      if (p.get("grant_type") !== "refresh_token" || p.get("refresh_token") !== "synthetic-refresh") return reply(400, { error: "invalid_grant" });
      return reply(200, { access_token: "synthetic-access", expires_in: 14400, token_type: "bearer" });
    }
    if (init.headers?.Authorization !== "Bearer synthetic-access") return reply(401, { error_summary: "invalid_access_token/" });
    const arg = init.headers["Dropbox-API-Arg"] ? JSON.parse(init.headers["Dropbox-API-Arg"]) : JSON.parse(init.body || "{}");
    const key = (p) => String(p).toLowerCase();
    if (route === "files/download") {
      const f = files.get(key(arg.path));
      if (!f) return notFound("path/not_found/");
      return new Response(f.text, { status: 200, headers: { "dropbox-api-result": JSON.stringify({ name: f.path.split("/").pop(), rev: f.rev, size: f.text.length }) } });
    }
    if (route === "files/upload") {
      const existing = files.get(key(arg.path));
      const mode = arg.mode;
      if (mode === "add" && existing) return reply(409, { error_summary: "path/conflict/file/" });
      if (mode && mode[".tag"] === "update" && (!existing || existing.rev !== mode.update)) return reply(409, { error_summary: "path/conflict/file/" });
      const text = new TextDecoder().decode(init.body);
      const rev = `r${(revN += 1).toString(16).padStart(9, "0")}`;
      files.set(key(arg.path), { path: arg.path, text, rev, modified: new Date().toISOString() });
      return reply(200, { name: arg.path.split("/").pop(), path_display: arg.path, rev, size: text.length, server_modified: new Date().toISOString() });
    }
    if (route === "files/list_folder") {
      const prefix = key(arg.path) + "/";
      const entries = [...files.values()].filter((f) => key(f.path).startsWith(prefix) && !key(f.path).slice(prefix.length).includes("/"))
        .map((f) => ({ ".tag": "file", name: f.path.split("/").pop(), path_display: f.path, size: f.text.length, server_modified: f.modified, rev: f.rev }));
      const anyUnder = [...files.keys()].some((k) => k.startsWith(prefix));
      if (!anyUnder) return notFound("path/not_found/");
      return reply(200, { entries, has_more: false, cursor: "c" });
    }
    if (route === "files/delete_v2") {
      const k = key(arg.path);
      let removed = 0;
      for (const p of [...files.keys()]) if (p === k || p.startsWith(k + "/")) { files.delete(p); removed += 1; }
      return removed ? reply(200, { metadata: { path_display: arg.path } }) : notFound("path_lookup/not_found/");
    }
    return reply(400, { error_summary: `unsupported route ${route}` });
  }
  return { fetch: fetcher, files, calls };
}

export const SYNTHETIC_ENV = Object.freeze({
  DROPBOX_DATA_ROOT: "/APPS DATABASE/AMORTIZATION CALCULATOR",
  DROPBOX_APP_KEY: "synthetic-app-key",
  DROPBOX_APP_SECRET: "synthetic-app-secret",
  DROPBOX_REFRESH_TOKEN: "synthetic-refresh",
  AMORT_ADMIN_KEY: "synthetic-admin-key-0123456789",
});
