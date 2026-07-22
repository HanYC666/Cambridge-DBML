# GitHub Pages Static Website Implementation Plan

## Goal

Convert Cambridge-DBML from a Flask + SQLite web app into a fully static GitHub Pages site hosted at `custom_name.github.io`, while keeping all SQL linting, SQL execution, database viewing, and persistence on the client's computer.

The server must only host static assets: HTML, CSS, JavaScript, JSON, WASM, and optional static documentation. There will be no Flask server, no `/api/...` endpoints, and no server-side database.

## Current Codebase Summary

The current app has these moving parts:

- `app.py`: Flask routes for the frontend and JSON API.
- `executor.py`: combines Cambridge linting with database execution.
- `database.py`: wraps Python `sqlite3`, handles statement splitting, transactions, table listing, table reads, and `CREATE DATABASE` special handling.
- `linter.py`: Cambridge 9618 SQL linter plus `SYNTAX_REFERENCE`.
- `frontend/index.html`: workspace page.
- `frontend/syntax.html`: syntax reference page.
- `frontend/app.js`: calls `/api/execute`, `/api/tables`, and `/api/table/<name>`.
- `frontend/syntax.js`: calls `/api/syntax`.
- `frontend/style.css`: shared styling.
- `tests/`: Python regression tests for linter, executor, database, and Flask API behavior.

The frontend is already mostly static, but its data and execution behavior depend on Flask API endpoints. The static conversion is mainly a port of `linter.py`, `executor.py`, and `database.py` behavior into browser JavaScript.

## Critical Browser Storage Reality

The requested storage requirement is stricter than what ordinary browser storage can guarantee.

Storage options that are **not enough by themselves**:

- `localStorage`: tiny, string-only, can be cleared with site data/cache.
- `IndexedDB`: larger and useful, but still site storage; users can clear it.
- Cache API / service worker cache: cache storage; explicitly not permanent.
- OPFS / Origin Private File System: good for app-owned files, but still origin storage and can be cleared with site data.

To survive a user clearing browser cache/site data, the database must also be stored as a **real user-owned file outside browser-managed origin storage**.

Recommended persistence model:

1. Use a client-side SQLite engine in the page.
2. Let the user create or open a `.sqlite` or `.db` file using the browser's File System Access API where available.
3. After each successful write transaction, export the SQLite database bytes and write them back to that user-owned file.
4. Store the file handle in IndexedDB only as a convenience shortcut. If that handle is lost when site data is cleared, the database file still exists on disk and the user can reopen it.
5. For browsers without File System Access API support, provide explicit `Export Database` and `Import Database` controls. This fallback cannot silently autosave to the same file, but it can still keep a permanent copy if the user exports it.

This is the only practical static-site design that can honestly claim data can survive browser cache/site-data clearing.

## Target Architecture

Create a static app under `github-static/` that can be deployed directly to GitHub Pages.

Suggested directory structure:

```text
github-static/
  implementation_plan.md
  index.html
  syntax.html
  assets/
    css/
      style.css
    js/
      app.js
      syntax-page.js
      linter.js
      syntax-reference.js
      sql-engine.js
      storage.js
      executor.js
      html.js
    vendor/
      sql-wasm.js
      sql-wasm.wasm
  tests/
    linter.test.js
    database.test.js
    executor.test.js
  package.json
  vite.config.js
```

`vite` is optional, but useful for local development and tests. The deployed output must still be static.

## Client-Side SQLite Engine

Use `sql.js` for the first static implementation.

Reasons:

- Runs SQLite compiled to WebAssembly in the browser.
- Can load a database from a `Uint8Array`.
- Can export the complete database as bytes after changes.
- Works on static hosting.
- Maps closely to the current Python `sqlite3` behavior.

Tradeoff:

- The active database lives in memory while the page is open. Persistence requires exporting bytes to a file or browser storage.
- Large databases may become slower because the whole database is exported for saving.

Alternative for a later hardening pass:

- `wa-sqlite` with OPFS can be more efficient, but OPFS alone does not satisfy the permanent-file requirement. It would still need an export/open-file workflow for durable external backup.

## Persistence Design

Implement `assets/js/storage.js` with these responsibilities:

- Detect File System Access API support:
  - `window.showOpenFilePicker`
  - `window.showSaveFilePicker`
- Open an existing database file:
  - user chooses `.sqlite`, `.db`, or `.sqlite3`
  - read file bytes
  - pass bytes into the SQLite engine
- Create a new database file:
  - user chooses save location and filename
  - initialize empty SQLite database
  - write initial exported bytes to disk
- Autosave:
  - after successful write scripts, export database bytes
  - write bytes to the selected file handle
  - show a visible saved/unsaved/saving/error state in the UI
- Reconnect:
  - optionally store the file handle in IndexedDB for convenience
  - call `queryPermission()` / `requestPermission()` before reusing it
  - if unavailable because site data was cleared, ask the user to reopen the database file
- Fallback:
  - `Download Database` button using `Blob` + object URL
  - `Import Database` file input
  - warn that automatic permanent save requires a Chromium-style browser with File System Access API support

Do not present localStorage, IndexedDB, service worker cache, or OPFS as permanent storage.

## API Replacement Map

Replace every Flask API call with a browser module call.

Current:

```js
POST /api/execute
GET /api/tables
GET /api/table/<name>
GET /api/syntax
```

Static replacement:

```js
executor.run(sql, { runAnyway })
database.getTables()
database.fetchTable(name)
SYNTAX_REFERENCE
```

The response shapes should stay compatible with the existing UI where possible:

```js
{
  success: true,
  blocked_by_lint: false,
  lint: { errors: [], warnings: [] },
  result: {
    type: "select",
    columns: ["StudentID", "Name"],
    rows: [[1, "Amina"]],
    statements_run: 1
  }
}
```

Keeping response shapes stable reduces frontend rewrite risk.

## Porting Plan

### Phase 1: Create Static App Shell

1. Copy `frontend/index.html` to `github-static/index.html`.
2. Copy `frontend/syntax.html` to `github-static/syntax.html`.
3. Copy `frontend/style.css` to `github-static/assets/css/style.css`.
4. Update asset paths:
   - `style.css` -> `assets/css/style.css`
   - `app.js` -> `assets/js/app.js`
   - `syntax.js` -> `assets/js/syntax-page.js`
5. Change links for GitHub Pages:
   - `/` -> `./index.html`
   - `/syntax` -> `./syntax.html`
6. Avoid absolute root paths unless the repository is definitely deployed as the user/organization site root.

For a `custom_name.github.io` repository, root-relative paths work. Relative paths still make local preview and project-page fallback easier.

### Phase 2: Vendor Client SQLite

1. Add `sql.js` as a development dependency.
2. Copy the deployable runtime files into `github-static/assets/vendor/`:
   - `sql-wasm.js`
   - `sql-wasm.wasm`
3. Load the WASM file with an explicit `locateFile` callback:

```js
initSqlJs({
  locateFile: (file) => `assets/vendor/${file}`
});
```

4. Add a local dev command to verify the WASM path works from the static root.

### Phase 3: Port the Linter

Create `github-static/assets/js/linter.js`.

Port from `linter.py`:

- `DDL_KEYWORDS`
- `DML_KEYWORDS`
- `ALLOWED_TYPES`
- `FORBIDDEN_TYPES`
- `OUT_OF_SYLLABUS`
- `STATEMENT_START`
- `_line_of`
- `_split_statements`
- `lintCambridgeSql(sqlCode)`

Important behavior to preserve:

- Empty SQL returns no errors/warnings.
- Missing semicolon is an error.
- `TEXT`, `INT`, `FLOAT`, `STRING`, `BOOL`, etc. are errors with Cambridge replacements.
- `VARCHAR` and `CHARACTER` require lengths.
- `PRIMARY KEY` must be `PRIMARY KEY (field)`.
- `FOREIGN KEY` must include `REFERENCES Table(Field)`.
- CREATE TABLE brackets are checked.
- Bare string/date literal heuristic emits a warning.
- Out-of-syllabus syntax emits warnings.
- SELECT statements referencing more than two tables emit warnings.
- Unrecognized statement starts emit warnings.

### Phase 4: Move Syntax Reference to Static Data

Create `github-static/assets/js/syntax-reference.js`.

Options:

- Export `SYNTAX_REFERENCE` as a JavaScript constant.
- Or store it as `assets/data/syntax-reference.json` and fetch it as a static file.

Recommended first pass:

- Use a JavaScript module export. It avoids fetch path issues on local file preview and GitHub Pages.

Update `syntax-page.js` so it imports `SYNTAX_REFERENCE` instead of fetching `/api/syntax`.

### Phase 5: Port Database Behavior

Create `github-static/assets/js/sql-engine.js`.

Responsibilities:

- Initialize `sql.js`.
- Create an empty database or load one from bytes.
- Split SQL scripts on semicolons while ignoring semicolons inside single quotes.
- Detect Cambridge-only `CREATE DATABASE name`.
- Execute multi-statement scripts transactionally.
- Return the last SELECT result if any SELECT ran.
- Return write result with `rows_affected` and `statements_run`.
- Roll back the whole script if a later statement fails.
- List table names.
- Fetch selected table columns and rows.
- Validate table names before interpolating into SQL.
- Export database bytes for saving.

Port from `database.py`:

- `split_sql_statements`
- `is_cambridge_only_statement`
- `DatabaseManager.execute`
- `DatabaseManager.get_tables`
- `DatabaseManager.fetch_table`

JavaScript shape:

```js
class BrowserDatabase {
  static async createEmpty();
  static async fromBytes(bytes);
  execute(sql);
  getTables();
  fetchTable(tableName);
  exportBytes();
}
```

Transaction notes:

- Use `db.run("BEGIN")`, execute each statement, then `db.run("COMMIT")`.
- On any thrown error, run `ROLLBACK` and rethrow.
- For SELECT detection, preserve the existing behavior: `stmt.trimStart().toLowerCase().startsWith("select")`.
- `sql.js` exposes affected rows via `db.getRowsModified()`. Measure per statement or before/after each statement if needed.

### Phase 6: Port Executor

Create `github-static/assets/js/executor.js`.

Behavior:

- Call `lintCambridgeSql(sql)`.
- If lint errors exist and `runAnyway` is false, return the current blocked response shape.
- Otherwise call `database.execute(sql)`.
- Return success/error response shape compatible with existing `renderOutput`.
- Trigger persistence after successful write operations.

Do not autosave after blocked lint results or failed transactions.

### Phase 7: Update Workspace UI

Update `github-static/assets/js/app.js` to remove `fetch`.

Add state:

```js
let db = null;
let executor = null;
let activeTable = null;
let tablesCache = {};
```

Initialization flow:

1. Initialize SQLite WASM.
2. Try to restore a previously granted file handle from IndexedDB.
3. If no usable handle exists, create an empty in-memory database.
4. Show a storage status:
   - `Unsaved in memory`
   - `Autosaving to filename.db`
   - `Saved`
   - `Save failed`
5. Load tables from the local database.

Add controls:

- `New Database`
- `Open Database`
- `Save Database As`
- `Export Database`
- `Import Database`

Execution flow:

1. Read editor SQL.
2. Call `executor.run(sql, { runAnyway })`.
3. Render output using the existing `renderOutput`.
4. Refresh table list from local database.
5. If the result changed database state and a permanent file is connected, autosave.
6. If no permanent file is connected, mark database as unsaved and prompt export/save.

### Phase 8: Static Deployment Setup

Recommended GitHub repository layout for a user/organization page:

```text
custom_name.github.io/
  index.html
  syntax.html
  assets/
```

If this repository remains named `Cambridge-DBML`, there are two deployment choices:

1. Create a separate repository named `custom_name.github.io` and publish the contents of `github-static/` there.
2. Use GitHub Pages for this repository as a project page, which deploys to `username.github.io/Cambridge-DBML/`, not `custom_name.github.io`.

For the requested `custom_name.github.io` website, use option 1.

Deployment steps:

1. Build or prepare `github-static/`.
2. Verify it locally with a static server.
3. Copy the static output to the root of the `custom_name.github.io` repository.
4. Commit and push to GitHub.
5. In GitHub repository settings:
   - Pages source: deploy from branch
   - Branch: `main`
   - Folder: `/root`
6. Visit `https://custom_name.github.io/`.

Optional automation:

- Add a GitHub Actions workflow in this repository that publishes `github-static/` to the `custom_name.github.io` repository.
- Use a deploy key or GitHub token with limited permissions.

## Testing Plan

### Unit Tests

Use a JavaScript test runner such as Vitest.

Port current Python tests into JavaScript:

- `test_linter.py` -> `linter.test.js`
- `test_database.py` -> `database.test.js`
- `test_executor.py` -> `executor.test.js`

Required test cases:

- semicolon inside string does not split statements
- failed multi-statement script rolls back previous writes
- `CREATE DATABASE School;` returns `validated_only`
- lint errors block execution by default
- `runAnyway` allows execution attempt
- forbidden datatype is an error
- missing semicolon is an error
- out-of-syllabus `LIMIT` is a warning
- invalid table names are rejected
- table list and table fetch work after creating/inserting data

### Browser Tests

Use Playwright for end-to-end verification.

Test:

- page loads from a static server
- SQL WASM loads successfully
- workspace can create a table
- insert/select works
- database viewer updates
- lint blocking and `Run Anyway` work
- syntax page renders entries without `/api/syntax`
- no network calls to `/api/...` happen
- export downloads a database file
- import restores tables

Manual tests:

- Chromium: create/open a permanent database file and confirm autosave.
- Clear browser cache/site data.
- Reopen the site.
- Open the same database file manually and confirm data remains.
- Firefox/Safari: import/export fallback works.

## UI Changes Needed for Honest Persistence

The static app should clearly show storage state so users understand whether their work is permanently saved.

Suggested states:

- `In-memory only`: database exists only until the tab is closed unless exported.
- `Permanent file connected`: writes autosave to a user-selected file.
- `Unsaved changes`: changes exist in memory but have not been written to a permanent file.
- `Saved to <filename>`: latest successful write has been persisted.
- `Save failed`: show the browser error and keep export available.

Avoid claiming "permanent autosave" unless a user-owned file handle is active and the latest write succeeded.

## Security and Safety Notes

All SQL executes in the user's browser against the user's local database bytes.

Security implications:

- No user SQL or data is sent to a backend.
- The page should not load remote scripts from a CDN in production; vendor `sql.js` locally.
- Use strict table-name validation before interpolating table identifiers.
- Escape all rendered output values with the existing `escapeHTML` pattern.
- Do not use `innerHTML` with untrusted SQL result data unless escaped.
- Add a Content Security Policy if possible through a `<meta http-equiv>` tag, while accounting for WASM requirements.

## Known Limitations

- A static website cannot silently create or update arbitrary files on a user's computer. Browser security requires user permission.
- File System Access API support is strongest in Chromium-based browsers.
- Firefox and Safari users will need import/export fallback unless support changes.
- If the user clears site data, stored file handles and preferences may be lost, but the external database file remains.
- If the user only uses in-memory or browser-origin storage and never exports/saves to a real file, data can be lost.
- `sql.js` exports the full database on save, which is acceptable for this educational app but not ideal for very large databases.

## Implementation Order

1. Create static file structure under `github-static/`.
2. Add local `sql.js` vendor assets.
3. Port linter to `assets/js/linter.js`.
4. Move syntax reference to `assets/js/syntax-reference.js`.
5. Port database execution to `assets/js/sql-engine.js`.
6. Port executor to `assets/js/executor.js`.
7. Rewrite workspace `app.js` to call local modules instead of `/api`.
8. Add persistent file controls and storage status UI.
9. Add import/export fallback.
10. Port tests to JavaScript and run them.
11. Run browser tests with a static server.
12. Publish `github-static/` to the `custom_name.github.io` repository.

## Definition of Done

The migration is complete when:

- `github-static/index.html` works from a static server with no Flask process.
- `github-static/syntax.html` works without `/api/syntax`.
- Running SQL calls only browser-side JavaScript and WASM.
- Table browsing works locally.
- Cambridge lint behavior matches the Python tests.
- Multi-statement transactional execution matches current behavior.
- A Chromium user can save to a real local `.db` or `.sqlite` file and keep data after clearing browser site data.
- Non-Chromium users can import/export database files.
- No production page depends on Python, Flask, CORS, or server-side SQLite.
- The static output can be pushed to the root of `custom_name.github.io` and served by GitHub Pages.
