# Cambridge DBML

Cambridge DBML is a SQL practice workspace for Cambridge International AS & A
Level Computer Science (9618), section 8.3. It helps students write exam-style
DDL and DML, explains common Cambridge-specific mistakes, and lets them inspect
the tables they create.

The recommended production app is completely static: SQL linting, SQLite
execution, and database files stay in the visitor's browser. The repository
also keeps the original Flask app for local Python development and testing.

## What It Checks

The linter is designed for Cambridge SQL rather than generic database syntax.
It flags or warns about:

- Non-Cambridge datatypes such as `TEXT`, `INT`, `FLOAT`, and `BOOL`.
- Missing semicolons and missing `VARCHAR(n)` or `CHARACTER(n)` lengths.
- Incorrect `PRIMARY KEY` and `FOREIGN KEY ... REFERENCES` forms.
- Likely missing quotes around text and date values.
- Out-of-syllabus features such as `LIMIT`, `UNION`, `DISTINCT`, and non-inner joins.
- `SELECT` statements that appear to use more than two tables.

Lint errors block execution by default. Students can choose **Run Anyway** to
experiment with SQLite behaviour, but the warning remains visible.

## Choose A Run Mode

| Goal | Use | Notes |
| --- | --- | --- |
| Develop or preview the student website | `github-static/` | Recommended for the current application. Runs entirely in the browser. |
| Work on the original Python application | Flask | Useful for the existing Python tests and API development. |
| Host on a Raspberry Pi Zero W | Go static server | Embeds the built website in one read-only ARM binary. |

## Static Website Quick Start

Install a current Node.js LTS release, then run:

```bash
git clone https://github.com/HanYC666/Cambridge-DBML.git
cd Cambridge-DBML/github-static
npm ci
npm run dev
```

Open the local address printed by Vite, normally `http://127.0.0.1:5173/`.

To create the deployment bundle:

```bash
npm run build
```

The generated files are in `github-static/dist/`. They contain no backend API
and can be hosted by any static web server.

## Using The Workspace

Start with a small Cambridge-style script:

```sql
CREATE TABLE Student (
    StudentID INTEGER,
    Name VARCHAR(30) NOT NULL,
    PRIMARY KEY (StudentID)
);

INSERT INTO Student (StudentID, Name) VALUES (1, 'Amina');
SELECT * FROM Student;
```

Run it with the button or `Ctrl`/`Cmd` + `Enter`. The result panel shows lint
messages and query output. The table viewer updates after successful writes.

## Saving Databases

The static website does not send SQL or database contents to the server.

- In Chromium-based browsers, the page shows **Open Database**, **Save Database
  As**, and **Export Database**. Opening a real `.db`, `.sqlite`, or `.sqlite3`
  file connects it for automatic live saving after every successful write.
- In Firefox and Safari, the page shows **Import Database** and **Export
  Database**. Import loads a copy into the browser; export saves the changed
  copy as a download.
- An in-memory database disappears when the tab closes. Export it or save it
  to a file before leaving the page.

## Raspberry Pi Zero W Deployment

The Go server serves only static files. It has no SQL API, accepts only `GET`
and `HEAD`, rejects `POST` and all other write methods, and stores no user data.

Build the static bundle first, then cross-compile from a development machine:

```bash
cd github-static
npm ci
npm run build
cd ..
mkdir -p build
GOOS=linux GOARCH=arm GOARM=6 CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o build/cambridge-dbml-pi .
```

Run the binary behind Cloudflare Tunnel, nginx, or another TLS reverse proxy:

```bash
LISTEN_ADDR=127.0.0.1:8080 ./build/cambridge-dbml-pi
```

See [the Pi deployment guide](docs/PI_ZERO_DEPLOY.md) for Cloudflare cache
rules, security guidance, and verification commands. Do not expose the Pi
directly to the Internet or run the server as root.

## Flask Development Mode

The original Flask app remains available for Python development.

Requirements: Python 3.10 or newer.

```bash
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python app.py
```

Open `http://127.0.0.1:8001/`. The Flask API is for local development only;
the static and Pi deployments do not expose it.

## Tests

Run Python regression tests:

```bash
.venv/bin/python -m unittest discover -s tests
```

Run static application tests:

```bash
cd github-static
npm ci
npm test
npm run test:browser
npm run build
```

`npm run test:browser` uses Playwright and may require browser binaries to be
installed with `npx playwright install chromium`.

Run Go server tests:

```bash
go test ./...
```

## Project Layout

```text
app.py, executor.py, database.py, linter.py  Original Flask application
frontend/                                     Flask UI assets
tests/                                        Python regression tests
github-static/                                Static browser application and tests
server.go                                     Read-only embedded Go static server
docs/                                         Deployment and implementation notes
build/                                        Ignored local build artifacts
```

## Security And Privacy

- The static application keeps SQL execution and database bytes on the client.
- The Go server has no login, session, upload, database, or write endpoint.
- The Go server sends CSP, frame protection, MIME-sniffing, referrer,
  permissions, COOP, and CORP headers.
- Cloudflare can cache HTML and immutable assets at the edge; configure the
  Cache Rule in `docs/PI_ZERO_DEPLOY.md` before public deployment.

## Contributing

Keep changes focused, add or update tests for behavioural changes, and run the
relevant test commands before opening a pull request. The project currently
has no `LICENSE` file; ask the maintainer before redistributing it.
