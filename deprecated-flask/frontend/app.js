const API = window.location.origin === "null" || window.location.protocol === "file:"
    ? "http://127.0.0.1:5000/api"
    : "/api";

const THEME_STORAGE_KEY = "cambridge-dbml-theme";
let activeTable = null;
let tablesCache = {};

const editorEl = document.getElementById("editor");
const outputEl = document.getElementById("output");
const runButtonEl = document.getElementById("run-button");
const clearOutputEl = document.getElementById("clear-output");
const themeToggleEl = document.getElementById("theme-toggle");

function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    updateThemeToggleLabel(theme);
}

function getInitialTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "light" || savedTheme === "dark") {
        return savedTheme;
    }
    return "light";
}

function updateThemeToggleLabel(theme) {
    if (!themeToggleEl) {
        return;
    }

    const label = theme === "dark" ? "Light Mode" : "Dark Mode";
    themeToggleEl.querySelector(".theme-toggle-label").textContent = label;
    themeToggleEl.setAttribute("aria-label", `Switch to ${label.toLowerCase()}`);
}

function setupThemeToggle() {
    const initialTheme = getInitialTheme();
    applyTheme(initialTheme);

    if (!themeToggleEl) {
        return;
    }

    themeToggleEl.addEventListener("click", () => {
        const nextTheme = document.documentElement.getAttribute("data-theme") === "dark"
            ? "light"
            : "dark";
        applyTheme(nextTheme);
    });
}

async function runSQL(runAnyway = false) {
    const sql = editorEl.value;

    try {
        const res = await fetch(API + "/execute", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ sql, run_anyway: runAnyway })
        });

        let data;
        try {
            data = await res.json();
        } catch (_err) {
            throw new Error(`Server returned HTTP ${res.status} with a non-JSON response.`);
        }

        if (!res.ok && !data.error) {
            throw new Error(`HTTP error ${res.status}`);
        }

        renderOutput(data);
        await loadTables();
    } catch (err) {
        console.error("Execution error:", err);
        renderOutput({
            success: false,
            error: err.message,
            lint: { errors: [], warnings: [] }
        });
    }
}

function renderOutput(data) {
    outputEl.innerHTML = "";

    const lint = data.lint || { errors: [], warnings: [] };

    if (lint.errors && lint.errors.length > 0) {
        outputEl.appendChild(renderAlert(
            "danger",
            "Cambridge lint errors",
            renderIssueList(lint.errors)
        ));
    }

    if (lint.warnings && lint.warnings.length > 0) {
        outputEl.appendChild(renderAlert(
            "warning",
            "Cambridge lint warnings",
            renderIssueList(lint.warnings)
        ));
    }

    if (data.blocked_by_lint) {
        const blocked = document.createElement("div");
        blocked.className = "alert alert-neutral";
        blocked.innerHTML = `
            <div class="alert-title">Execution blocked</div>
            <p>${escapeHTML(data.error || "The query was not run because lint errors were found.")}</p>
        `;

        const retryButton = document.createElement("button");
        retryButton.className = "btn btn-secondary inline-action";
        retryButton.type = "button";
        retryButton.textContent = "Run Anyway";
        retryButton.onclick = () => runSQL(true);
        blocked.appendChild(retryButton);

        outputEl.appendChild(blocked);
        return;
    }

    if (data.error || data.success === false) {
        outputEl.appendChild(renderAlert(
            "danger",
            "Runtime error",
            `<pre>${escapeHTML(data.error || "Unknown runtime error occurred.")}</pre>`
        ));
        return;
    }

    if (!data.result) {
        outputEl.innerHTML = `
            <div class="empty-state">
                <h3>No result payload</h3>
                <p>The request completed without a query result to display.</p>
            </div>
        `;
        return;
    }

    if (data.result.type === "validated_only") {
        outputEl.appendChild(renderAlert(
            "success",
            "Validated Cambridge SQL",
            `<p>${escapeHTML(data.result.message)}</p>`
        ));
        return;
    }

    if (data.result.type === "select") {
        outputEl.appendChild(renderAlert(
            "success",
            "Query executed successfully",
            `<p>Returned <strong>${data.result.rows.length}</strong> rows across <strong>${data.result.statements_run || 1}</strong> statement(s).</p>`
        ));
        outputEl.appendChild(buildResultTable(data.result.columns, data.result.rows, "No rows returned."));
        return;
    }

    outputEl.appendChild(renderAlert(
        "success",
        "Query executed successfully",
        `<p>Rows affected: <strong>${data.result.rows_affected ?? 0}</strong>. Statements run: <strong>${data.result.statements_run || 1}</strong>.</p>`
    ));
}

function renderAlert(kind, title, bodyHTML) {
    const alert = document.createElement("div");
    alert.className = `alert alert-${kind}`;
    alert.innerHTML = `
        <div class="alert-title">${escapeHTML(title)}</div>
        <div class="alert-body">${bodyHTML}</div>
    `;
    return alert;
}

function renderIssueList(items) {
    const rows = items.map(item => `<li>Line ${item.line}: ${escapeHTML(item.message)}</li>`).join("");
    return `<ul class="issue-list">${rows}</ul>`;
}

function buildResultTable(columns, rows, emptyMessage) {
    const container = document.createElement("div");
    container.className = "table-container";

    const tableEl = document.createElement("table");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    columns.forEach(col => {
        const th = document.createElement("th");
        th.textContent = col;
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    tableEl.appendChild(thead);

    const tbody = document.createElement("tbody");
    if (!rows.length) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = Math.max(columns.length, 1);
        td.className = "table-empty-cell";
        td.textContent = emptyMessage;
        tr.appendChild(td);
        tbody.appendChild(tr);
    } else {
        rows.forEach(row => {
            const tr = document.createElement("tr");
            row.forEach(value => {
                const td = document.createElement("td");
                td.textContent = value === null ? "NULL" : value;
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }

    tableEl.appendChild(tbody);
    container.appendChild(tableEl);
    return container;
}

async function loadTables() {
    const tabsBar = document.getElementById("tabs-bar");
    const contentView = document.getElementById("table-view-content");

    try {
        const res = await fetch(API + "/tables");
        if (!res.ok) {
            throw new Error("Failed to fetch tables list.");
        }

        const tables = await res.json();
        if (!tables || tables.length === 0) {
            activeTable = null;
            tablesCache = {};
            tabsBar.innerHTML = "";
            contentView.innerHTML = `
                <div class="empty-state empty-state-large">
                    <h3>Database is empty</h3>
                    <p>Create your first table from the editor to begin building the schema.</p>
                </div>
            `;
            return;
        }

        const tablePromises = tables.map(async (name) => {
            try {
                const detailRes = await fetch(`${API}/table/${encodeURIComponent(name)}`);
                const detailData = await detailRes.json();
                if (!detailRes.ok) {
                    throw new Error(detailData.error || `Failed to fetch details for ${name}.`);
                }
                return { name, columns: detailData.columns, rows: detailData.rows, success: true };
            } catch (err) {
                console.error(err);
                return { name, error: err.message, success: false };
            }
        });

        const tablesDataList = await Promise.all(tablePromises);
        tablesCache = {};
        tablesDataList.forEach((table) => {
            tablesCache[table.name] = table;
        });

        if (!activeTable || !tablesCache[activeTable]) {
            activeTable = tables[0];
        }

        tabsBar.innerHTML = "";
        tables.forEach((name) => {
            const button = document.createElement("button");
            button.className = "tab-btn";
            button.type = "button";
            if (name === activeTable) {
                button.classList.add("active");
            }

            const tableInfo = tablesCache[name];
            const rowsCount = tableInfo.success ? tableInfo.rows.length : 0;
            button.innerHTML = `
                <span class="tab-name">${escapeHTML(name)}</span>
                <span class="tab-count">${rowsCount}</span>
            `;

            button.onclick = () => {
                document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
                button.classList.add("active");
                activeTable = name;
                renderActiveTable();
            };

            tabsBar.appendChild(button);
        });

        renderActiveTable();
    } catch (err) {
        console.error(err);
        tabsBar.innerHTML = "";
        contentView.innerHTML = `
            <div class="alert alert-danger" style="margin: 0;">
                <div class="alert-title">Database viewer error</div>
                <div class="alert-body"><p>${escapeHTML(err.message)}</p></div>
            </div>
        `;
    }
}

function renderActiveTable() {
    const contentView = document.getElementById("table-view-content");
    contentView.innerHTML = "";

    if (!activeTable || !tablesCache[activeTable]) {
        contentView.innerHTML = `
            <div class="empty-state">
                <h3>No table selected</h3>
                <p>Select a table tab to inspect its contents.</p>
            </div>
        `;
        return;
    }

    const tableData = tablesCache[activeTable];

    if (!tableData.success) {
        contentView.innerHTML = `
            <div class="alert alert-danger" style="margin: 0;">
                <div class="alert-title">Error loading table</div>
                <div class="alert-body"><p>${escapeHTML(tableData.error)}</p></div>
            </div>
        `;
        return;
    }

    const meta = document.createElement("div");
    meta.className = "table-meta";
    meta.innerHTML = `
        <div class="table-meta-card">
            <span class="table-meta-label">Table</span>
            <strong>${escapeHTML(activeTable)}</strong>
        </div>
        <div class="table-meta-card">
            <span class="table-meta-label">Columns</span>
            <strong>${tableData.columns.length}</strong>
        </div>
        <div class="table-meta-card">
            <span class="table-meta-label">Rows</span>
            <strong>${tableData.rows.length}</strong>
        </div>
    `;
    contentView.appendChild(meta);
    contentView.appendChild(buildResultTable(tableData.columns, tableData.rows, "No records in this table."));
}

function escapeHTML(str) {
    if (str === null || str === undefined) {
        return "";
    }

    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function clearOutput() {
    outputEl.innerHTML = `
        <div class="empty-state">
            <h3>Output cleared</h3>
            <p>Run another query to populate this panel again.</p>
        </div>
    `;
}

setupThemeToggle();

if (runButtonEl) {
    runButtonEl.addEventListener("click", () => runSQL(false));
}

if (clearOutputEl) {
    clearOutputEl.addEventListener("click", clearOutput);
}

document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        runSQL(false);
    }
});

window.onload = () => {
    if (document.body.dataset.page === "workspace") {
        loadTables();
    }
};
