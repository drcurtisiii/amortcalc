// Server-only Dropbox client (Worker). Mirrors Land Workspace's netlify/functions/lib/dropbox.mjs:
// refresh-token grant, cached short-lived access token, optional Dropbox-API-Path-Root header,
// strict-conflict uploads guarded by the file's rev, and content-hash verification.
// Credentials come only from Worker secrets; nothing here is ever sent to the browser.
// Uses Web Crypto only, so the Worker needs no nodejs_compat flag.

export const BLOCK = 4 * 1024 * 1024;

export class AppError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    Object.assign(this, extra);
  }
}

export class DropboxError extends AppError {
  constructor(status, code) {
    super(
      status === 409 ? 409 : status === 429 ? 503 : 502,
      status === 409 ? "Dropbox write conflict. Reload and retry." : status === 401 || status === 403 ? "Dropbox authorization failed. Check the server connection and permissions." : "Dropbox is temporarily unavailable. Please retry.",
    );
    this.code = code;
  }
}
export const isMissing = (e) => e instanceof DropboxError && String(e.code).includes("not_found");
export const isConflict = (e) => e instanceof DropboxError && String(e.code).includes("conflict");

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
// Dropbox content hash: SHA-256 of the concatenated SHA-256 of each 4 MiB block.
export async function contentHash(bytes) {
  const parts = [];
  for (let i = 0; i < bytes.length; i += BLOCK) parts.push(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.subarray(i, i + BLOCK))));
  const all = new Uint8Array(parts.length * 32);
  parts.forEach((p, i) => all.set(p, i * 32));
  return hex(await crypto.subtle.digest("SHA-256", all));
}
const asciiJSON = (value) => JSON.stringify(value).replace(/[\u007f-\uffff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));

// One token per Worker isolate, shared across requests (memory only, never stored).
const tokenCache = { token: "", expires: 0, key: "" };
export function resetTokenCache() { tokenCache.token = ""; tokenCache.expires = 0; tokenCache.key = ""; }

export class Dropbox {
  constructor(env, fetcher = fetch) {
    this.env = env;
    // Never call fetch as a method: Workers throws "Illegal invocation" when `this` is not globalThis.
    this.fetcher = (...args) => fetcher(...args);
    this.root = String(env.DROPBOX_DATA_ROOT || "").replace(/\/$/, "");
    if (!this.root.startsWith("/") || this.root === "/" || this.root.split("/").some((x) => x === "." || x === "..") || /[\x00-\x1f\\]/.test(this.root)) {
      throw new AppError(503, "Configure a dedicated DROPBOX_DATA_ROOT for this app.");
    }
    // Optional team-space header value, e.g. {".tag":"root","root":"<namespace id>"}. Unset = the
    // authorized member's home namespace, where /APPS DATABASE lives for every other app.
    this.pathRoot = String(env.DROPBOX_PATH_ROOT || "").trim();
  }

  static configured(env) {
    return Boolean(env.DROPBOX_APP_KEY && env.DROPBOX_APP_SECRET && env.DROPBOX_REFRESH_TOKEN && env.DROPBOX_DATA_ROOT);
  }

  path(relative) {
    if (!relative || relative.startsWith("/") || /[\x00-\x1f\\]/.test(relative) || relative.split("/").some((x) => !x || x === ".." || x === ".")) {
      throw new AppError(400, "Invalid storage path.");
    }
    return `${this.root}/${relative}`;
  }

  async accessToken(force = false) {
    const { DROPBOX_APP_KEY: client_id, DROPBOX_APP_SECRET: client_secret, DROPBOX_REFRESH_TOKEN: refresh_token } = this.env;
    if (!client_id || !client_secret || !refresh_token) throw new AppError(503, "Configure the server Dropbox app key, app secret, and refresh token.");
    const cacheKey = `${client_id}:${refresh_token.length}`;
    if (!force && tokenCache.token && tokenCache.key === cacheKey && Date.now() < tokenCache.expires) return tokenCache.token;
    const response = await this.fetcher("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      body: new URLSearchParams({ grant_type: "refresh_token", client_id, client_secret, refresh_token }),
    });
    if (!response.ok) throw new AppError(503, "Dropbox token refresh failed. Reconnect the server Dropbox app.");
    const result = await response.json();
    if (!result.access_token || !Number.isFinite(result.expires_in)) throw new AppError(502, "Invalid Dropbox token response.");
    tokenCache.token = result.access_token;
    tokenCache.key = cacheKey;
    tokenCache.expires = Date.now() + Math.max(0, result.expires_in - 120) * 1000;
    return tokenCache.token;
  }

  async call(route, args, data, download = false) {
    const content = data !== undefined || download;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const token = await this.accessToken();
      const headers = { Authorization: `Bearer ${token}` };
      if (this.pathRoot) headers["Dropbox-API-Path-Root"] = this.pathRoot;
      if (content) { headers["Dropbox-API-Arg"] = asciiJSON(args); if (!download) headers["Content-Type"] = "application/octet-stream"; }
      else headers["Content-Type"] = "application/json";
      let response;
      try {
        response = await this.fetcher(`https://${content ? "content" : "api"}.dropboxapi.com/2/${route}`, {
          method: "POST", headers, body: content ? data : JSON.stringify(args),
        });
      } catch {
        throw new AppError(503, "Dropbox request interrupted. Please retry.");
      }
      if (response.ok) return response;
      if (response.status === 401 && attempt === 0) { tokenCache.token = ""; tokenCache.expires = 0; continue; }
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await new Promise((r) => setTimeout(r, Math.min(1500, Number(response.headers.get("retry-after") || 1) * 1000)));
        continue;
      }
      const error = await response.json().catch(() => ({}));
      if (String(error.error_summary || "").includes("too_many_write_operations") && attempt < 2) { await new Promise((r) => setTimeout(r, 500 * (attempt + 1))); continue; }
      throw new DropboxError(response.status, error.error_summary || "request_failed");
    }
    throw new AppError(503, "Dropbox request failed.");
  }

  async download(relative) {
    const res = await this.call("files/download", { path: this.path(relative) }, undefined, true);
    return { text: await res.text(), meta: JSON.parse(res.headers.get("dropbox-api-result") || "{}") };
  }
  async read(relative) {
    try { const { text, meta } = await this.download(relative); return { value: JSON.parse(text), rev: meta.rev, meta }; }
    catch (e) { if (isMissing(e)) return null; throw e; }
  }
  async upload(relative, bytes, rev) {
    const args = { path: this.path(relative), mode: rev ? { ".tag": "update", update: rev } : "add", autorename: false, strict_conflict: true, mute: true, content_hash: await contentHash(bytes) };
    return (await this.call("files/upload", args, bytes)).json();
  }
  async write(relative, value, rev) { return this.upload(relative, new TextEncoder().encode(JSON.stringify(value, null, 2)), rev); }
  async list(relative) {
    let page;
    try { page = await (await this.call("files/list_folder", { path: this.path(relative), limit: 2000 })).json(); }
    catch (e) { if (isMissing(e)) return []; throw e; }
    const entries = [...page.entries];
    while (page.has_more) { page = await (await this.call("files/list_folder/continue", { cursor: page.cursor })).json(); entries.push(...page.entries); }
    return entries;
  }
  async remove(relative) { try { await this.call("files/delete_v2", { path: this.path(relative) }); return true; } catch (e) { if (isMissing(e)) return false; throw e; } }
}
