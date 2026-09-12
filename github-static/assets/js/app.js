import { BrowserDatabase } from "./sql-engine.js";
import { BrowserExecutor } from "./executor.js";
import { DatabaseStorage } from "./storage.js";

const THEME_STORAGE_KEY = "cambridge-dbml-theme";
let database = null;
let executor = null;
let storage = null;
let activeTable = null;
let tablesCache = {};

const editorEl = document.getElementById("editor");
const outputEl = document.getElementById("output");
const runButtonEl = document.getElementById("run-button");
const clearOutputEl = document.getElementById("clear-output");
const themeToggleEl = document.getElementById("theme-toggle");
const storageStatusEl = document.getElementById("storage-status");
const storageHelpEl = document.getElementById("storage-help");

function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch (_error) { /* optional preference */ }
    if (themeToggleEl) {
        const label = theme === "dark" ? "Light Mode" : "Dark Mode";
        themeToggleEl.querySelector(".theme-toggle-label").textContent = label;
        themeToggleEl.setAttribute("aria-label", `Switch to ${label.toLowerCase()}`);
    }
}

function setupTheme() {
    let saved = null;
    try { saved = localStorage.getItem(THEME_STORAGE_KEY); } catch (_error) { /* use default */ }
    applyTheme(saved === "dark" ? "dark" : "light");
    themeToggleEl?.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
}

function updateStorageStatus(state) {
    if (!storageStatusEl) return;
    storageStatusEl.textContent = state.label;
    storageStatusEl.dataset.state = state.kind;
    if (storageHelpEl) storageHelpEl.textContent = state.detail || (state.kind === "saved" ? "The latest successful write is stored in the connected user-owned file." : state.kind === "in-memory" ? "In-memory work lasts only while this tab remains open. Use Export Database or connect a local file to keep it." : "Export a database copy whenever you want a permanent file outside browser-managed site storage.");
}

function renderOutput(data) {
    outputEl.innerHTML = "";
    const lint = data.lint || { errors: [], warnings: [] };
    if (lint.errors?.length) outputEl.appendChild(renderAlert("danger", "Cambridge lint errors", renderIssueList(lint.errors)));
    if (lint.warnings?.length) outputEl.appendChild(renderAlert("warning", "Cambridge lint warnings", renderIssueList(lint.warnings)));
    if (data.blocked_by_lint) {
        const blocked = document.createElement("div");
        blocked.className = "alert alert-neutral";
        blocked.innerHTML = `<div class="alert-title">Execution blocked</div><p>${escapeHTML(data.error || "The query was not run because lint errors were found.")}</p>`;
        const retryButton = document.createElement("button"); retryButton.className = "btn btn-secondary inline-action"; retryButton.type = "button"; retryButton.textContent = "Run Anyway"; retryButton.onclick = () => runSQL(true);
        blocked.appendChild(retryButton); outputEl.appendChild(blocked); return;
    }
    if (data.error || data.success === false) { outputEl.appendChild(renderAlert("danger", "Runtime error", `<pre>${escapeHTML(data.error || "Unknown runtime error occurred.")}</pre>`)); return; }
    if (!data.result) { outputEl.innerHTML = `<div class="empty-state"><h3>No result payload</h3><p>The query completed without a result to display.</p></div>`; return; }
    if (data.result.type === "validated_only") outputEl.appendChild(renderAlert("success", "Validated Cambridge SQL", `<p>${escapeHTML(data.result.message)}</p>`));
    else if (data.result.type === "select") { outputEl.appendChild(renderAlert("success", "Query executed successfully", `<p>Returned <strong>${data.result.rows.length}</strong> rows across <strong>${data.result.statements_run || 1}</strong> statement(s).</p>`)); outputEl.appendChild(buildResultTable(data.result.columns, data.result.rows, "No rows returned.")); }
    else outputEl.appendChild(renderAlert("success", "Query executed successfully", `<p>Rows affected: <strong>${data.result.rows_affected ?? 0}</strong>. Statements run: <strong>${data.result.statements_run || 1}</strong>.</p>`));
    if (data.persistence_error) outputEl.appendChild(renderAlert("warning", "Database not saved", `<p>${escapeHTML(data.persistence_error)}</p>`));
}

function renderAlert(kind, title, bodyHTML) { const alert = document.createElement("div"); alert.className = `alert alert-${kind}`; alert.innerHTML = `<div class="alert-title">${escapeHTML(title)}</div><div class="alert-body">${bodyHTML}</div>`; return alert; }
function renderIssueList(items) { return `<ul class="issue-list">${items.map((item) => `<li>Line ${item.line}: ${escapeHTML(item.message)}</li>`).join("")}</ul>`; }

function buildResultTable(columns, rows, emptyMessage) {
    const container = document.createElement("div"); container.className = "table-container";
    const table = document.createElement("table"); const head = document.createElement("tr");
    columns.forEach((column) => { const th = document.createElement("th"); th.textContent = column; head.appendChild(th); });
    const thead = document.createElement("thead"); thead.appendChild(head); table.appendChild(thead);
    const body = document.createElement("tbody");
    if (!rows.length) { const row = document.createElement("tr"); const cell = document.createElement("td"); cell.colSpan = Math.max(columns.length, 1); cell.className = "table-empty-cell"; cell.textContent = emptyMessage; row.appendChild(cell); body.appendChild(row); }
    else rows.forEach((values) => { const row = document.createElement("tr"); values.forEach((value) => { const cell = document.createElement("td"); cell.textContent = value === null ? "NULL" : value; row.appendChild(cell); }); body.appendChild(row); });
    table.appendChild(body); container.appendChild(table); return container;
}

function renderActiveTable() {
    const content = document.getElementById("table-view-content"); content.innerHTML = "";
    if (!activeTable || !tablesCache[activeTable]) { content.innerHTML = `<div class="empty-state"><h3>No table selected</h3><p>Select a table tab to inspect its contents.</p></div>`; return; }
    const tableData = tablesCache[activeTable];
    if (!tableData.success) { content.innerHTML = `<div class="alert alert-danger"><div class="alert-title">Error loading table</div><div class="alert-body"><p>${escapeHTML(tableData.error)}</p></div></div>`; return; }
    const meta = document.createElement("div"); meta.className = "table-meta"; meta.innerHTML = `<div class="table-meta-card"><span class="table-meta-label">Table</span><strong>${escapeHTML(activeTable)}</strong></div><div class="table-meta-card"><span class="table-meta-label">Columns</span><strong>${tableData.columns.length}</strong></div><div class="table-meta-card"><span class="table-meta-label">Rows</span><strong>${tableData.rows.length}</strong></div>`;
    content.appendChild(meta); content.appendChild(buildResultTable(tableData.columns, tableData.rows, "No records in this table."));
}

function loadTables() {
    const tabsBar = document.getElementById("tabs-bar"); const content = document.getElementById("table-view-content");
    try {
        const tables = executor.tables();
        if (!tables.length) { activeTable = null; tablesCache = {}; tabsBar.innerHTML = ""; content.innerHTML = `<div class="empty-state empty-state-large"><h3>Database is empty</h3><p>Create your first table from the editor to begin building the schema.</p></div>`; return; }
        tablesCache = Object.fromEntries(tables.map((name) => { try { return [name, { name, ...executor.table(name), success: true }]; } catch (error) { return [name, { name, error: error.message, success: false }]; } }));
        if (!activeTable || !tablesCache[activeTable]) activeTable = tables[0];
        tabsBar.innerHTML = "";
        tables.forEach((name) => { const button = document.createElement("button"); button.className = `tab-btn${name === activeTable ? " active" : ""}`; button.type = "button"; const info = tablesCache[name]; button.innerHTML = `<span class="tab-name">${escapeHTML(name)}</span><span class="tab-count">${info.success ? info.rows.length : 0}</span>`; button.onclick = () => { document.querySelectorAll(".tab-btn").forEach((item) => item.classList.remove("active")); button.classList.add("active"); activeTable = name; renderActiveTable(); }; tabsBar.appendChild(button); });
        renderActiveTable();
    } catch (error) { tabsBar.innerHTML = ""; content.innerHTML = `<div class="alert alert-danger"><div class="alert-title">Database viewer error</div><div class="alert-body"><p>${escapeHTML(error.message)}</p></div></div>`; }
}

async function runSQL(runAnyway = false) {
    runButtonEl.disabled = true;
    try { const result = await executor.run(editorEl.value, { runAnyway }); renderOutput(result); loadTables(); }
    catch (error) { renderOutput({ success: false, error: error.message, lint: { errors: [], warnings: [] } }); }
    finally { runButtonEl.disabled = false; }
}

function clearOutput() { outputEl.innerHTML = `<div class="empty-state"><h3>Output cleared</h3><p>Run another query to populate this panel again.</p></div>`; }
async function replaceDatabase(nextDatabase) { database = nextDatabase; executor = new BrowserExecutor(database, storage); activeTable = null; loadTables(); }
function reportActionError(error) { if (error?.name !== "AbortError") renderOutput({ success: false, error: error.message || String(error), lint: { errors: [], warnings: [] } }); }

async function setupStorageControls() {
    const fileInput = document.getElementById("database-file-input");
    const fileSystemAccess = storage.hasFileSystemAccess();
    const openButton = document.getElementById("open-database");
    const saveAsButton = document.getElementById("save-database-as");
    const exportButton = document.getElementById("export-database");
    const importButton = document.getElementById("import-database");

    openButton.hidden = !fileSystemAccess;
    saveAsButton.hidden = !fileSystemAccess;
    exportButton.hidden = false;
    importButton.hidden = fileSystemAccess;

    if (fileSystemAccess && storage.state.kind === "in-memory") {
        storage.setState("In-memory only", "in-memory", "Open a database to connect a local file for automatic live saving. Export Database creates a separate backup copy.");
    }
    if (!fileSystemAccess) {
        storage.setState("In-memory only", "in-memory", "This browser cannot keep a writable file connection. Import a database to work on a copy, then Export Database to keep your changes.");
    }

    openButton.onclick = async () => { try { await replaceDatabase(await storage.openDatabase(BrowserDatabase)); } catch (error) { reportActionError(error); } };
    saveAsButton.onclick = async () => { try { await storage.saveAs(database); } catch (error) { reportActionError(error); } };
    exportButton.onclick = () => storage.exportDatabase(database);
    importButton.onclick = () => fileInput.click();
    fileInput.onchange = async () => { const [file] = fileInput.files; if (!file) return; try { await replaceDatabase(await storage.importFile(file, BrowserDatabase)); } catch (error) { reportActionError(error); } finally { fileInput.value = ""; } };
}

async function init() {
    setupTheme(); storage = new DatabaseStorage(updateStorageStatus);
    database = await storage.restoreHandle(BrowserDatabase) || await BrowserDatabase.createEmpty();
    executor = new BrowserExecutor(database, storage); await setupStorageControls(); loadTables();
}

runButtonEl?.addEventListener("click", () => runSQL(false));
clearOutputEl?.addEventListener("click", clearOutput);
document.addEventListener("keydown", (event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); runSQL(false); } });
init().catch((error) => renderOutput({ success: false, error: error.message, lint: { errors: [], warnings: [] } }));

function escapeHTML(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
