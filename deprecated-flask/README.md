# Archived Flask server

This directory contains the original Flask implementation, its frontend, Python
dependencies, and regression tests. It is retained for reference; the current
website runs from `github-static/`, with `server.go` serving its built files on
the Raspberry Pi.

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

The Flask server listens on port 8001. Its SQLite database is local runtime
data and is ignored by Git.
