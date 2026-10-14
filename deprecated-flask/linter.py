"""
Cambridge International AS & A Level Computer Science 9618, section 8.3
(Data Definition Language / Data Manipulation Language) syntax linter.

Only the subset of SQL named in the syllabus is treated as "safe" for
strict exam-style marking. Anything outside that subset is flagged as
a warning (it may still run on SQLite, but examiners would not expect
or necessarily credit it), and anything that is flat-out wrong for
CIE (wrong datatype name, malformed key clause, missing quotes,
missing semicolon) is flagged as an error.
"""

import re

# ---------------------------------------------------------------------------
# 8.3 DDL / DML command word whitelist (syllabus wording, case-insensitive)
# ---------------------------------------------------------------------------

DDL_KEYWORDS = [
    'CREATE DATABASE', 'CREATE TABLE', 'ALTER TABLE', 'ADD',
    'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'NOT NULL',
]

DML_KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'ORDER BY', 'GROUP BY', 'INNER JOIN', 'ON',
    'SUM', 'COUNT', 'AVG',
    'INSERT INTO', 'VALUES', 'DELETE FROM', 'UPDATE', 'SET',
]

# CIE only names these seven datatypes for 8.3 CREATE TABLE statements.
ALLOWED_TYPES = ['INTEGER', 'REAL', 'CHARACTER', 'VARCHAR', 'BOOLEAN', 'DATE', 'TIME']

FORBIDDEN_TYPES = {
    r'\bINT\b(?!EGER)': 'INTEGER',
    r'\bTEXT\b': 'VARCHAR(n)',
    r'\bNUMBER\b': 'INTEGER or REAL',
    r'\bDATETIME\b': 'DATE or TIME',
    r'\bBIT\b': 'BOOLEAN',
    r'\bFLOAT\b': 'REAL',
    r'\bDOUBLE\b': 'REAL',
    r'\bSTRING\b': 'VARCHAR(n) or CHARACTER(n)',
    r'\bBOOL\b': 'BOOLEAN',
    r'\bVARCHAR2\b': 'VARCHAR(n)',
}

# ---------------------------------------------------------------------------
# Syntax reference data -- powers the "/syntax" page in the frontend.
# This is the single source of truth: the same keywords enforced above are
# documented here, so the reference page and the linter can't drift apart.
# ---------------------------------------------------------------------------

SYNTAX_REFERENCE = [
    # ---- DDL ---------------------------------------------------------
    {
        "category": "DDL",
        "name": "CREATE DATABASE",
        "summary": "Creates a new, empty database.",
        "syntax": "CREATE DATABASE database_name;",
        "example": "CREATE DATABASE Rentals;",
        "notes": "Rarely asked for marks on its own — usually appears as one line in a larger DDL script."
    },
    {
        "category": "DDL",
        "name": "CREATE TABLE",
        "summary": "Defines a new table: its field names, datatypes, and constraints (primary key, foreign key, NOT NULL).",
        "syntax": (
            "CREATE TABLE TableName\n"
            "(\n"
            "    Field1 DATATYPE,\n"
            "    Field2 DATATYPE NOT NULL,\n"
            "    ...\n"
            "    PRIMARY KEY (Field1),\n"
            "    FOREIGN KEY (Field2) REFERENCES OtherTable(Field)\n"
            ");"
        ),
        "example": (
            "CREATE TABLE Customer\n"
            "(\n"
            "    CustomerID INTEGER,\n"
            "    Name VARCHAR(30) NOT NULL,\n"
            "    JoinDate DATE,\n"
            "    PRIMARY KEY (CustomerID)\n"
            ");"
        ),
        "notes": "Field list must be inside matching brackets, comma-separated. Keys are defined as their own lines at the end."
    },
    {
        "category": "DDL",
        "name": "ALTER TABLE ... ADD",
        "summary": "Adds a new field to an existing table.",
        "syntax": "ALTER TABLE TableName ADD FieldName DATATYPE;",
        "example": "ALTER TABLE Customer ADD PhoneNumber VARCHAR(15);",
        "notes": "Only ADD is in the 9618 subset — DROP COLUMN / MODIFY are not expected."
    },
    {
        "category": "DDL",
        "name": "PRIMARY KEY",
        "summary": "Declares the field (or fields) that uniquely identify each row in the table.",
        "syntax": "PRIMARY KEY (FieldName)",
        "example": "PRIMARY KEY (CustomerID)",
        "notes": "Must use exactly this form inside the CREATE TABLE brackets — not a separate statement."
    },
    {
        "category": "DDL",
        "name": "FOREIGN KEY",
        "summary": "Declares a field that links to the primary key of another table, enforcing referential integrity.",
        "syntax": "FOREIGN KEY (FieldName) REFERENCES OtherTable(OtherField)",
        "example": "FOREIGN KEY (CustomerID) REFERENCES Customer(CustomerID)",
        "notes": "The REFERENCES clause is required — 'FOREIGN KEY (field)' on its own is incomplete and will be marked wrong."
    },
    {
        "category": "DDL",
        "name": "NOT NULL",
        "summary": "Forces a field to always have a value — it cannot be left empty.",
        "syntax": "FieldName DATATYPE NOT NULL",
        "example": "Name VARCHAR(30) NOT NULL",
        "notes": "Written directly after the datatype, inside the CREATE TABLE field list."
    },
    {
        "category": "DDL",
        "name": "Data types",
        "summary": "The only datatype names CIE 9618 recognises for CREATE TABLE fields.",
        "syntax": "INTEGER | REAL | CHARACTER(n) | VARCHAR(n) | BOOLEAN | DATE | TIME",
        "example": "Price REAL, Code CHARACTER(5), Description VARCHAR(50)",
        "notes": "Do NOT use INT, FLOAT, TEXT, STRING, BOOL, DATETIME, NUMBER — these are common non-Cambridge names the linter will flag."
    },

    # ---- DML: queries --------------------------------------------------
    {
        "category": "DML",
        "name": "SELECT ... FROM",
        "summary": "Retrieves fields from a table. Use * to retrieve all fields.",
        "syntax": "SELECT Field1, Field2 FROM TableName;",
        "example": "SELECT Name, JoinDate FROM Customer;",
        "notes": "Every query starts with SELECT and FROM — they're the only compulsory clauses."
    },
    {
        "category": "DML",
        "name": "WHERE",
        "summary": "Filters rows so only those matching a condition are returned.",
        "syntax": "SELECT ... FROM TableName WHERE condition;",
        "example": "SELECT * FROM Customer WHERE JoinDate > '2024-01-01';",
        "notes": "Text and date literals MUST be in single quotes, e.g. WHERE Name = 'Smith'. Numbers are not quoted."
    },
    {
        "category": "DML",
        "name": "ORDER BY",
        "summary": "Sorts the result set by one or more fields, ascending by default.",
        "syntax": "SELECT ... FROM TableName ORDER BY Field [ASC|DESC];",
        "example": "SELECT * FROM Customer ORDER BY Name ASC;",
        "notes": "Goes after WHERE (if present)."
    },
    {
        "category": "DML",
        "name": "GROUP BY",
        "summary": "Groups rows that share the same value in a field, typically for use with SUM/COUNT/AVG.",
        "syntax": "SELECT Field, AggregateFunction(...) FROM TableName GROUP BY Field;",
        "example": "SELECT CustomerID, COUNT(*) FROM Rental GROUP BY CustomerID;",
        "notes": "Every non-aggregated field in SELECT should appear in GROUP BY."
    },
    {
        "category": "DML",
        "name": "INNER JOIN ... ON",
        "summary": "Combines rows from two tables where a related field matches in both.",
        "syntax": "SELECT ... FROM TableA INNER JOIN TableB ON TableA.Field = TableB.Field;",
        "example": (
            "SELECT Customer.Name, Rental.MonthlyCost\n"
            "FROM Customer INNER JOIN Rental\n"
            "ON Customer.CustomerID = Rental.CustomerID;"
        ),
        "notes": "9618 scripts are limited to at most two tables. LEFT/RIGHT/FULL/OUTER/CROSS JOIN are outside the syllabus subset."
    },
    {
        "category": "DML",
        "name": "SUM / COUNT / AVG",
        "summary": "Aggregate functions: total a numeric field, count rows, or average a numeric field.",
        "syntax": "SELECT SUM(Field) | COUNT(Field) | AVG(Field) FROM TableName;",
        "example": "SELECT AVG(MonthlyCost) FROM Rental;",
        "notes": "COUNT(*) counts rows regardless of NULLs; COUNT(Field) ignores NULLs in that field."
    },

    # ---- DML: data maintenance ------------------------------------------
    {
        "category": "DML",
        "name": "INSERT INTO ... VALUES",
        "summary": "Adds a new row to a table.",
        "syntax": "INSERT INTO TableName (Field1, Field2) VALUES (Value1, Value2);",
        "example": "INSERT INTO Customer (CustomerID, Name, JoinDate) VALUES (1, 'Smith', '2024-01-01');",
        "notes": "Text/date values in quotes; number of values must match the field list, in the same order."
    },
    {
        "category": "DML",
        "name": "DELETE FROM",
        "summary": "Removes rows from a table that match a condition.",
        "syntax": "DELETE FROM TableName WHERE condition;",
        "example": "DELETE FROM Customer WHERE CustomerID = 1;",
        "notes": "Omitting WHERE deletes every row in the table — always double-check the condition."
    },
    {
        "category": "DML",
        "name": "UPDATE ... SET",
        "summary": "Changes existing values in one or more fields for rows that match a condition.",
        "syntax": "UPDATE TableName SET Field1 = Value1 WHERE condition;",
        "example": "UPDATE Customer SET Name = 'Smyth' WHERE CustomerID = 1;",
        "notes": "Like DELETE, a missing WHERE clause updates every row in the table."
    },
]


# SQL that is valid in SQLite/MySQL/etc. but sits outside the 9618 DDL/DML
# subset. Not wrong in the real world -- just not what a mark scheme expects.
OUT_OF_SYLLABUS = {
    r'\bLEFT\s+JOIN\b': 'LEFT JOIN',
    r'\bRIGHT\s+JOIN\b': 'RIGHT JOIN',
    r'\bFULL\s+(OUTER\s+)?JOIN\b': 'FULL (OUTER) JOIN',
    r'\bCROSS\s+JOIN\b': 'CROSS JOIN',
    r'\bOUTER\s+JOIN\b': 'OUTER JOIN',
    r'\bUNION\s+ALL\b': 'UNION ALL',
    r'\bUNION\b': 'UNION',
    r'\bHAVING\b': 'HAVING',
    r'\bLIMIT\b': 'LIMIT',
    r'\bOFFSET\b': 'OFFSET',
    r'\bTOP\s*\(': 'TOP(n)',
    r'\bDISTINCT\b': 'DISTINCT',
    r'\bAUTO_?INCREMENT\b': 'AUTO_INCREMENT',
    r'\bIDENTITY\b': 'IDENTITY',
    r'\bCREATE\s+INDEX\b': 'CREATE INDEX',
    r'\bCREATE\s+VIEW\b': 'CREATE VIEW',
    r'\bDROP\s+': 'DROP ...',
    r'\bTRUNCATE\b': 'TRUNCATE',
}

STATEMENT_START = re.compile(
    r'^(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE|'
    r'CREATE\s+DATABASE|ALTER\s+TABLE)\b',
    re.IGNORECASE,
)


def _line_of(sql: str, char_index: int) -> int:
    """1-indexed line number for a character offset in the full script."""
    return sql.count('\n', 0, char_index) + 1


def _split_statements(sql: str):
    """
    Split a script into individual statements on ';', while tracking the
    line number each statement starts on. Naive on purpose (no string-aware
    scanning) since CIE scripts don't require semicolons inside literals
    to be handled specially at this level.
    """
    statements = []
    start = 0
    for match in re.finditer(r';', sql):
        end = match.start()
        chunk = sql[start:end]
        if chunk.strip():
            statements.append((chunk, _line_of(sql, start), True))  # terminated
        start = end + 1
    tail = sql[start:]
    if tail.strip():
        statements.append((tail, _line_of(sql, start), False))  # not terminated
    return statements


def lint_cambridge_sql(sql_code: str):
    errors = []
    warnings = []

    if not sql_code or not sql_code.strip():
        return {"errors": errors, "warnings": warnings}

    statements = _split_statements(sql_code)

    for stmt_text, line_no, terminated in statements:
        clean = stmt_text.strip()
        if not clean or clean.startswith('--'):
            continue

        # --- missing semicolon (per statement, not just end of script) ---
        if not terminated:
            errors.append({
                "line": line_no,
                "message": "Statement is missing its terminating semicolon (;)."
            })

        # --- forbidden datatypes ---
        for pattern, replacement in FORBIDDEN_TYPES.items():
            if re.search(pattern, clean, re.IGNORECASE):
                errors.append({
                    "line": line_no,
                    "message": f"Use the Cambridge 9618 datatype instead: {replacement}"
                })

        # --- VARCHAR/CHARACTER must specify a length, e.g. VARCHAR(20) ---
        for type_name in ('VARCHAR', 'CHARACTER'):
            for m in re.finditer(rf'\b{type_name}\b', clean, re.IGNORECASE):
                after = clean[m.end():m.end() + 6].lstrip()
                if not after.startswith('('):
                    errors.append({
                        "line": line_no,
                        "message": f"{type_name} must specify a length, e.g. {type_name}(20)."
                    })

        # --- PRIMARY KEY syntax: PRIMARY KEY (field) ---
        if re.search(r'\bPRIMARY\s+KEY\b', clean, re.IGNORECASE):
            if not re.search(r'PRIMARY\s+KEY\s*\(\s*\w+\s*\)', clean, re.IGNORECASE):
                errors.append({
                    "line": line_no,
                    "message": "PRIMARY KEY must be written as: PRIMARY KEY (field)"
                })

        # --- FOREIGN KEY syntax: FOREIGN KEY (field) REFERENCES Table(Field) ---
        if re.search(r'\bFOREIGN\s+KEY\b', clean, re.IGNORECASE):
            if not re.search(
                r'FOREIGN\s+KEY\s*\(\s*\w+\s*\)\s*REFERENCES\s+\w+\s*\(\s*\w+\s*\)',
                clean, re.IGNORECASE
            ):
                errors.append({
                    "line": line_no,
                    "message": ("FOREIGN KEY must be written as: "
                                "FOREIGN KEY (field) REFERENCES Table(Field)")
                })

        # --- CREATE TABLE ... must have matching brackets and a field list ---
        if re.match(r'^CREATE\s+TABLE\b', clean, re.IGNORECASE):
            if clean.count('(') != clean.count(')'):
                errors.append({
                    "line": line_no,
                    "message": "CREATE TABLE has mismatched brackets."
                })
            if '(' not in clean:
                errors.append({
                    "line": line_no,
                    "message": ("CREATE TABLE must define its fields in brackets, "
                                "e.g. CREATE TABLE T (Field1 INTEGER, ...).")
                })

        # --- unquoted string/date literal heuristic ---
        # after '=' (not '<=', '>=', '<>') a bare word that isn't numeric,
        # NULL, TRUE/FALSE, or a qualified column reference (table.field —
        # common in ON clauses) is very likely a missing-quote bug.
        for m in re.finditer(
            r'(?<![<>!])=\s*([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)?)', clean
        ):
            token = m.group(1)
            token_upper = token.upper()
            if '.' in token:
                continue  # qualified column reference, e.g. b.id — not a literal
            if token_upper not in ('NULL', 'TRUE', 'FALSE') and not token_upper.isdigit():
                warnings.append({
                    "line": line_no,
                    "message": (f"'{token}' after '=' looks like a text/date value "
                                f"— Cambridge SQL requires single quotes, e.g. '{token}'.")
                })

        # --- statements outside the 9618 DDL/DML subset ---
        for pattern, label in OUT_OF_SYLLABUS.items():
            if re.search(pattern, clean, re.IGNORECASE):
                warnings.append({
                    "line": line_no,
                    "message": (f"'{label}' is not part of the CIE 9618 DDL/DML subset "
                                f"(8.3) — it may run here but is unlikely to be expected "
                                f"or credited in an exam answer.")
                })

        # --- DML scripts are limited to at most two tables (syllabus wording) ---
        if re.match(r'^SELECT\b', clean, re.IGNORECASE):
            from_match = re.search(
                r'\bFROM\b(.*?)(?:\bWHERE\b|\bGROUP BY\b|\bORDER BY\b|$)',
                clean, re.IGNORECASE | re.DOTALL
            )
            if from_match:
                tables_clause = from_match.group(1)
                joins = len(re.findall(r'\bJOIN\b', tables_clause, re.IGNORECASE))
                commas = tables_clause.count(',')
                table_count = 1 + joins + commas
                if table_count > 2:
                    warnings.append({
                        "line": line_no,
                        "message": ("CIE 9618 DML questions restrict scripts to at most "
                                    "two tables — this query references more than two.")
                    })

        # --- unrecognised leading keyword (not DDL/DML at all) ---
        if not STATEMENT_START.match(clean):
            warnings.append({
                "line": line_no,
                "message": "Statement does not start with a recognised CIE 9618 DDL/DML command."
            })

    return {
        "errors": errors,
        "warnings": warnings
    }
