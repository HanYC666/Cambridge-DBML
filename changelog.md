# Changelog

## 2026-09-08 - v0.5.0

### Summary

Converted the practice application into a deployable static browser application and added a minimal, read-only Go server for secure Raspberry Pi Zero W hosting. The browser now performs linting, SQLite execution, table viewing, and database persistence locally; the server only distributes static assets.

### changed

- Moved the deployable application into `github-static/`, separating it from the retained Flask development application.
- Replaced browser calls to Flask endpoints with local JavaScript modules for linting, SQL execution, table inspection, and syntax-reference rendering.
- Changed the static build to use relative asset paths so the generated site can be served from a custom domain root or a GitHub Pages project path.
- Removed the Google Fonts dependency and updated the static CSP so all production application assets are locally served.
- Reworked `DatabaseManager` connection access to use an `RLock` and per-operation cursors, preventing shared-cursor interference between concurrent Flask requests.

### Added

- Added a local `sql.js` WebAssembly runtime and browser SQLite engine with quote-aware script splitting, transactions, rollback, table listing, safe table reads, byte export, and Cambridge `CREATE DATABASE` validated-only handling.
- Added a browser implementation of the Cambridge 9618 SQL linter and a static syntax-reference module.
- Added local-file persistence controls: new database, open, save as, export, and import. Chromium browsers can autosave to a user-selected file; other browsers retain explicit import/export support.
- Added persistence state reporting for in-memory, unsaved, saving, saved, imported, and failed-save states.
- Added Vitest coverage for browser linting, SQL execution, transactions, table access, executor behavior, persistence, and write-plus-SELECT autosave behavior.
- Added Playwright coverage for executing SQL without API requests, updating the table viewer, exporting a database, and rendering the syntax reference without an API request.
- Added a dependency-free Go server that embeds the built static site, serves only `GET` and `HEAD`, rejects all write methods with `405 Method Not Allowed`, restricts paths to known static files, and applies response timeouts and header-size limits.
- Added CSP, MIME-sniffing, frame, referrer, permissions, COOP, and CORP security headers to the Go server.
- Added Cloudflare-oriented cache headers: cacheable HTML with shared-cache revalidation and one-year immutable caching for versioned assets.
- Added `PI_ZERO_DEPLOY.md` with Pi Zero W ARMv6 cross-compilation, unprivileged runtime, reverse-proxy, Cloudflare Cache Rule, and verification instructions.
- Added Go server tests covering allowed methods, cache/security headers, traversal rejection, and unknown paths.

### Fixed

- Fixed static WASM tests to load the checked-in runtime asset rather than assuming a package-local `node_modules` layout.
- Fixed browser autosave so a script that writes data and finishes with `SELECT` still persists the changed database.
- Fixed writable file-save failure handling so an open writable stream is aborted when writing fails.

## 2026-08-15 - v0.4.1

### Summary

Refined repository hygiene after the static migration planning work.

### changed

- Updated root ignore rules to exclude macOS `.DS_Store` metadata from version control.

## 2026-07-22 - v0.4.0

### Summary

Documented the static GitHub Pages migration strategy before implementation began.

### Added

- Added `github-static/implementation_plan.md` describing the browser SQLite architecture, static deployment model, client-owned database persistence, API replacement map, test plan, security considerations, and GitHub Pages deployment options.

## 2026-07-18 - v0.3.1

### Summary

Adjusted the Flask development server documentation and runtime configuration for local network access.

### changed

- Updated the Flask server port configuration.
- Updated README run instructions to match the locally accessible development server.

## 2026-07-08 - v0.3.0

### Summary

Completed the first full application hardening pass: strict Cambridge lint gating, transactional execution, API validation, richer frontend diagnostics, syntax reference support, and automated Python regression coverage.

### changed

- Updated the Flask API to return structured JSON errors for malformed execution payloads and invalid table requests.
- Updated the executor to block Cambridge lint errors by default while retaining an explicit `run_anyway` path.
- Updated database execution to run multi-statement scripts transactionally and return the final `SELECT` result when present.
- Updated frontend workspace behavior to render lint blocks, runtime failures, validated-only statements, result tables, and table-viewer state clearly.
- Redesigned the workspace and syntax-reference UI with responsive panels, theme support, keyboard execution shortcuts, and safer escaped result rendering.
- Updated README, ignore rules, and project documentation to match the hardened behavior and local development workflow.

### Added

- Added `blocked_by_lint` execution responses and frontend retry support for intentionally running lint-invalid SQL.
- Added validated-only handling for Cambridge-valid `CREATE DATABASE` statements that SQLite cannot execute in the practice database.
- Added quote-aware SQL splitting so semicolons in single-quoted values do not split scripts incorrectly.
- Added rollback behavior for failed later statements in a multi-statement transaction.
- Added syntax-reference pages and backend-owned syntax data for Cambridge DDL and DML guidance.
- Added Python regression suites for the Flask API, database manager, executor, and linter.

### Fixed

- Fixed table-name handling by validating identifiers before they are interpolated into table inspection SQL.
- Fixed API error handling for invalid JSON, missing SQL fields, and invalid table names.
- Fixed frontend handling for lint-blocked and Cambridge-only execution outcomes.

## 2026-07-07 - v0.2.0

### Summary

Expanded the project from a basic SQL editor into a Cambridge 9618-focused practice environment with syllabus-aware diagnostics and a dedicated syntax reference.

### changed

- Expanded the Cambridge linter to cover more datatype, key, quoting, out-of-syllabus, and table-count checks.
- Updated the Flask application, database layer, README, workspace markup, and shared styles to support the broader learning workflow.
- Refined the workspace layout and presentation of editor guidance, outputs, and database inspection.

### Added

- Added the syntax-reference page and client script.
- Added Cambridge 9618 syntax-reference data for DDL, DML, keys, datatypes, joins, aggregate functions, and data-maintenance statements.
- Added lint diagnostics for invalid datatype aliases, missing `VARCHAR` or `CHARACTER` lengths, malformed primary and foreign keys, likely unquoted values, unsupported SQL features, and queries that appear to use more than two tables.

## 2026-07-01 - v0.1.0

### Summary

Created Cambridge-DBML as a Flask and SQLite SQL-practice application for Cambridge International AS & A Level Computer Science 9618.

### Added

- Added the Flask application, execution coordinator, SQLite database manager, Cambridge SQL linter, frontend workspace, requirements file, and project ignore rules.
- Added a browser SQL editor, query execution endpoint, table viewer, and baseline Cambridge-oriented lint feedback.
- Added the initial README with setup and usage guidance.
- Added responsive workspace styling and a subsequent UI refresh that improved editor, output, and database-viewer hierarchy.

### Removed

- Removed the local workspace database from version control and added ignore rules so developer data is not committed.
