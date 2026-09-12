import { describe, expect, it, vi } from "vitest";
import { BrowserExecutor } from "../assets/js/executor.js";

describe("browser executor", () => {
    it("blocks lint errors by default", async () => {
        const database = { execute: vi.fn() };
        const result = await new BrowserExecutor(database).run("CREATE TABLE T (ID INT);");
        expect(result.blocked_by_lint).toBe(true);
        expect(database.execute).not.toHaveBeenCalled();
    });
    it("allows an explicit run-anyway retry", async () => {
        const database = { execute: vi.fn(() => ({ type: "write", rows_affected: 0, statements_run: 1 })) };
        const result = await new BrowserExecutor(database).run("CREATE TABLE T (ID INT);", { runAnyway: true });
        expect(result.success).toBe(true);
        expect(database.execute).toHaveBeenCalledTimes(1);
    });
    it("autosaves a write followed by a select result", async () => {
        const database = {
            revision: 3,
            execute: vi.fn(function execute() {
                this.revision += 1;
                return { type: "select", columns: ["ID"], rows: [[1]], statements_run: 2 };
            })
        };
        const storage = { autosave: vi.fn().mockResolvedValue(true) };
        const result = await new BrowserExecutor(database, storage).run("INSERT INTO T VALUES (1); SELECT * FROM T;");
        expect(result.success).toBe(true);
        expect(storage.autosave).toHaveBeenCalledWith(database);
    });
});
