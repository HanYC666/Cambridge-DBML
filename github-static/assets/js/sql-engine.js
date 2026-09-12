const IDENTIFIER_RE = /^[A-Za-z][A-Za-z0-9_]*$/;
const CREATE_DATABASE_RE = /^\s*CREATE\s+DATABASE\s+[A-Za-z][A-Za-z0-9_]*\s*$/i;

export function splitSqlStatements(sql) {
    const statements = [];
    let current = [];
    let inSingleQuote = false;
    for (let index = 0; index < sql.length; index += 1) {
        const char = sql[index];
        if (char === "'") {
            if (inSingleQuote && sql[index + 1] === "'") {
                current.push("'", "'");
                index += 1;
                continue;
            }
            inSingleQuote = !inSingleQuote;
        }
        if (char === ";" && !inSingleQuote) {
            const statement = current.join("").trim();
            if (statement) statements.push(statement);
            current = [];
        } else {
            current.push(char);
        }
    }
    const tail = current.join("").trim();
    if (tail) statements.push(tail);
    return statements;
}

export function isCambridgeOnlyStatement(statement) {
    return CREATE_DATABASE_RE.test(statement.trim());
}

async function loadSqlModule() {
    if (typeof globalThis.initSqlJs !== "function") {
        throw new Error("The local SQLite WASM runtime is not loaded.");
    }
    return globalThis.initSqlJs({ locateFile: (file) => `assets/vendor/${file}` });
}

export class BrowserDatabase {
    constructor(db) {
        this.db = db;
        this.revision = 0;
    }

    static async createEmpty() {
        const SQL = await loadSqlModule();
        return new BrowserDatabase(new SQL.Database());
    }

    static async fromBytes(bytes) {
        const SQL = await loadSqlModule();
        return new BrowserDatabase(new SQL.Database(new Uint8Array(bytes)));
    }

    execute(sql) {
        const statements = splitSqlStatements(sql);
        if (!statements.length) return { type: "write", rows_affected: 0, statements_run: 0 };
        if (statements.every(isCambridgeOnlyStatement)) {
            return {
                type: "validated_only",
                message: "This is valid Cambridge 9618 syntax, but SQLite does not execute CREATE DATABASE within this practice environment.",
                statements_run: 0
            };
        }
        if (statements.some(isCambridgeOnlyStatement)) {
            throw new Error("CREATE DATABASE cannot be combined with executable statements in one script.");
        }

        let rowsAffected = 0;
        let lastSelect = null;
        let wroteDatabase = false;
        this.db.run("BEGIN");
        try {
            for (const statement of statements) {
                if (statement.trimStart().toLowerCase().startsWith("select")) {
                    const result = this.db.exec(statement);
                    if (result.length) lastSelect = { columns: result[0].columns, rows: result[0].values };
                } else {
                    this.db.run(statement);
                    rowsAffected += this.db.getRowsModified();
                    wroteDatabase = true;
                }
            }
            this.db.run("COMMIT");
        } catch (error) {
            try { this.db.run("ROLLBACK"); } catch (_rollbackError) { /* preserve original error */ }
            throw error;
        }

        if (wroteDatabase) this.revision += 1;

        if (lastSelect) return { type: "select", ...lastSelect, statements_run: statements.length };
        return { type: "write", rows_affected: rowsAffected, statements_run: statements.length };
    }

    getTables() {
        const result = this.db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
        return result.length ? result[0].values.map((row) => row[0]) : [];
    }

    fetchTable(tableName) {
        if (!IDENTIFIER_RE.test(tableName)) throw new Error(`'${tableName}' is not a valid table name.`);
        if (!this.getTables().includes(tableName)) throw new Error(`Table '${tableName}' does not exist.`);
        const escapedName = `"${tableName.replaceAll('"', '""')}"`;
        const result = this.db.exec(`SELECT * FROM ${escapedName}`);
        return result.length ? { columns: result[0].columns, rows: result[0].values } : { columns: [], rows: [] };
    }

    exportBytes() {
        return this.db.export();
    }
}
