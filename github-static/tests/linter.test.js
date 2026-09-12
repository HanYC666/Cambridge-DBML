import { describe, expect, it } from "vitest";
import { lintCambridgeSql } from "../assets/js/linter.js";

describe("Cambridge linter", () => {
    it("returns no diagnostics for empty SQL", () => expect(lintCambridgeSql(" ")).toEqual({ errors: [], warnings: [] }));
    it("flags forbidden types and missing semicolons", () => {
        const result = lintCambridgeSql("CREATE TABLE Student (ID INT, Name TEXT)");
        expect(result.errors.map((item) => item.message)).toEqual(expect.arrayContaining([
            "Use the Cambridge 9618 datatype instead: INTEGER",
            "Use the Cambridge 9618 datatype instead: VARCHAR(n)",
            "Statement is missing its terminating semicolon (;)."
        ]));
    });
    it("requires lengths and Cambridge key syntax", () => {
        const result = lintCambridgeSql("CREATE TABLE T (Name VARCHAR, PRIMARY KEY ID, FOREIGN KEY (X));");
        expect(result.errors.map((item) => item.message)).toEqual(expect.arrayContaining([
            "VARCHAR must specify a length, e.g. VARCHAR(20).",
            "PRIMARY KEY must be written as: PRIMARY KEY (field)",
            "FOREIGN KEY must be written as: FOREIGN KEY (field) REFERENCES Table(Field)"
        ]));
    });
    it("warns about out-of-syllabus syntax, literals, and table count", () => {
        const result = lintCambridgeSql("SELECT * FROM A, B, C WHERE Name = Smith LIMIT 1;");
        expect(result.warnings.map((item) => item.message)).toEqual(expect.arrayContaining([
            expect.stringContaining("'LIMIT' is not part"),
            expect.stringContaining("'Smith' after '=' looks"),
            expect.stringContaining("more than two")
        ]));
    });
});
