// Project saves for the Amortization Calculator.
//
// Durable store: Dropbox "/APPS DATABASE/AMORTIZATION CALCULATOR/" through this site's /api/projects
// routes (the Worker holds the Dropbox credentials; the browser never sees them). Those routes need
// the administrator key, which the user types once and this browser remembers in localStorage.
// Browser-only fallbacks that need no key: the existing Save / Load buttons (a JSON file the user
// keeps) and an automatic localStorage copy of the current workspace ("Restore autosave").
// The calculator itself never depends on any of this.
//
// saveProject() is the ONE save routine: the Projects panel and the AI bridge both call
// it, so every save records the version it created as this tab's current version and the next save
// revises that one. A save from another tab in between is refused (409) with the newer version named.
(function () {
    'use strict';

    const KEY_STORAGE = 'amortizationCalculator.adminKey';
    const AUTOSAVE_STORAGE = 'amortizationCalculator.autosave';
    const listeners = new Set();
    let current = null;            // { id, name, version, savedAt } of the project this tab revises
    let lastSavedFingerprint = null;
    let autosaveTimer = null;
    let lastList = null;

    function readJSON(storageKey) {
        try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { return null; }
    }
    function writeJSON(storageKey, value) {
        try { value === null ? localStorage.removeItem(storageKey) : localStorage.setItem(storageKey, JSON.stringify(value)); return true; } catch { return false; }
    }

    function getAdminKey() { try { return localStorage.getItem(KEY_STORAGE) || ''; } catch { return ''; } }
    function setAdminKey(value) {
        try {
            const v = String(value || '').trim();
            v ? localStorage.setItem(KEY_STORAGE, v) : localStorage.removeItem(KEY_STORAGE);
        } catch { /* storage refused: key is not remembered */ }
        notify();
    }

    function projectId(name) {
        return String(name ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
            .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/g, '');
    }

    function snapshot() { return buildCalculationData(); }
    // Fingerprint of the inputs only (the timestamp and recomputed schedule are not edits).
    function fingerprint(data) {
        const d = data || snapshot();
        return JSON.stringify({ t: d.loanType, c: d.caseName, i: d.inputs });
    }
    function isDirty() { return lastSavedFingerprint === null ? null : fingerprint() !== lastSavedFingerprint; }

    async function api(method, path, body) {
        const key = getAdminKey();
        const headers = { Accept: 'application/json' };
        if (key) headers['X-Amort-Admin-Key'] = key;
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        let response;
        try {
            response = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
        } catch (error) {
            throw Object.assign(new Error('Network error reaching the project service. Use Save (file) instead.'), { status: 0 });
        }
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            const message = result.error || `Request failed (${response.status}).`;
            throw Object.assign(new Error(message), { status: response.status, currentVersion: result.currentVersion ?? null, code: response.status === 409 ? 'conflict' : response.status === 401 ? 'unauthorized' : response.status === 503 ? 'not_configured' : 'error' });
        }
        return result;
    }

    function setCurrent(project, data) {
        current = project ? { id: project.id, name: project.name, version: project.version, savedAt: project.savedAt || null } : null;
        lastSavedFingerprint = project ? fingerprint(data) : null;
        notify();
    }

    async function listProjects() {
        const result = await api('GET', '/api/projects');
        lastList = result.projects || [];
        notify();
        return { projects: lastList, truncated: !!result.truncated, root: result.root };
    }

    async function saveProject({ name, savedBy = 'user' } = {}) {
        const projectName = String(name || current?.name || document.getElementById('caseName')?.value || '').trim();
        if (!projectName) throw Object.assign(new Error('Give the project a name.'), { status: 400 });
        const id = projectId(projectName);
        if (!id) throw Object.assign(new Error('The project name needs at least one letter or digit.'), { status: 400 });
        const data = snapshot();
        const baseVersion = current && current.id === id ? current.version : null;
        const result = await api('PUT', `/api/projects/${encodeURIComponent(id)}`, { name: projectName, baseVersion, data, savedBy });
        setCurrent(result.project, data);
        autosaveNow();
        return { saved: true, project: result.project, path: result.path, revisedVersion: baseVersion, historySaved: result.historySaved };
    }

    async function loadProject(id, version) {
        const q = version ? `?version=${encodeURIComponent(version)}` : '';
        const result = await api('GET', `/api/projects/${encodeURIComponent(id)}${q}`);
        const project = result.project;
        if (!project || project.format !== 'amortization-calculator-project' || !project.data) throw new Error('Not an Amortization Calculator project.');
        await applyCalculationData(project.data);
        // Loading an older version makes it the base only if it is still the current one.
        if (result.current) setCurrent(project, snapshot());
        else { setCurrent(null); }
        autosaveNow();
        return { loaded: true, project: { id: project.id, name: project.name, version: project.version, savedAt: project.savedAt }, current: !!result.current };
    }

    async function deleteProject(id, version) {
        const result = await api('DELETE', `/api/projects/${encodeURIComponent(id)}?version=${encodeURIComponent(version)}`);
        if (current && current.id === id) setCurrent(null);
        if (lastList) lastList = lastList.filter((p) => p.id !== id);
        notify();
        return result;
    }

    // ---- browser-only autosave (this browser, this address only) ----
    function autosaveNow() {
        try {
            const data = snapshot();
            writeJSON(AUTOSAVE_STORAGE, { savedAt: new Date().toISOString(), project: current, data });
        } catch { /* fields not built yet */ }
    }
    function scheduleAutosave() {
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(() => { autosaveNow(); notify(); }, 1500);
    }
    function getAutosave() { return readJSON(AUTOSAVE_STORAGE); }
    async function restoreAutosave() {
        const saved = getAutosave();
        if (!saved || !saved.data) throw new Error('No autosaved workspace in this browser.');
        await applyCalculationData(saved.data);
        current = saved.project || null;
        lastSavedFingerprint = null;
        notify();
        return { restored: true, savedAt: saved.savedAt, project: current };
    }

    function status() {
        const auto = getAutosave();
        return {
            current, dirty: isDirty(), adminKeyRemembered: !!getAdminKey(),
            autosave: auto ? { savedAt: auto.savedAt, loanType: auto.data?.loanType || null, caseName: auto.data?.caseName || '' } : null,
            store: 'Dropbox /APPS DATABASE/AMORTIZATION CALCULATOR/ via /api/projects (admin key required)',
        };
    }

    function notify() { listeners.forEach((fn) => { try { fn(status()); } catch { /* ignore */ } }); }
    function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

    // ---- Projects panel (human UI) ----
    function el(tag, attrs = {}, text) {
        const e = document.createElement(tag);
        Object.entries(attrs).forEach(([k, v]) => (k === 'class' ? (e.className = v) : e.setAttribute(k, v)));
        if (text !== undefined) e.textContent = text;
        return e;
    }

    function buildPanel() {
        const overlay = el('div', { id: 'projectsPanel', class: 'app-overlay', 'data-app-chrome': '', hidden: '' });
        const box = el('div', { class: 'app-dialog projects-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'projectsPanelTitle' });
        box.innerHTML = `
            <div class="app-dialog-header">
                <h2 id="projectsPanelTitle">Projects</h2>
                <button type="button" class="app-dialog-close" id="projectsCloseBtn" aria-label="Close">&times;</button>
            </div>
            <p class="projects-current" id="projectsCurrent"></p>
            <div class="projects-row">
                <label for="projectNameInput">Project name</label>
                <input type="text" id="projectNameInput" maxlength="120" autocomplete="off" placeholder="e.g. Smith refinance">
                <button type="button" class="btn btn-primary" id="projectSaveBtn">Save to Dropbox</button>
            </div>
            <p class="projects-status" id="projectsStatus" role="status" aria-live="polite"></p>
            <div class="projects-list-header">
                <h3>Saved in Dropbox</h3>
                <button type="button" class="btn btn-secondary" id="projectsRefreshBtn">Refresh</button>
            </div>
            <ul class="projects-list" id="projectsList"></ul>
            <details class="projects-key" id="projectsKeyDetails">
                <summary>Administrator key</summary>
                <p>Saving to Dropbox needs the administrator key. This browser remembers it after you enter it once.</p>
                <div class="projects-row">
                    <input type="password" id="projectsAdminKeyInput" autocomplete="off" aria-label="Administrator key">
                    <button type="button" class="btn btn-secondary" id="projectsKeySaveBtn">Remember key</button>
                    <button type="button" class="btn btn-secondary" id="projectsKeyForgetBtn">Forget key</button>
                </div>
            </details>
            <div class="projects-local">
                <h3>This browser only</h3>
                <p>No key needed: <strong>Save</strong> downloads a project file and <strong>Load</strong> opens one. The workspace is also autosaved in this browser.</p>
                <button type="button" class="btn btn-secondary" id="projectsRestoreBtn">Restore autosave</button>
                <span id="projectsAutosaveInfo"></span>
            </div>`;
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const $ = (id) => document.getElementById(id);
        const setStatus = (text, kind = '') => { const s = $('projectsStatus'); s.textContent = text; s.dataset.kind = kind; };
        const close = () => { overlay.hidden = true; $('projectsBtn')?.focus(); };
        const open = () => {
            overlay.hidden = false;
            $('projectNameInput').value = current?.name || document.getElementById('caseName')?.value || '';
            render(status());
            $('projectNameInput').focus();
            if (getAdminKey()) refresh(); else { setStatus('Enter the administrator key below to use Dropbox projects.', 'info'); $('projectsKeyDetails').open = true; }
        };
        const refresh = async () => {
            setStatus('Loading projects…');
            try { const r = await listProjects(); setStatus(r.projects.length ? `${r.projects.length} project(s) in Dropbox.` : 'No projects saved yet.', 'ok'); }
            catch (e) { setStatus(e.message, 'error'); if (e.status === 401) $('projectsKeyDetails').open = true; }
        };
        const renderList = () => {
            const ul = $('projectsList'); ul.innerHTML = '';
            (lastList || []).forEach((p) => {
                const li = el('li');
                const label = el('span', { class: 'projects-item-name' }, `${p.name || p.id}`);
                const meta = el('span', { class: 'projects-item-meta' }, `v${p.version ?? '?'} · ${p.loanType || ''} · ${p.savedAt ? new Date(p.savedAt).toLocaleString() : ''}`);
                const load = el('button', { type: 'button', class: 'btn btn-secondary' }, 'Load');
                const del = el('button', { type: 'button', class: 'btn btn-danger' }, 'Delete');
                load.addEventListener('click', async () => {
                    if (isDirty() && !window.confirm('Replace the current workspace with this project? Unsaved changes will be lost.')) return;
                    setStatus(`Loading ${p.name || p.id}…`);
                    try { const r = await loadProject(p.id); setStatus(`Loaded ${r.project.name} (version ${r.project.version}).`, 'ok'); close(); }
                    catch (e) { setStatus(e.message, 'error'); }
                });
                del.addEventListener('click', async () => {
                    if (!window.confirm(`Delete "${p.name || p.id}" and its saved versions from Dropbox?`)) return;
                    try { await deleteProject(p.id, p.version); setStatus(`Deleted ${p.name || p.id}.`, 'ok'); }
                    catch (e) { setStatus(e.message, 'error'); }
                });
                li.append(label, meta, load, del);
                ul.appendChild(li);
            });
        };
        const render = (st) => {
            $('projectsCurrent').textContent = st.current ? `Current project: ${st.current.name} — version ${st.current.version}${st.dirty ? ' (unsaved changes)' : ''}` : 'Not saved as a project yet.';
            $('projectsAutosaveInfo').textContent = st.autosave ? `Last autosave ${new Date(st.autosave.savedAt).toLocaleString()}` : 'No autosave yet.';
            $('projectsRestoreBtn').disabled = !st.autosave;
            renderList();
        };
        onChange((st) => { if (!overlay.hidden) render(st); updateBadge(st); });

        $('projectsCloseBtn').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
        $('projectsRefreshBtn').addEventListener('click', refresh);
        $('projectSaveBtn').addEventListener('click', async () => {
            const name = $('projectNameInput').value.trim();
            setStatus('Saving…');
            try { const r = await saveProject({ name }); setStatus(`Saved ${r.project.name} as version ${r.project.version}.`, 'ok'); refresh(); }
            catch (e) { setStatus(e.message, 'error'); if (e.status === 401) $('projectsKeyDetails').open = true; }
        });
        $('projectsKeySaveBtn').addEventListener('click', () => {
            const v = $('projectsAdminKeyInput').value; $('projectsAdminKeyInput').value = '';
            if (!v.trim()) return setStatus('Type the key first.', 'error');
            setAdminKey(v); setStatus('Key remembered in this browser.', 'ok'); refresh();
        });
        $('projectsKeyForgetBtn').addEventListener('click', () => { setAdminKey(''); lastList = null; render(status()); setStatus('Key forgotten in this browser.', 'ok'); });
        $('projectsRestoreBtn').addEventListener('click', async () => {
            if (!window.confirm('Replace the current workspace with the autosaved one?')) return;
            try { const r = await restoreAutosave(); setStatus(`Restored the autosave from ${new Date(r.savedAt).toLocaleString()}.`, 'ok'); }
            catch (e) { setStatus(e.message, 'error'); }
        });
        return { open, close };
    }

    function updateBadge(st) {
        const btn = document.getElementById('projectsBtn');
        if (btn) btn.title = st.current ? `Project: ${st.current.name} (v${st.current.version})${st.dirty ? ' — unsaved changes' : ''}` : 'Save or open a named project';
    }

    let panel = null;
    document.addEventListener('DOMContentLoaded', () => {
        // A fresh page starts as an unsaved workspace. The project a tab was revising comes back
        // only with "Restore autosave", together with the inputs it belongs to.
        current = null;
        panel = buildPanel();
        document.getElementById('projectsBtn')?.addEventListener('click', () => panel.open());
        const containers = ['commonFieldsContainer', 'tabSpecificFieldsContainer'];
        ['input', 'change'].forEach((type) => document.addEventListener(type, (e) => {
            if (containers.some((id) => document.getElementById(id)?.contains(e.target))) { scheduleAutosave(); }
        }, true));
        document.querySelectorAll('.loan-type-btn').forEach((b) => b.addEventListener('click', scheduleAutosave));
        updateBadge(status());
    });

    window.AmortProjects = {
        projectId, saveProject, loadProject, deleteProject, listProjects, restoreAutosave, getAutosave,
        status, onChange, isDirty, autosaveNow,
        get current() { return current; },
        // The admin key is the human's to give; it is used, never returned.
        hasAdminKey: () => !!getAdminKey(),
        setAdminKey,
        openPanel: () => panel && panel.open(),
    };
})();
