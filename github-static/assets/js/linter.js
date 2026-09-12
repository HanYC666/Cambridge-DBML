const FORBIDDEN_TYPES = [
    [/\bINT\b(?!EGER)/gi, "INTEGER"],
    [/\bTEXT\b/gi, "VARCHAR(n)"],
    [/\bNUMBER\b/gi, "INTEGER or REAL"],
    [/\bDATETIME\b/gi, "DATE or TIME"],
    [/\bBIT\b/gi, "BOOLEAN"],
    [/\bFLOAT\b/gi, "REAL"],
    [/\bDOUBLE\b/gi, "REAL"],
    [/\bSTRING\b/gi, "VARCHAR(n) or CHARACTER(n)"],
    [/\bBOOL\b/gi, "BOOLEAN"],
    [/\bVARCHAR2\b/gi, "VARCHAR(n)"]
];

const OUT_OF_SYLLABUS = [
    [/\bLEFT\s+JOIN\b/gi, "LEFT JOIN"], [/\bRIGHT\s+JOIN\b/gi, "RIGHT JOIN"],
    [/\bFULL\s+(OUTER\s+)?JOIN\b/gi, "FULL (OUTER) JOIN"], [/\bCROSS\s+JOIN\b/gi, "CROSS JOIN"],
    [/\bOUTER\s+JOIN\b/gi, "OUTER JOIN"], [/\bUNION\s+ALL\b/gi, "UNION ALL"],
    [/\bUNION\b/gi, "UNION"], [/\bHAVING\b/gi, "HAVING"], [/\bLIMIT\b/gi, "LIMIT"],
    [/\bOFFSET\b/gi, "OFFSET"], [/\bTOP\s*\(/gi, "TOP(n)"], [/\bDISTINCT\b/gi, "DISTINCT"],
    [/\bAUTO_?INCREMENT\b/gi, "AUTO_INCREMENT"], [/\bIDENTITY\b/gi, "IDENTITY"],
    [/\bCREATE\s+INDEX\b/gi, "CREATE INDEX"], [/\bCREATE\s+VIEW\b/gi, "CREATE VIEW"],
    [/\bDROP\s+/gi, "DROP ..."], [/\bTRUNCATE\b/gi, "TRUNCATE"]
];

const STATEMENT_START = /^(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE|CREATE\s+DATABASE|ALTER\s+TABLE)\b/i;

function lineOf(sql, index) {
    return sql.slice(0, index).split("\n").length;
}

function splitLintStatements(sql) {
    const statements = [];
    let start = 0;
    for (let index = 0; index < sql.length; index += 1) {
        if (sql[index] !== ";") continue;
        const chunk = sql.slice(start, index);
        if (chunk.trim()) statements.push({ text: chunk, line: lineOf(sql, start), terminated: true });
        start = index + 1;
    }
    const tail = sql.slice(start);
    if (tail.trim()) statements.push({ text: tail, line: lineOf(sql, start), terminated: false });
    return statements;
}

export function lintCambridgeSql(sqlCode) {
    const errors = [];
    const warnings = [];
    if (!sqlCode || !sqlCode.trim()) return { errors, warnings };

    for (const part of splitLintStatements(sqlCode)) {
        const clean = part.text.trim();
        if (!clean || clean.startsWith("--")) continue;
        if (!part.terminated) errors.push({ line: part.line, message: "Statement is missing its terminating semicolon (;)." });

        for (const [pattern, replacement] of FORBIDDEN_TYPES) {
            if (pattern.test(clean)) {
                pattern.lastIndex = 0;
                errors.push({ line: part.line, message: `Use the Cambridge 9618 datatype instead: ${replacement}` });
            }
            pattern.lastIndex = 0;
        }

        for (const typeName of ["VARCHAR", "CHARACTER"]) {
            const typePattern = new RegExp(`\\b${typeName}\\b`, "gi");
            for (const match of clean.matchAll(typePattern)) {
                const after = clean.slice(match.index + match[0].length, match.index + match[0].length + 6).trimStart();
                if (!after.startsWith("(")) errors.push({ line: part.line, message: `${typeName} must specify a length, e.g. ${typeName}(20).` });
            }
        }

        if (/\bPRIMARY\s+KEY\b/i.test(clean) && !/PRIMARY\s+KEY\s*\(\s*\w+\s*\)/i.test(clean)) {
            errors.push({ line: part.line, message: "PRIMARY KEY must be written as: PRIMARY KEY (field)" });
        }
        if (/\bFOREIGN\s+KEY\b/i.test(clean) && !/FOREIGN\s+KEY\s*\(\s*\w+\s*\)\s*REFERENCES\s+\w+\s*\(\s*\w+\s*\)/i.test(clean)) {
            errors.push({ line: part.line, message: "FOREIGN KEY must be written as: FOREIGN KEY (field) REFERENCES Table(Field)" });
        }
        if (/^CREATE\s+TABLE\b/i.test(clean)) {
            if ((clean.match(/\(/g) || []).length !== (clean.match(/\)/g) || []).length) {
                errors.push({ line: part.line, message: "CREATE TABLE has mismatched brackets." });
            }
            if (!clean.includes("(")) errors.push({ line: part.line, message: "CREATE TABLE must define its fields in brackets, e.g. CREATE TABLE T (Field1 INTEGER, ...)." });
        }

        for (const match of clean.matchAll(/(?<![<>!])=\s*([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)?)/g)) {
            const token = match[1];
            if (token.includes(".")) continue;
            if (!["NULL", "TRUE", "FALSE"].includes(token.toUpperCase()) && !/^\d+$/.test(token)) {
                warnings.push({ line: part.line, message: `'${token}' after '=' looks like a text/date value — Cambridge SQL requires single quotes, e.g. '${token}'.` });
            }
        }

        for (const [pattern, label] of OUT_OF_SYLLABUS) {
            if (pattern.test(clean)) {
                pattern.lastIndex = 0;
                warnings.push({ line: part.line, message: `'${label}' is not part of the CIE 9618 DDL/DML subset (8.3) — it may run here but is unlikely to be expected or credited in an exam answer.` });
            }
            pattern.lastIndex = 0;
        }

        if (/^SELECT\b/i.test(clean)) {
            const fromMatch = clean.match(/\bFROM\b(.*?)(?:\bWHERE\b|\bGROUP BY\b|\bORDER BY\b|$)/is);
            if (fromMatch) {
                const tablesClause = fromMatch[1];
                const tableCount = 1 + (tablesClause.match(/\bJOIN\b/gi) || []).length + (tablesClause.match(/,/g) || []).length;
                if (tableCount > 2) warnings.push({ line: part.line, message: "CIE 9618 DML questions restrict scripts to at most two tables — this query references more than two." });
            }
        }
        if (!STATEMENT_START.test(clean)) warnings.push({ line: part.line, message: "Statement does not start with a recognised CIE 9618 DDL/DML command." });
    }
    return { errors, warnings };
}

export { FORBIDDEN_TYPES, OUT_OF_SYLLABUS, splitLintStatements };
