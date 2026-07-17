from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from executor import Executor
from linter import SYNTAX_REFERENCE

app = Flask(__name__, static_folder="frontend")
CORS(app)

executor = Executor()


# -----------------------------
# FRONTEND ROUTES
# -----------------------------

@app.route("/")
def home():
    return send_from_directory("frontend", "index.html")


@app.route("/syntax")
def syntax_page():
    return send_from_directory("frontend", "syntax.html")


@app.route("/<path:path>")
def static_files(path):
    return send_from_directory("frontend", path)


# -----------------------------
# API ROUTES
# -----------------------------

@app.route("/api/execute", methods=["POST"])
def execute():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({
            "success": False,
            "blocked_by_lint": False,
            "lint": {"errors": [], "warnings": []},
            "error": "Request body must be a JSON object."
        }), 400

    sql = data.get("sql")
    if not isinstance(sql, str):
        return jsonify({
            "success": False,
            "blocked_by_lint": False,
            "lint": {"errors": [], "warnings": []},
            "error": "Request body must include a string 'sql' field."
        }), 400

    run_anyway = bool(data.get("run_anyway", False))
    return jsonify(executor.run(sql, run_anyway=run_anyway))


@app.route("/api/tables", methods=["GET"])
def tables():
    return jsonify(executor.tables())


@app.route("/api/table/<name>", methods=["GET"])
def table(name):
    try:
        return jsonify(executor.table(name))
    except ValueError as exc:
        return jsonify({
            "success": False,
            "error": str(exc)
        }), 400


@app.route("/api/syntax", methods=["GET"])
def syntax_reference():
    return jsonify(SYNTAX_REFERENCE)


# -----------------------------
# START SERVER
# -----------------------------

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8001)
