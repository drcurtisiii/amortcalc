// In-tab AI bridge tests in a real Chrome (synthetic data only): schema, status, set + run,
// stale revision refused, confirm-required destructive actions with no popups, the AI button's
// copied line and notice, project saves (three in a row + a refused conflict from a second tab).
// Skips when Chrome / playwright-core is not available.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "./helpers/local-server.mjs";
import { SYNTHETIC_ENV } from "./helpers/fake-dropbox.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = process.env.CHROME_PATH || ["/usr/bin/google-chrome", "/usr/bin/chromium", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find((p) => existsSync(p));
let chromium = null;
try { ({ chromium } = await import("playwright-core")); } catch { /* optional dev dependency */ }
const skip = !chromium || !CHROME ? "needs playwright-core and Chrome" : false;

test("in-tab bridge", { skip, timeout: 120000 }, async (t) => {
  execFileSync(process.execPath, [path.join(root, "tools/stage-site.mjs")], { stdio: "ignore" });
  const server = await startServer(path.join(root, "_site"));
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: server.url });
  const page = await context.newPage();
  const consoleErrors = [];
  const dialogs = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("dialog", (d) => { dialogs.push(d.message()); d.dismiss(); });
  const exec = (action, input = {}) => page.evaluate(([a, i]) => window.AmortizationAgent.execute({ action: a, input: i }), [action, input]);
  try {
    await page.goto(server.url + "/", { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.AmortizationAgent && document.getElementById("loanAmount"));
    await page.waitForTimeout(300);

    await t.test("schema describes every action with Session rules first", async () => {
      const r = await exec("schema");
      assert.equal(r.ok, true);
      for (const a of ["amortization_status", "get_inputs", "set_inputs", "switch_tab", "get_schedule", "download_pdf", "save_project", "load_project", "delete_project"]) assert.ok(r.result.actions.includes(a), a);
      assert.match(r.result.guidance[0], /^Session rules:/);
      assert.equal(r.result.specs.delete_project.destructive, true);
    });

    await t.test("live getters are not frozen copies", async () => {
      const before = await page.evaluate(() => window.AmortizationAgent.revision);
      await page.fill("#loanAmount", "123456");
      const after = await page.evaluate(() => window.AmortizationAgent.revision);
      assert.ok(after > before, "a human edit moves the revision");
      assert.equal(await page.evaluate(() => Object.getOwnPropertyDescriptor(window.AmortizationAgent, "revision").get !== undefined), true);
    });

    let status;
    await t.test("status, then set_inputs updates the same tab and recalculates", async () => {
      status = (await exec("amortization_status")).result;
      assert.equal(status.loanType, "standard");
      const r = await exec("set_inputs", { revision: status.revision, values: { loanAmount: 200000, interestRate: 6, loanTermYears: 30, loanTermMonths: 0 } });
      assert.equal(r.ok, true, r.error);
      assert.equal(r.result.results.totals.monthlyPayment, 1199.1);
      assert.equal(r.result.results.scheduleRows, 360);
      assert.equal(await page.inputValue("#loanAmount"), "200,000");
      const rows = (await exec("get_schedule", { limit: 2 })).result.rows;
      assert.equal(rows[0].month, 1);
      assert.equal(rows[0].interest, 1000);
    });

    await t.test("stale revision and read-only fields are refused", async () => {
      const r = await exec("set_inputs", { revision: status.revision, values: { interestRate: 7 } });
      assert.equal(r.ok, false);
      assert.equal(r.code, "stale_revision");
      const none = await exec("set_inputs", { values: { interestRate: 7 } });
      assert.equal(none.code, "revision_required");
      const rev = (await exec("amortization_status")).result.revision;
      const bad = await exec("set_inputs", { revision: rev, values: { noSuchField: 1 } });
      assert.equal(bad.code, "unknown_field");
    });

    await t.test("switch_tab and per-tab inputs", async () => {
      const rev = (await exec("amortization_status")).result.revision;
      const r = await exec("switch_tab", { revision: rev, loanType: "balloon" });
      assert.equal(r.ok, true, r.error);
      assert.equal(r.result.loanType, "balloon");
      assert.ok(r.result.fields.some((f) => f.id === "balloonTermYears"));
      const rev2 = (await exec("amortization_status")).result.revision;
      assert.equal((await exec("switch_tab", { revision: rev2, loanType: "standard" })).ok, true);
    });

    await t.test("promissory note text comes from the app's generator", async () => {
      const r = await exec("get_promissory_note", { noteType: "standard" });
      assert.equal(r.ok, true);
      assert.match(r.result.text, /PROMISSORY NOTE/i);
    });

    await t.test("destructive actions need confirm:true and never show a popup", async () => {
      const rev = (await exec("amortization_status")).result.revision;
      const del = await exec("delete_project", { id: "zz-synthetic-test", version: 1 });
      assert.equal(del.code, "confirm_required");
      const imp = await exec("import_project_json", { revision: rev, data: { inputs: {} } });
      assert.equal(imp.code, "confirm_required");
      assert.deepEqual(dialogs, []);
      const native = await page.evaluate(() => window.confirm.toString().includes("[native code]") && window.alert.toString().includes("[native code]"));
      assert.equal(native, true, "native dialogs are restored after agent commands");
    });

    await t.test("project actions without a key are refused (401), no admin escalation for AI", async () => {
      const rev = (await exec("amortization_status")).result.revision;
      const r = await exec("save_project", { revision: rev, name: "zz-synthetic-test" });
      assert.equal(r.ok, false);
      assert.equal(r.code, "unauthorized");
    });

    await t.test("three saves in a row (agent, user, agent) each revise; a second tab's stale save is refused", async () => {
      await page.evaluate((k) => window.AmortProjects.setAdminKey(k), SYNTHETIC_ENV.AMORT_ADMIN_KEY);
      let rev = (await exec("amortization_status")).result.revision;
      let r = await exec("save_project", { revision: rev, name: "zz-synthetic-test" });
      assert.equal(r.ok, true, r.error);
      assert.equal(r.result.project.version, 1);
      // a person's save through the same routine (Projects panel button)
      await page.click("#projectsBtn");
      await page.fill("#projectNameInput", "zz-synthetic-test");
      await page.click("#projectSaveBtn");
      await page.waitForFunction(() => window.AmortizationAgent.version === 2);
      await page.keyboard.press("Escape");
      rev = (await exec("amortization_status")).result.revision;
      r = await exec("save_project", { revision: rev });
      assert.equal(r.result.project.version, 3);
      assert.equal(r.result.revisedVersion, 2);
      // second tab loads v3, first tab saves v4, second tab's save is refused naming v4
      const page2 = await context.newPage();
      await page2.goto(server.url + "/", { waitUntil: "networkidle" });
      await page2.waitForFunction(() => window.AmortizationAgent && document.getElementById("loanAmount"));
      const exec2 = (a, i = {}) => page2.evaluate(([x, y]) => window.AmortizationAgent.execute({ action: x, input: y }), [a, i]);
      let rev2 = (await exec2("amortization_status")).result.revision;
      const loaded = await exec2("load_project", { revision: rev2, id: "zz-synthetic-test", confirm: true });
      assert.equal(loaded.ok, true, loaded.error);
      assert.equal(loaded.result.project.version, 3);
      rev = (await exec("amortization_status")).result.revision;
      assert.equal((await exec("save_project", { revision: rev })).result.project.version, 4);
      rev2 = (await exec2("amortization_status")).result.revision;
      const conflict = await exec2("save_project", { revision: rev2 });
      assert.equal(conflict.ok, false);
      assert.equal(conflict.code, "conflict");
      assert.equal(conflict.currentVersion, 4);
      assert.match(conflict.error, /version 4/);
      const list = (await exec("list_projects")).result.projects;
      assert.deepEqual(list.map((p) => [p.id, p.version]), [["zz-synthetic-test", 4]]);
      const gone = await exec("delete_project", { id: "zz-synthetic-test", version: 4, confirm: true });
      assert.equal(gone.ok, true, gone.error);
      assert.equal(server.box.files.size, 0);
      await page2.close();
    });

    await t.test("downloads go through the browser", async () => {
      const [dl] = await Promise.all([page.waitForEvent("download"), exec("download_pdf")]);
      assert.match(dl.suggestedFilename(), /\.pdf$/);
      const [x] = await Promise.all([page.waitForEvent("download"), exec("export_project_file")]);
      assert.match(x.suggestedFilename(), /\.json$/);
    });

    await t.test("AI button copies the one-line prompt and shows a ~3 s status notice", async () => {
      await page.click("#aiAgentButton");
      const clip = await page.evaluate(() => navigator.clipboard.readText());
      assert.equal(clip, `Amortization Calculator (my app is open at ${server.url}/ in this browser; drive it in that tab through window.AmortizationAgent.execute({action, input}); before doing anything, read and follow ${server.url}/.well-known/agent.json)`);
      assert.equal(await page.getAttribute("#aiAgentNotice", "role"), "status");
      assert.match(await page.textContent("#aiAgentNotice"), /Prompt copied — paste this into your AI agent/);
      assert.equal(await page.isVisible("#aiAgentFallback"), false);
      await page.waitForTimeout(3300);
      assert.equal(await page.isHidden("#aiAgentNotice"), true);
    });

    await t.test("clipboard refused → accessible fallback dialog; Escape closes it", async () => {
      await page.evaluate(() => { Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) }, configurable: true }); });
      await page.click("#aiAgentButton");
      await page.waitForSelector("#aiAgentFallback:not([hidden])");
      assert.equal(await page.getAttribute("#aiAgentFallback [role=dialog]", "aria-modal"), "true");
      assert.match(await page.inputValue("#aiAgentFallbackText"), /window\.AmortizationAgent\.execute/);
      await page.keyboard.press("Escape");
      assert.equal(await page.isHidden("#aiAgentFallback"), true);
    });

    await t.test("manifests are served", async () => {
      const j = await (await fetch(server.url + "/.well-known/agent.json")).json();
      assert.match(j.guidance[0], /^Session rules:/);
      assert.equal((await fetch(server.url + "/llms.txt")).status, 200);
      assert.equal((await fetch(server.url + "/agent.md")).status, 200);
      assert.equal((await fetch(server.url + "/no-such-page")).status, 404);
    });

    await t.test("no console errors and no native dialogs", async () => {
      // The deliberate no-key request above is logged by Chrome as a 401 network error; nothing else may be.
      assert.deepEqual(consoleErrors.filter((e) => !/status of 401/.test(e)), []);
      assert.deepEqual(dialogs, []);
    });
  } finally {
    await browser.close();
    await server.close();
  }
});
