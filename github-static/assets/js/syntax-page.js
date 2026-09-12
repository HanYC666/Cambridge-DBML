import { SYNTAX_REFERENCE } from "./syntax-reference.js";

const THEME_STORAGE_KEY = "cambridge-dbml-theme";
let activeFilter = "ALL";
const themeToggleEl = document.getElementById("theme-toggle");

function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch (_error) { /* storage may be disabled */ }
    if (themeToggleEl) themeToggleEl.querySelector(".theme-toggle-label").textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
}

function setupTheme() {
    let saved = null;
    try { saved = localStorage.getItem(THEME_STORAGE_KEY); } catch (_error) { /* use default */ }
    applyTheme(saved === "dark" ? "dark" : "light");
    themeToggleEl?.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
}

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

setupTheme();
document.querySelectorAll(".filter-btn").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    activeFilter = button.dataset.filter;
    renderGrid();
}));
document.getElementById("syntax-loading").style.display = "none";
renderGrid();
