# Cambridge-DBML Practice Platform

Cambridge-DBML is an interactive SQL practice platform built for **Cambridge International AS & A Level Computer Science (9618)**, Section 8.3. It combines a Cambridge-focused SQL linter with a local SQLite-backed practice environment so students can write exam-style DDL and DML, receive immediate feedback, and inspect the resulting database state.

## About

Standard SQL engines such as SQLite, MySQL, and PostgreSQL are much more permissive than Cambridge exam expectations. They commonly accept:

- non-Cambridge datatypes such as `INT` or `TEXT`
- missing semicolons
- out-of-syllabus features such as `LIMIT` or `LEFT JOIN`
- structures that may run in SQL engines but would be marked wrong in a Cambridge answer

Cambridge-DBML narrows that gap by linting SQL against Cambridge-oriented rules before execution and surfacing warnings and errors in a dedicated learning interface.

## Current Capabilities

### Cambridge-focused linting

The linter checks for Cambridge-specific issues including:

- Cambridge-recognized datatypes only: `INTEGER`, `REAL`, `CHARACTER(n)`, `VARCHAR(n)`, `BOOLEAN`, `DATE`, `TIME`
- forbidden common aliases such as `INT`, `FLOAT`, `TEXT`, `STRING`, `BOOL`, and `DATETIME`
- missing statement semicolons
- malformed `PRIMARY KEY` and `FOREIGN KEY ... REFERENCES ...` syntax
- missing lengths for `VARCHAR` and `CHARACTER`
- likely missing quotes around text and date literals
- out-of-syllabus constructs such as `LIMIT`, `UNION`, `DISTINCT`, and non-Cambridge join variants
- warnings when a `SELECT` query appears to use more than two tables

### Execution behavior

The execution flow is now intentionally strict by default:

- SQL with Cambridge lint errors is **blocked from execution** unless explicitly retried with `run_anyway`
- Cambridge-valid but SQLite-non-executable statements such as `CREATE DATABASE School;` are treated as **validated-only** successes
- multi-statement SQL scripts execute **transactionally**
- later failures in a script roll back earlier writes from the same script
- semicolons inside single-quoted strings do not split statements incorrectly

### Frontend

The frontend provides:

- a browser-based SQL workspace
- clear lint diagnostics and runtime feedback
- a live database viewer for current tables and rows
- a dedicated syntax reference page generated from backend-owned reference data
- keyboard shortcut support for running SQL with `Ctrl` + `Enter`

## Project Structure

- `app.py`: Flask server and HTTP API routes
- `executor.py`: lint-aware execution coordinator
- `database.py`: SQLite execution, script splitting, transactional behavior, and table inspection
- `linter.py`: Cambridge SQL linting rules and syntax reference source data
- `frontend/`: vanilla HTML, CSS, and JavaScript UI
- `tests/`: automated regression tests
- `workspace/`: local SQLite database location, including `workspace/current.db`
- `venv/`: project-local Python virtual environment

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/HanYC666/Cambridge-DBML.git
cd Cambridge-DBML
```

### 2. Create the project-local virtual environment

Use a local virtual environment at `venv/`.

```bash
python -m venv venv
```

Activate it:

Linux / macOS:

```bash
source venv/bin/activate
```

Windows:

```bash
venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Run the application

```bash
venv/bin/python app.py
```

If your shell already has the virtual environment activated, `python app.py` is also fine.

### 5. Open the app

Visit:

- `http://127.0.0.1:5000/` for the SQL workspace
- `http://127.0.0.1:5000/syntax` for the syntax reference

## API Endpoints

### `POST /api/execute`

Execute SQL through the Cambridge-aware workflow.

Request body:

```json
{
  "sql": "SELECT * FROM Student;",
  "run_anyway": false
}
```

Behavior:

- returns HTTP `400` if the request body is not a JSON object
- returns HTTP `400` if `sql` is missing or not a string
- returns `blocked_by_lint: true` when lint errors prevent execution
- returns a `validated_only` result for supported Cambridge-only statements such as `CREATE DATABASE`

Example response shape:

```json
{
  "success": true,
  "blocked_by_lint": false,
  "lint": {
    "errors": [],
    "warnings": []
  },
  "result": {
    "type": "select",
    "columns": ["StudentID", "Name"],
    "rows": [[1, "Amina"]],
    "statements_run": 1
  }
}
```

Blocked example:

```json
{
  "success": false,
  "blocked_by_lint": true,
  "lint": {
    "errors": [
      {
        "line": 1,
        "message": "Use the Cambridge 9618 datatype instead: VARCHAR(n)"
      }
    ],
    "warnings": []
  },
  "result": null,
  "error": "Execution blocked because the SQL has Cambridge 9618 lint errors."
}
```

### `GET /api/tables`

Returns the list of current table names.

### `GET /api/table/<name>`

Returns the selected table's columns and rows.

Invalid or unknown table names return HTTP `400` with a JSON error body.

### `GET /api/syntax`

Returns the syntax reference data used by the `/syntax` page.

## Testing

Run the regression suite with the project-local virtual environment:

```bash
venv/bin/python -m unittest discover -s tests
```

The current test suite covers:

- linter error and warning behavior
- lint-blocked execution
- `run_anyway` execution path
- validated-only `CREATE DATABASE` handling
- transactional rollback behavior
- malformed API request handling

## Notes

- The backend uses SQLite as a practice engine, but the learning goal is Cambridge-style SQL correctness rather than generic SQL portability.
- Some Cambridge-valid syntax may be accepted as validated-only rather than executed directly if SQLite cannot represent it meaningfully in this environment.
- The interface is intentionally low-motion and productivity-focused.

## License & Warranty

> Disclaimer: This software comes with **ABSOLUTE NO WARRANTY**.

- Open source: you may redistribute, modify, and use this software, but it must remain fully open-source.
- Attribution: credit the original creator, **HanYC666**, when posting, publishing, or distributing this program or derived variants.
