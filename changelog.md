# Changelog

## First Commit Reference

### Date

2026-07-08

### Project Snapshot

This baseline captures the current working state of the Cambridge-DBML project before deeper backend improvements and test coverage are added.

### Purpose of the Project

Cambridge-DBML is a Cambridge International AS & A Level Computer Science 9618 SQL practice platform. It combines a Cambridge-focused SQL linter with a local SQLite-backed execution environment so users can practise DDL and DML syntax while receiving exam-oriented feedback.

### Current Architecture

- Backend: `Flask` application in `app.py`
- Execution layer: `executor.py`
- Database layer: `database.py`
- Cambridge SQL linter and syntax reference source: `linter.py`
- Frontend: vanilla `HTML`, `CSS`, and `JavaScript` in `frontend/`
- Local project environment: Python virtual environment at `venv/`
- Local database workspace: `workspace/current.db`

### Implemented Features At This Baseline

- Web-based SQL editor for writing and submitting queries
- Linting of Cambridge SQL syntax before execution results are shown
- Detection of forbidden non-Cambridge datatypes such as `TEXT`, `INT`, and `FLOAT`
- Warnings for out-of-syllabus SQL features such as `LIMIT`, `UNION`, and non-Cambridge joins
- Multi-statement SQL script execution through the backend
- Database viewer for listing tables and inspecting table contents
- Syntax reference page generated from backend-owned reference data
- Table-name validation on table inspection endpoints to reduce SQL injection risk

### Known Gaps At This Baseline

- Lint errors do not yet block execution by default
- SQL script splitting in `database.py` is still naive and not transaction-safe
- Cambridge-valid but SQLite-non-executable commands such as `CREATE DATABASE` are not yet handled explicitly
- API validation and error responses need hardening
- Automated tests are not yet present

### UI State At This Baseline

The UI was refreshed in this baseline pass to establish a better starting point for future work.

Implemented UI improvements:

- Replaced the flat dark dashboard styling with a more intentional workspace layout
- Added a stronger page hierarchy for the editor, output, and database viewer
- Improved the syntax reference page so it visually matches the main workspace
- Added compact Cambridge guidance near the editor for faster exam-style usage
- Added keyboard shortcut support for running queries with `Ctrl` + `Enter`
- Kept motion restrained and avoided distracting floating elements or decorative animations
- Preserved responsive behavior for smaller screens

### Planning Changes Made In This Baseline Pass

`implementation_plan.md` was rewritten to better reflect the actual repository and the next practical workstreams:

- UI and UX refresh
- lint-gated execution
- safer transactional SQL execution
- Cambridge-only command handling
- API validation hardening
- automated regression tests

### Environment Rule For Future Work

All Python work for this project should use the project-local virtual environment:

```bash
venv/bin/python
```

### Notes For Future Entries

Add future changes below this entry using dated markdown sections. Keep entries focused on:

- backend behavior changes
- frontend/UI changes
- lint rule changes
- test coverage additions
- bug fixes and regressions avoided

## 2026-07-08 - Backend Execution and Validation Pass

### Summary

Implemented the first major backend improvement pass after the baseline review and UI refresh.

### Added

- Cambridge lint errors now block SQL execution by default
- Explicit `run_anyway` support in the execution flow
- `blocked_by_lint` response flag for the frontend
- Support for Cambridge-valid but SQLite-non-executable `CREATE DATABASE` statements through a `validated_only` response type
- String-aware SQL statement splitting that preserves semicolons inside single-quoted values
- Transactional multi-statement execution with rollback on failure
- Structured API validation for malformed JSON and missing `sql`
- Automated backend regression tests in `tests/`

### Changed

- `executor.py` now accepts `run_anyway` and returns blocked execution responses when lint errors exist
- `database.py` now executes scripts transactionally and rejects mixed `CREATE DATABASE` plus executable SQLite scripts
- `app.py` now returns JSON `400` responses for invalid `/api/execute` payloads and invalid table requests
- `frontend/app.js` is now aligned with the stricter execution flow and can surface `blocked_by_lint` and `validated_only` responses correctly

### Verified

The following verification was run using the project-local virtual environment:

```bash
venv/bin/python -m unittest discover -s tests
venv/bin/python -m py_compile app.py database.py executor.py linter.py
```

Result:

- 13 tests passed
- Python modules compiled successfully

### Remaining Follow-Up Work

- Consider making the linter's own statement splitting string-aware as well for full consistency with runtime behavior
- Extend Cambridge-only handling if more syllabus-valid but SQLite-non-executable commands need special treatment
- Add higher-level browser/manual QA once further frontend behavior changes are made
