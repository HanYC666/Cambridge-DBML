
const API = "http://127.0.0.1:5000/api";


async function runSQL() {
    const sql = document.getElementById("editor").value;

    const res = await fetch(API + "/execute", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ sql })
    });

    const data = await res.json();

    renderOutput(data);
    loadTables();
}


function renderOutput(data) {
    const out = document.getElementById("output");

    let text = "";

    if (data.lint && data.lint.errors.length > 0) {
        text += "ERRORS:\n";
        data.lint.errors.forEach(e => {
            text += `Line ${e.line}: ${e.message}\n`;
        });
        text += "\n";
    }

    if (data.result) {
        if (data.result.type === "select") {
            text += "RESULT:\n";
            text += data.result.columns.join(" | ") + "\n";
            text += "-".repeat(40) + "\n";

            data.result.rows.forEach(r => {
                text += r.join(" | ") + "\n";
            });
        } else {
            text += `Rows affected: ${data.result.rows_affected}`;
        }
    }

    if (data.error) {
        text += "\nRUNTIME ERROR:\n" + data.error;
    }

    out.textContent = text;
}


async function loadTables() {
    const res = await fetch(API + "/tables");
    const tables = await res.json();

    const div = document.getElementById("tables");

    div.innerHTML = "<b>Tables:</b> " + tables.join(" | ");
}


window.onload = () => {
    loadTables();
};