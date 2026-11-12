// Amortization Calculator Worker (Cloudflare free plan; see CLOUDFLARE.md).
// Static files in _site/ are served straight from ASSETS and never run this code
// (wrangler.toml: run_worker_first = ["/api/*"]). The Worker only answers:
//   /api/health, /api/projects[/<id>]  → project saves in Dropbox (cloudflare/projects.mjs)
// There is no proxy, no AI relay and no host storage: the AI bridge lives in the page
// (window.AmortizationAgent), and Dropbox is the only database.
import { projectsHandler } from "./projects.mjs";

const notFound = () => new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export async function handle(request, env, ctx, deps = {}) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === "/api" || path.startsWith("/api/")) return projectsHandler(request, env, deps);
  // Source and config never exist in _site/; refuse them explicitly as well.
  if (/^\/(netlify|tools|cloudflare|tests|\.git|\.wrangler)(\/|$)/i.test(path) || /^\/(wrangler\.toml|package(-lock)?\.json|netlify\.toml|_redirects|\.dev\.vars|\.env)$/i.test(path)) return notFound();
  return env.ASSETS ? env.ASSETS.fetch(request) : notFound();
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await handle(request, env, ctx);
    } catch (error) {
      console.error("amortization worker error", error?.message || error);
      return new Response(JSON.stringify({ error: "Server error." }), { status: 500, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }
  },
};
