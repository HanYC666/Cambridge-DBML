# Archived Flask server

This directory contains the original Flask implementation, its frontend, Python
dependencies, and regression tests. It is retained for reference; the current
website runs from `github-static/`, with [supported static hosting methods](../README.md#choose-a-run-mode)
including Docker and the native Go server.

Run these commands from this directory so the app uses `workspace/current.db`
here:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python app.py
```

Run the Python tests with:

```bash
.venv/bin/python -m unittest discover -s tests
```

The Flask script listens on `0.0.0.0:8001`; it is reachable at
`http://127.0.0.1:8001/` locally but may also be reachable from the network.
It exposes an unauthenticated SQL API and is for trusted development only.
For localhost-only development, run:

```bash
.venv/bin/python -m flask --app app run --host 127.0.0.1 --port 8001
```

Its SQLite database is local runtime data and is ignored by Git; unlike the
current static app, SQL and the database are handled on the server.
