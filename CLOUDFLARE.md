# Amortization Calculator on Cloudflare (free plan)

Live: https://amortization-calculator.curtis-bots.workers.dev (Worker `amortization-calculator`,
account curtis-bots, workers.dev only, no custom domain). Netlify was not touched.

## Kind and shape

Kind **C**: the calculator is static files (`[assets]` in `_site/`), plus a small Worker that runs
only for `/api/*` (`run_worker_first = ["/api/*"]`) to save named projects in Dropbox. There is no
proxy: the app's FRED rate calls go straight from the browser exactly as on Netlify (see *Known
issues*). Bindings: `ASSETS` and the `DROPBOX_DATA_ROOT` var only. No KV, D1, R2, Durable Objects
or cache of app data.

| Netlify | Cloudflare |
| --- | --- |
| `npm run build` → `dist/` (copied the whole folder) | `node tools/stage-site.mjs` → `_site/` (allow-list only) |
| `netlify.toml` headers (CSP etc.) | `_headers` (same CSP; `frame-ancestors 'self'`, X-Frame-Options SAMEORIGIN so a same-origin host page may embed it) |
| `_redirects` `/* /index.html 200` | dropped: the app has no client routes; unknown paths now return `404.html` with status 404 |
| — | `/api/health`, `/api/projects[/<id>]` (`cloudflare/worker.mjs`, `cloudflare/projects.mjs`, `cloudflare/dropbox.mjs`) |

## What changed in the app

- `js/agent-bridge.js`: `window.AmortizationAgent` (`execute`, `schema`, `state`, live getters
  `revision`, `loanType`, `project`, `version`), the AI button (`#aiAgentButton`, badge
  `#aiAgentStatus`, notice `#aiAgentNotice`, fallback dialog `#aiAgentFallback`).
- `js/projects.js`: Projects panel (`#projectsBtn`), the one shared save routine, admin key
  remembered in localStorage, localStorage autosave + "Restore autosave".
- `js/pdf-generator.js`: Save/Load split into `buildCalculationData()` / `applyCalculationData()` so
  the buttons, project saves and the bridge share one code path (behaviour unchanged).
- `index.html`: Projects and AI buttons, `service-desc` link, two script tags; image paths
  lower-cased (`clf-shield-brass-final.png`, `bluei.png`) because Cloudflare paths are case-sensitive.
- Published `/.well-known/agent.json` (first guidance entry "Session rules"), `/llms.txt`,
  `/agent.md`, `Link: </.well-known/agent.json>; rel="service-desc"` on `/`.

## Project saves

`/APPS DATABASE/AMORTIZATION CALCULATOR/projects/<id>.json` (current version) and
`history/<id>/v000001.json …` (every version). `<id>` is the project name slugged. Each save names
the version it revises; a save from another tab in between is refused (409) naming the newer
version, and Dropbox's rev check closes the race. All project routes need the admin key
(`X-Amort-Admin-Key`), compared in constant time; missing secrets → 503, wrong key → 401. The AI
bridge uses the same routine and the same key the person entered — no extra rights.

Dropbox: refresh-token grant inside the Worker (as Land Workspace). `DROPBOX_PATH_ROOT` is supported
but left unset on purpose: `/APPS DATABASE` lives in the authorized member's home namespace (where
every other app's folder is); with the team-root header that path does not exist.

## Secrets (names only; values are in Ray's keys file)

`DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REFRESH_TOKEN`, `AMORT_ADMIN_KEY`. To change one:
`npx --yes wrangler@4.157.0 secret put NAME`.

## Commands

```bash
npm test                     # node --test tests/*.test.mjs (bridge test needs Chrome + `npm i -D playwright-core`)
npm run dry-run:cf           # stage + wrangler deploy --dry-run: bindings must be ASSETS (+ vars) only
npm run deploy:cf            # stage + deploy
```

## Known issues (not changed: hosting move only)

- Live index rates: `rate-fetching.js` / `arm-loan.js` call FRED with `api_key=demo`, which FRED
  rejects (400) and which has no CORS, so the ARM tab always used its fallback rates on Netlify
  too. Fixing it needs a FRED API key (a new secret kind, Ray's call) and a `/proxy/fred/` route.
- Browser storage does not follow from the Netlify address: re-enter the admin key once.
