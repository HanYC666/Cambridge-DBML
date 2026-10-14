import { SYNTAX_REFERENCE } from "./syntax-reference.js";

let activeFilter = "ALL";

function escapeHTML(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function renderGrid() {
    const grid = document.getElementById("syntax-grid");
    const entries = activeFilter === "ALL" ? SYNTAX_REFERENCE : SYNTAX_REFERENCE.filter((entry) => entry.category === activeFilter);
    grid.innerHTML = "";
    if (!entries.length) {
        grid.innerHTML = `<div class="empty-state empty-state-large"><h3>No syntax entries in this filter</h3><p>Choose a different category to inspect the available Cambridge commands.</p></div>`;
        return;
    }
    entries.forEach((entry) => {
        const card = document.createElement("article");
        card.className = "syntax-card";
        card.innerHTML = `<div class="syntax-card-header"><span class="syntax-badge ${entry.category === "DDL" ? "badge-ddl" : "badge-dml"}">${escapeHTML(entry.category)}</span><h2>${escapeHTML(entry.name)}</h2></div><p class="syntax-summary">${escapeHTML(entry.summary)}</p><div class="syntax-section-label">Syntax</div><pre class="syntax-block">${escapeHTML(entry.syntax)}</pre><div class="syntax-section-label">Example</div><pre class="syntax-block syntax-block-example">${escapeHTML(entry.example)}</pre>${entry.notes ? `<div class="syntax-note">${escapeHTML(entry.notes)}</div>` : ""}`;
        grid.appendChild(card);
    });
}

export function setupSyntaxReference() {
    document.querySelectorAll(".filter-btn").forEach((button) => button.addEventListener("click", () => {
        document.querySelectorAll(".filter-btn").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        activeFilter = button.dataset.filter;
        renderGrid();
    }));
    renderGrid();
}
