# AGENTS.md — amortcalc

## Workflow (how changes ship)
This GitHub repo (`drcurtisiii/amortcalc`) is the single source of truth for the app. Netlify site `amortcalc` (https://amortcalc.netlify.app) builds and publishes automatically from it.

1. **Branch.** Create a branch from `main`, for example `fix/recast-double-count` or `chore/...`. Never commit or push directly to `main`, and never force-push.
2. **Pull request.** Open a PR against `main` that describes what changed and why. Keep each PR small and on one topic.
3. **Deploy Preview.** Netlify builds a Deploy Preview for every PR, at `https://deploy-preview-<PR#>--amortcalc.netlify.app`. Open it, run through the affected calculator tabs, and check the schedule, summary, PDF and Excel output.
4. **Ray merges.** Only Ray merges. **Merging to `main` ships to production**, because Netlify auto-deploys `main` to amortcalc.netlify.app. Agents must not merge, trigger production deploys, or change Netlify settings.

Dropbox (`Ray/Software/HTML (ONLINE)/Amortization App/vx2`) holds a working copy and older snapshot zips. It is not the source of truth, so don't edit it to ship changes.

## Project orientation
- **Static HTML/CSS/vanilla JS app.** There is no framework, bundler or backend. `index.html` loads the scripts in `js/` in a fixed order (utils → field-sync → rate-fetching → loan modules → chart → pdf → promissory-notes → main). Everything is a global function or global state (`currentSchedule`, `currentLoanType`, `window.sharedFieldValues`).
- **Loan modes:** each mode lives in its own file under `js/` (standard, recasting, balloon, arm, desired-payment, payoff-calculator) and follows the pattern `create*Fields()` → `calculate*()` → `generate*AmortizationSchedule()`. The shared payment formula is `calculateMonthlyPayment()` in `js/utils.js`.
- **Third-party libraries** load from CDNs in `index.html`: Chart.js, jsPDF and xlsx-js-style. The npm dependencies (`recharts`, `lucide-react`) are used only by the legacy, unused `amortization-calculator.tsx`.
- **Build:** `npm run build` (configured in `netlify.toml`) runs a one-line Node script. It copies every top-level file and folder that does not start with `.` (and is not `dist`/`node_modules`) into `dist/`, which Netlify publishes. That means **anything you commit at the top level becomes public on the site.** Node 18 is set in `netlify.toml`.
- **Run locally:** open `index.html`, or run `npx serve .`.
- **Tests:** there are none yet. Verify changes by hand in the Deploy Preview.

## Secrets & data
- **No secrets in this repo, ever:** no API keys, tokens, passwords or `.env` files. If a feature needs a key (for example a real FRED API key), store it as a Netlify environment variable and call the API from a Netlify Function, never from browser code.
- Don't commit client data, saved calculation JSON files, or exported PDF/XLSX schedules.
