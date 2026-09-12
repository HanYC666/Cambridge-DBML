import { lintCambridgeSql } from "./linter.js";

export class BrowserExecutor {
    constructor(database, storage = null) {
        this.database = database;
        this.storage = storage;
    }

    async run(sql, { runAnyway = false } = {}) {
        const lint = lintCambridgeSql(sql);
        if (lint.errors.length && !runAnyway) {
            return {
                success: false,
                blocked_by_lint: true,
                lint,
                result: null,
                error: "Execution blocked because the SQL has Cambridge 9618 lint errors."
            };
        }
        try {
            const revisionBefore = this.database.revision;
            const result = this.database.execute(sql);
            const databaseChanged = typeof revisionBefore === "number"
                ? this.database.revision !== revisionBefore
                : result.type === "write" && result.statements_run > 0;
            let persistenceError = null;
            if (databaseChanged && this.storage) {
                try { await this.storage.autosave(this.database); }
                catch (error) { persistenceError = error.message || String(error); }
            }
            return { success: true, blocked_by_lint: false, lint, result, ...(persistenceError ? { persistence_error: persistenceError } : {}) };
        } catch (error) {
            return { success: false, blocked_by_lint: false, lint, error: error.message || String(error) };
        }
    }

    tables() { return this.database.getTables(); }
    table(name) { return this.database.fetchTable(name); }
}
