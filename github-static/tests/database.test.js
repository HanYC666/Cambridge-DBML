import { describe, expect, it } from "vitest";
import initSqlJs from "sql.js";
import { BrowserDatabase, isCambridgeOnlyStatement, splitSqlStatements } from "../assets/js/sql-engine.js";

globalThis.initSqlJs = (options = {}) => initSqlJs({
    ...options,
    locateFile: () => new URL("../assets/vendor/sql-wasm.wasm", import.meta.url).pathname
});

describe("browser database helpers", () => {
    it("splits semicolons outside quoted strings", () => {
        expect(splitSqlStatements("INSERT INTO T VALUES ('a; b'); SELECT * FROM T;")).toEqual([
            "INSERT INTO T VALUES ('a; b')",
            "SELECT * FROM T"
        ]);
    });
    it("recognises validated-only Cambridge database statements", () => {
        expect(isCambridgeOnlyStatement("CREATE DATABASE School")).toBe(true);
        expect(isCambridgeOnlyStatement("CREATE DATABASE School; DROP TABLE T")).toBe(false);
    });
});

describe.runIf(typeof globalThis.initSqlJs === "function")("browser database runtime", () => {
    it("executes writes and selects transactionally", async () => {
        const db = await BrowserDatabase.createEmpty();
        expect(db.execute("CREATE TABLE T (ID INTEGER, Name VARCHAR(20)); INSERT INTO T VALUES (1, 'A;B');")).toMatchObject({ type: "write", statements_run: 2 });
        expect(db.execute("SELECT * FROM T;")).toMatchObject({ type: "select", columns: ["ID", "Name"], rows: [[1, "A;B"]] });
        expect(() => db.execute("INSERT INTO T VALUES (2, 'ok'); INSERT INTO Missing VALUES (1, 'bad');")).toThrow();
        expect(db.execute("CREATE DATABASE School;")).toMatchObject({ type: "validated_only" });
        expect(db.getTables()).toEqual(["T"]);
        expect(db.fetchTable("T").rows).toEqual([[1, "A;B"]]);
        expect(() => db.fetchTable("not-valid!")).toThrow("not a valid table name");
    });
});
