from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from executor import Executor
import os

app = Flask(__name__, static_folder="frontend")
CORS(app)

executor = Executor()


# -----------------------------
# FRONTEND ROUTE
# -----------------------------

@app.route("/")
def home():
    return send_from_directory("frontend", "index.html")


@app.route("/<path:path>")
def static_files(path):
    return send_from_directory("frontend", path)


# -----------------------------
# API ROUTES
# -----------------------------

@app.route("/api/execute", methods=["POST"])
def execute():
    data = request.get_json()
    sql = data.get("sql", "")

    return jsonify(executor.run(sql))


@app.route("/api/tables", methods=["GET"])
def tables():
    return jsonify(executor.tables())


@app.route("/api/table/<name>", methods=["GET"])
def table(name):
    return jsonify(executor.table(name))


# -----------------------------
# START SERVER
# -----------------------------

if __name__ == "__main__":
    app.run(debug=True)