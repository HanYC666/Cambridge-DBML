
const API = window.location.origin === "null" || window.location.protocol === "file:" 
    ? "http://127.0.0.1:5000/api" 
    : "/api";

let activeTable = null; // Store name of currently active table tab
let tablesCache = {}; // Cache of { tableName: { columns, rows, success, error } }


async function runSQL() {
    const sql = document.getElementById("editor").value;

    try {
        const res = await fetch(API + "/execute", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ sql })
        });

        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data = await res.json();
        renderOutput(data);
        loadTables();
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
    const out = document.getElementById("output");
    out.innerHTML = "";

    // 1. Render Lint Warnings & Errors
    if (data.lint) {
        if (data.lint.errors && data.lint.errors.length > 0) {
            const errDiv = document.createElement("div");
            errDiv.className = "alert alert-danger";
            
            let html = `<div class="alert-title">⚠️ SQL Lint Errors</div><ul>`;
            data.lint.errors.forEach(e => {
                html += `<li>Line ${e.line}: ${escapeHTML(e.message)}</li>`;
            });
            html += `</ul>`;
            errDiv.innerHTML = html;
            out.appendChild(errDiv);
        }

        if (data.lint.warnings && data.lint.warnings.length > 0) {
            const warnDiv = document.createElement("div");
            warnDiv.className = "alert alert-warning";
            
            let html = `<div class="alert-title">⚠️ SQL Lint Warnings</div><ul>`;
            data.lint.warnings.forEach(e => {
                html += `<li>Line ${e.line}: ${escapeHTML(e.message)}</li>`;
            });
            html += `</ul>`;
            warnDiv.innerHTML = html;
            out.appendChild(warnDiv);
        }
    }

    // 2. Render Execution Error
    if (data.error || data.success === false) {
        const errDiv = document.createElement("div");
        errDiv.className = "alert alert-danger";
        errDiv.innerHTML = `
            <div class="alert-title">❌ Runtime Error</div>
            <pre style="margin: 0; white-space: pre-wrap; font-family: monospace;">${escapeHTML(data.error || "Unknown runtime error occurred.")}</pre>
        `;
        out.appendChild(errDiv);
        return; // Stop rendering if there is a runtime error
    }

    // 3. Render Query Results
    if (data.result) {
        if (data.result.type === "select") {
            const successDiv = document.createElement("div");
            successDiv.className = "alert alert-success";
            successDiv.innerHTML = `
                <div class="alert-title">✓ Query Executed Successfully</div>
                Returned <strong>${data.result.rows.length}</strong> rows.
            `;
            out.appendChild(successDiv);

            const tableContainer = document.createElement("div");
            tableContainer.className = "table-container";

            const tableEl = document.createElement("table");
            
            // Header
            const thead = document.createElement("thead");
            const headerRow = document.createElement("tr");
            data.result.columns.forEach(col => {
                const th = document.createElement("th");
                th.textContent = col;
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            tableEl.appendChild(thead);
            
            // Body
            const tbody = document.createElement("tbody");
            if (data.result.rows.length === 0) {
                const tr = document.createElement("tr");
                const td = document.createElement("td");
                td.setAttribute("colspan", data.result.columns.length);
                td.style.textAlign = "center";
                td.style.color = "var(--text-muted)";
                td.textContent = "No rows returned";
                tr.appendChild(td);
                tbody.appendChild(tr);
            } else {
                data.result.rows.forEach(row => {
                    const tr = document.createElement("tr");
                    row.forEach(val => {
                        const td = document.createElement("td");
                        td.textContent = val === null ? "NULL" : val;
                        tr.appendChild(td);
                    });
                    tbody.appendChild(tr);
                });
            }
            tableEl.appendChild(tbody);
            tableContainer.appendChild(tableEl);
            out.appendChild(tableContainer);
        } else {
            const successDiv = document.createElement("div");
            successDiv.className = "alert alert-success";
            successDiv.innerHTML = `
                <div class="alert-title">✓ Query Executed Successfully</div>
                Rows affected: <strong>${data.result.rows_affected}</strong>
            `;
            out.appendChild(successDiv);
        }
    }
}


async function loadTables() {
    const tabsBar = document.getElementById("tabs-bar");
    const contentView = document.getElementById("table-view-content");
    
    try {
        const res = await fetch(API + "/tables");
        if (!res.ok) throw new Error("Failed to fetch tables list");
        
        const tables = await res.json();
        
        if (!tables || tables.length === 0) {
            activeTable = null;
            tablesCache = {};
            tabsBar.innerHTML = "";
            contentView.innerHTML = `
                <div class="db-viewer-empty">
                    <div style="font-size: 1.5rem; margin-bottom: 8px;">🗄️ Empty Database</div>
                    <div>No tables exist in the database. Write a <code>CREATE TABLE</code> query in the SQL Editor to begin.</div>
                </div>
            `;
            return;
        }

        // Fetch all tables details concurrently
        const tablePromises = tables.map(async (name) => {
            try {
                const detailRes = await fetch(`${API}/table/${name}`);
                if (!detailRes.ok) throw new Error(`Failed to fetch details for ${name}`);
                const detailData = await detailRes.json();
                return { name, columns: detailData.columns, rows: detailData.rows, success: true };
            } catch (err) {
                console.error(err);
                return { name, error: err.message, success: false };
            }
        });

        const tablesDataList = await Promise.all(tablePromises);
        
        // Update Cache
        tablesCache = {};
        tablesDataList.forEach(table => {
            tablesCache[table.name] = table;
        });

        // Determine which table should be active
        // If the previously active table no longer exists, default to the first table
        if (!activeTable || !tablesCache[activeTable]) {
            activeTable = tables[0];
        }

        // Render Tabs
        tabsBar.innerHTML = "";
        tables.forEach(name => {
            const btn = document.createElement("button");
            btn.className = "tab-btn";
            if (name === activeTable) {
                btn.classList.add("active");
            }
            
            const rowsCount = tablesCache[name].success ? tablesCache[name].rows.length : 0;
            btn.innerHTML = `<span>${name}</span><span class="tab-btn-rows">${rowsCount}</span>`;
            
            btn.onclick = () => {
                // Switch active tab
                document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                activeTable = name;
                renderActiveTable();
            };
            tabsBar.appendChild(btn);
        });

        // Render selected table content
        renderActiveTable();
    } catch (e) {
        console.error(e);
        tabsBar.innerHTML = "";
        contentView.innerHTML = `
            <div class="db-viewer-empty" style="color: var(--danger);">
                <div>Failed to load database schema: ${escapeHTML(e.message)}</div>
            </div>
        `;
    }
}


function renderActiveTable() {
    const contentView = document.getElementById("table-view-content");
    contentView.innerHTML = "";

    if (!activeTable || !tablesCache[activeTable]) {
        contentView.innerHTML = `<div class="db-viewer-empty">No table selected</div>`;
        return;
    }

    const tableData = tablesCache[activeTable];

    if (!tableData.success) {
        contentView.innerHTML = `
            <div class="alert alert-danger" style="margin: 0;">
                <div class="alert-title">❌ Error Loading Table</div>
                <div>${escapeHTML(tableData.error)}</div>
            </div>
        `;
        return;
    }

    const tableContainer = document.createElement("div");
    tableContainer.className = "table-container";
    tableContainer.style.marginTop = "0"; // Reset margin to align perfectly with header

    const tableEl = document.createElement("table");

    // Header
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    tableData.columns.forEach(col => {
        const th = document.createElement("th");
        th.textContent = col;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    tableEl.appendChild(thead);

    // Body
    const tbody = document.createElement("tbody");
    if (tableData.rows.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.setAttribute("colspan", tableData.columns.length);
        td.style.textAlign = "center";
        td.style.color = "var(--text-muted)";
        td.textContent = "No records in this table";
        tr.appendChild(td);
        tbody.appendChild(tr);
    } else {
        tableData.rows.forEach(row => {
            const tr = document.createElement("tr");
            row.forEach(val => {
                const td = document.createElement("td");
                td.textContent = val === null ? "NULL" : val;
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }
    tableEl.appendChild(tbody);
    tableContainer.appendChild(tableEl);
    contentView.appendChild(tableContainer);
}


function escapeHTML(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


window.onload = () => {
    loadTables();
};