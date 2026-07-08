const API = window.location.origin === "null" || window.location.protocol === "file:"
    ? "http://127.0.0.1:5000/api"
    : "/api";

const THEME_STORAGE_KEY = "cambridge-dbml-theme";
let allEntries = [];
let activeFilter = "ALL";
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

async function loadSyntax() {
    const loading = document.getElementById("syntax-loading");
    const errorBox = document.getElementById("syntax-error");

    try {
        const res = await fetch(API + "/syntax");
        if (!res.ok) {
            throw new Error(`HTTP error ${res.status}`);
        }

        allEntries = await res.json();
        loading.style.display = "none";
        renderGrid();
    } catch (err) {
        console.error("Failed to load syntax reference:", err);
        loading.style.display = "none";
        errorBox.style.display = "block";
        errorBox.innerHTML = `
            <div class="alert-title">Could not load syntax reference</div>
            <div class="alert-body"><p>${escapeHTML(err.message)}. Make sure the backend server is running.</p></div>
        `;
    }
}

function renderGrid() {
    const grid = document.getElementById("syntax-grid");
    grid.innerHTML = "";

    const entries = activeFilter === "ALL"
        ? allEntries
        : allEntries.filter((entry) => entry.category === activeFilter);

    if (!entries.length) {
        grid.innerHTML = `
            <div class="empty-state empty-state-large">
                <h3>No syntax entries in this filter</h3>
                <p>Choose a different category to inspect the available Cambridge commands.</p>
            </div>
        `;
        return;
    }

    entries.forEach((entry) => {
        const card = document.createElement("article");
        card.className = "syntax-card";

        const badgeClass = entry.category === "DDL" ? "badge-ddl" : "badge-dml";
        card.innerHTML = `
            <div class="syntax-card-header">
                <span class="syntax-badge ${badgeClass}">${escapeHTML(entry.category)}</span>
                <h2>${escapeHTML(entry.name)}</h2>
            </div>
            <p class="syntax-summary">${escapeHTML(entry.summary)}</p>
            <div class="syntax-section-label">Syntax</div>
            <pre class="syntax-block">${escapeHTML(entry.syntax)}</pre>
            <div class="syntax-section-label">Example</div>
            <pre class="syntax-block syntax-block-example">${escapeHTML(entry.example)}</pre>
            ${entry.notes ? `<div class="syntax-note">${escapeHTML(entry.notes)}</div>` : ""}
        `;

        grid.appendChild(card);
    });
}

function setupFilters() {
    document.querySelectorAll(".filter-btn").forEach((button) => {
        button.addEventListener("click", () => {
            document.querySelectorAll(".filter-btn").forEach((btn) => btn.classList.remove("active"));
            button.classList.add("active");
            activeFilter = button.dataset.filter;
            renderGrid();
        });
    });
}

setupThemeToggle();

window.onload = () => {
    setupFilters();
    loadSyntax();
};
