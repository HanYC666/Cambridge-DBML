# Cambridge DBML

Cambridge DBML is a SQL practice workspace for Cambridge International AS & A
Level Computer Science (9618), section 8.3. It helps students write exam-style
DDL and DML, explains common Cambridge-specific mistakes, and lets them inspect
the tables they create.

The current application is completely static: SQL linting, SQLite execution,
table inspection, and database files stay in the visitor's browser. The same
frontend is supported through Docker, standalone static hosting, or the
native Go server (including Raspberry Pi Zero W). The original Flask
implementation is archived in `deprecated-flask/` for reference and regression
testing; it is not the current production application.

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

| Goal | Method | Default address / output |
| --- | --- | --- |
| Run or self-host the current app in a container | [Docker Compose](#docker-deployment) (supported production method) | `http://127.0.0.1:8011/` |
| Develop the current frontend | [Vite](#static-website-development) | `http://127.0.0.1:5173/` (or the port printed by Vite) |
| Deploy to GitHub Pages or another static host | [Static build](#static-website-hosting) | `github-static/dist/` |
| Host without Docker | [Native Go server](#native-go-server) | `http://127.0.0.1:8011/` with the command below |
| Host on a Raspberry Pi Zero W | [ARMv6 Go binary and systemd](#raspberry-pi-zero-w-deployment) | `http://127.0.0.1:8011/` |
| Run the original Python application | [Archived Flask app](#archived-flask-app) (legacy only) | `http://127.0.0.1:8001/` locally; listens on all interfaces |

Clone the repository once, then follow the appropriate method from its root:

```bash
git clone https://github.com/HanYC666/Cambridge-DBML.git
cd Cambridge-DBML
```

## Docker Deployment

Docker is a supported way to self-host the current static application on
systems with Docker Engine or Docker Desktop and the Compose v2 plugin.
Use Docker Engine 28.0.0 or newer to avoid the older Engine's localhost
port-publication issue. Docker builds the frontend from source and compiles
the existing read-only Go server; neither Node.js nor Go needs to be installed
on the host.

From the repository root:

```bash
docker compose up -d --build
```

Open **http://127.0.0.1:8011/**. The default Compose configuration binds the
host port to IPv4 loopback, not to the LAN. The server listens on
`0.0.0.0:8011` inside the container for Docker's port forwarding. The
container runs as a non-root user with a read-only filesystem, dropped Linux
capabilities, no new privileges, a health check, and an automatic restart
policy (`unless-stopped`).

No server database or Docker data volume is required. SQL execution and database
files remain in the browser. If a reverse proxy is needed, point a host-local
proxy at `http://127.0.0.1:8011`; a proxy running in another container must
use an appropriate shared Docker network instead.

Manage the service:

```bash
docker compose ps
docker compose logs -f
docker compose restart
docker compose down
```

Update the website and server together:

```bash
git pull --ff-only
docker compose up -d --build
```

The image contains the built website, so rebuilding is necessary when its
source changes. Ensure port 8011 is free before starting: the Docker, native
Go, and Pi services cannot all bind the same host port simultaneously.

### Plain Docker (without Compose)

```bash
docker build -t cambridge-dbml:local .
docker run -d --name cambridge-dbml --restart unless-stopped \
  --read-only --cap-drop ALL --security-opt no-new-privileges:true \
  -p 127.0.0.1:8011:8011 cambridge-dbml:local
```

Keep the explicit `127.0.0.1` binding; omitting it publishes the port on all
host interfaces by default. After a rebuild, stop and remove the old container
and repeat the run command to deploy the new image.

### Verify the deployment

```bash
curl -I http://127.0.0.1:8011/
curl -I http://127.0.0.1:8011/assets/vendor/sql-wasm.wasm
curl -i -X POST http://127.0.0.1:8011/
curl -I http://127.0.0.1:8011/syntax.html
```

Expected: HTTP 200 for HTML and WASM (with `application/wasm` for the latter),
405 for POST, and 301 to `/#syntax` for the legacy syntax URL. Compose
should display the host port as `127.0.0.1:8011->8011/tcp`.

## Static Website Development

Install a supported Node.js LTS release (Vite 7 requires Node.js 20.19+ or
22.12+ within its supported versions; Node.js 22 LTS or later is recommended).

```bash
cd github-static
npm ci
npm run dev
```

Open the address printed by Vite, normally `http://127.0.0.1:5173/`.
The development server is intended for local development.

## Static Website Hosting

From the repository root:

```bash
cd github-static
npm ci
npm run build
npm run preview
```

The deployment bundle is `github-static/dist/`. Publish **the contents of
that directory**, not the unbuilt source directory, to GitHub Pages or any
static web host that serves JavaScript and WASM with the correct MIME types.
Vite uses relative asset paths, so the built app can be served at a domain
root or a GitHub Pages project subpath. Use HTTPS for public deployments.
The preview command is for local verification, not production hosting.

All application resources, including the SQLite WebAssembly runtime, are
served with the site. No Flask API, external SQL service, or Node.js production
server is required.

## Native Go Server

The dependency-free Go static server is also a supported standalone hosting
method on systems with Go 1.22 or newer. Build the frontend first using the
static build instructions above, then return to the repository root:

```bash
go build -o cambridge-dbml server.go
SITE_DIR="$PWD/github-static/dist" LISTEN_ADDR=127.0.0.1:8011 ./cambridge-dbml
```

On Windows, build `cambridge-dbml.exe`, set `SITE_DIR` and `LISTEN_ADDR`
in your shell, and run the executable.

The server reads files from `SITE_DIR`, or from the directory containing the
executable if that variable is unset. Its code defaults to `:8011` (all
interfaces); set `LISTEN_ADDR=127.0.0.1:8011` explicitly for localhost-only
native operation. Website files can be updated without recompiling the server.

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

The static application does not send SQL or database contents to the server.

- When the browser supports the File System Access API (typically desktop
  Chromium browsers in a secure context), **Open Database**, **Save Database
  As**, and **Export Database** are available. A connected writable
  `.db`, `.sqlite`, or `.sqlite3` file autosaves after successful changes
  when file permissions allow it.
- When direct file access is unavailable, **Import Database** and **Export
  Database** are shown instead. Import loads a copy into memory; export saves
  a new file. It does not automatically overwrite the original.
- HTTPS or a trusted local origin such as `http://127.0.0.1` is recommended
  for direct file access. Browser support and storage state determine which
  controls are available.
- Without a connected file, in-memory changes are lost when the tab closes.
  Export them first. An exported or saved user-owned file survives clearing
  browser site data, although its stored file-handle permission may need to
  be granted again.

## Raspberry Pi Zero W Deployment

The Go server serves static files only, accepts `GET` and `HEAD`, rejects
write methods, and stores no user data. The repository includes the
`cambridge-dbml-armv6` binary, a prebuilt `index.html`, and its complete
`assets/` directory at the root. Keep these root deployment files together.

Follow [the Pi deployment guide](docs/PI_ZERO_DEPLOY.md) to clone the repository,
install the systemd service, verify the listener, and update website files
without restarting the service. The guide binds the listener to
`127.0.0.1:8011` for use behind Cloudflare Tunnel, nginx, or another same-host
TLS reverse proxy.

The Pi Zero W's ARMv6 CPU uses the native ARMv6 deployment rather than the
standard Docker images. The root prebuilt files are a separate deployment
snapshot; rebuilding the frontend for Docker does not update them.

## Archived Flask App

The original Flask application in `deprecated-flask/` is retained for
reference and regression testing. Unlike the static app, it executes SQL
server-side in a local SQLite database (`workspace/current.db` relative to
its working directory).

Install Python 3.10 or newer. From the repository root:

```bash
cd deprecated-flask
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python app.py
```

Open `http://127.0.0.1:8001/`. The legacy script actually binds to
`0.0.0.0:8001`, so it may also be reachable on your network. Run it only in
a trusted development environment; do not expose the unauthenticated legacy
API publicly. To bind it to loopback for development instead, use:

```bash
.venv/bin/python -m flask --app app run --host 127.0.0.1 --port 8001
```

On Windows, use the virtual environment's `.venv\Scripts\python.exe`.

## Tests

Run each group from the repository root.

Static application unit tests, browser tests, and production build:

```bash
(cd github-static && npm ci && npm test && npx playwright install chromium && npm run test:browser && npm run build)
```

Go server tests:

```bash
go test ./...
```

Archived Flask regression tests (after installing the legacy dependencies):

```bash
(cd deprecated-flask && .venv/bin/python -m unittest discover -s tests)
```

The Docker image build also runs the Go server tests. Use the Docker
[verification commands](#verify-the-deployment) to check the running
container. Browser tests use the Vite development server.

## Project Layout

```text
github-static/                           Current browser application and tests
github-static/dist/                      Generated static deployment bundle (ignored)
Dockerfile                               Multi-stage frontend/Go container build
compose.yaml                             Localhost-only Docker deployment
.dockerignore                            Docker build-context exclusions
server.go, server_test.go                Read-only Go static server and tests
go.mod                                   Go module configuration
index.html, assets/, cambridge-dbml-armv6 Pi Zero W deployment snapshot
deprecated-flask/                        Archived Python app and regression tests
docs/                                    Deployment and implementation notes
changelog.md                             Project release history
build/                                   Ignored local build artifacts
```

## Security And Privacy

- The current static app keeps SQL execution and database bytes on the client.
- The Go server has no login, session, upload, database, or write endpoint.
  It serves only the expected static paths and sets CSP, frame protection,
  MIME-sniffing protection, referrer, permissions, COOP, and CORP headers.
- HTML and unversioned vendor assets require revalidation; hashed assets use
  immutable caching. For Cloudflare, see the caching guidance in
  [the Pi deployment guide](docs/PI_ZERO_DEPLOY.md#caching).
- The Docker and documented Pi configurations bind the published service
  to IPv4 loopback. Public hosting should use a deliberately configured
  TLS reverse proxy or static HTTPS host.
- The archived Flask app is not covered by the static app's client-side
  privacy model or read-only server restrictions.

## Cross-Platform Support

The static app runs in modern desktop browsers, with direct-file saving
dependent on browser API support. Docker is intended for supported Docker
Engine/Desktop platforms (including mainstream amd64 and arm64 hosts);
the native Go server is a separate option and the checked-in Pi binary
targets Linux ARMv6. The archived Python application remains available
for local development.

## Contributing

You must give full credit to me (HanYC666) when modifying, contributing, or redistributing this software. If you have a good idea of a new feature and want me to add it into this project, open an Issue on GitHub.
