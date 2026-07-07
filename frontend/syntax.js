const API = window.location.origin === "null" || window.location.protocol === "file:"
    ? "http://127.0.0.1:5000/api"
    : "/api";

let allEntries = [];
let activeFilter = "ALL";

function escapeHTML(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function loadSyntax() {
    const loading = document.getElementById("syntax-loading");
    const errorBox = document.getElementById("syntax-error");

    try {
        const res = await fetch(API + "/syntax");
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

        allEntries = await res.json();
        loading.style.display = "none";
        renderGrid();
    } catch (err) {
        console.error("Failed to load syntax reference:", err);
        loading.style.display = "none";
        errorBox.style.display = "block";
        errorBox.innerHTML = `
            <div class="alert-title">Could not load syntax reference</div>
            ${escapeHTML(err.message)} — make sure the backend server is running.
        `;
    }
}

function renderGrid() {
    const grid = document.getElementById("syntax-grid");
    grid.innerHTML = "";

    const entries = activeFilter === "ALL"
        ? allEntries
        : allEntries.filter(e => e.category === activeFilter);

    entries.forEach(entry => {
        const card = document.createElement("div");
        card.className = "syntax-card";

        const badgeClass = entry.category === "DDL" ? "badge-ddl" : "badge-dml";

        card.innerHTML = `
            <div class="syntax-card-header">
                <span class="syntax-badge ${badgeClass}">${escapeHTML(entry.category)}</span>
                <h3>${escapeHTML(entry.name)}</h3>
            </div>
            <p class="syntax-summary">${escapeHTML(entry.summary)}</p>

            <div class="syntax-block-label">Syntax</div>
            <pre class="syntax-block syntax-block-syntax">${escapeHTML(entry.syntax)}</pre>

            <div class="syntax-block-label">Example</div>
            <pre class="syntax-block syntax-block-example">${escapeHTML(entry.example)}</pre>

            ${entry.notes ? `<div class="syntax-note">💡 ${escapeHTML(entry.notes)}</div>` : ""}
        `;
        grid.appendChild(card);
    });
}

function setupFilters() {
    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            activeFilter = btn.dataset.filter;
            renderGrid();
        };
    });
}

window.onload = () => {
    setupFilters();
    loadSyntax();
};
