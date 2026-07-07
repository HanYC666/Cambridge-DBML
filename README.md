# Cambridge-DBML Practice Platform

An interactive SQL practice platform and syntax linter tailored specifically for the **Cambridge International AS & A Level Computer Science (9618)** syllabus, Section 8.3 (Database DDL and DML).

---

## 📖 About the Project

Standard SQL engines (such as SQLite, MySQL, or PostgreSQL) are highly permissive and allow queries that deviate from Cambridge's strict exam standards. For example, standard databases accept non-CIE datatypes (like `INT` or `TEXT`), permit missing semicolons, or allow inline primary keys. 

The **Cambridge-DBML Practice Platform** bridges this gap. It acts as an interactive SQL learning environment that runs your queries through a custom Cambridge-compliant SQL linter *before* executing them on a local database. It provides instant feedback, identifying syntax errors, non-compliant data types, and out-of-syllabus features that would lose marks in an exam setting.

---

## ✨ Key Features

- **Interactive SQL Editor**: A web-based console to write, lint, and run SQL queries.
- **Syllabus-Compliant SQL Linter**:
  - **Strict Datatype Enforcement**: Only allows the seven Cambridge-recognised datatypes: `INTEGER`, `REAL`, `CHARACTER(n)`, `VARCHAR(n)`, `BOOLEAN`, `DATE`, and `TIME`. Common synonyms like `INT`, `FLOAT`, `TEXT`, `STRING`, `BOOL`, or `DATETIME` will trigger linter errors.
  - **Constraint Location Check**: Ensures that `PRIMARY KEY` and `FOREIGN KEY` (with `REFERENCES`) are defined as separate clauses at the end of the `CREATE TABLE` statement list, rather than inline.
  - **Out-of-Syllabus Warnings**: Flags features that are technically valid in SQL but sit outside the 9618 syllabus subset (e.g., `LEFT JOIN`, `UNION`, `LIMIT`, `DROP`, `DISTINCT`).
  - **Table-Count Check**: Warns if a DML query references more than two tables (per CIE limits).
  - **Heuristic Warnings**: Alerts users to potential syntax mistakes, such as missing quotes around string/date literals (e.g., `WHERE Name = John`).
  - **Semicolon Check**: Enforces terminating semicolons on every query statement.
- **Live Database & Schema Viewer**: Automatically scans the SQLite database to display created tables as tabs, showing row counts and schema contents in real-time.
- **Interactive Syntax Reference**: A dedicated `/syntax` page generated directly from the backend's linter definitions, providing templates, example queries, and syllabus-specific notes for each command.

---

## 🛠️ Project Structure

The project is structured as follows:

- **`app.py`**: The backend Flask server. It serves frontend assets and exposes REST API endpoints for query execution, schema inspection, and the syntax reference.
- **`database.py`**: Handles connection management with SQLite (`workspace/current.db`). It parses and executes SQL scripts containing multiple semicolon-separated statements and runs parameterized schema queries with SQL injection protections.
- **`executor.py`**: Coordinates the query execution lifecycle by passing queries through the linter before sending them to the database.
- **`linter.py`**: Houses the syntax verification patterns, whitelist keywords, and forbidden type rules. It also serves as the single source of truth for the syntax reference data.
- **`frontend/`**: Vanilla JavaScript/HTML/CSS single-page client application:
  - `index.html` & `app.js` & `style.css`: The SQL Editor & Database Viewer UI.
  - `syntax.html` & `syntax.js`: The CIE 9618 SQL Syntax Reference.
- **`workspace/`**: The directory containing the local SQLite database (`current.db`).

---

## 🚀 Getting Started

Follow these step-by-step instructions to get the platform up and running on your local machine.

### 1. Clone the Repository

Clone the repository and navigate into the project directory:

```bash
git clone https://github.com/HanYC666/Cambridge-DBML.git
cd Cambridge-DBML
```

### 2. Create a Virtual Environment (Recommended)

Keep your dependencies isolated by setting up a virtual environment.

* **Create the environment:**
  ```bash
  python -m venv venv
  ```

* **Activate it:**
  * **Linux / macOS:**
    ```bash
    source venv/bin/activate
    ```
  * **Windows:**
    ```bash
    venv\Scripts\activate
    ```

### 3. Install Dependencies

Install all the required Python packages:

```bash
pip install -r requirements.txt
```

### 4. Run the Backend Server

Start the Flask application:

```bash
python app.py
```

### 5. Access the Application

Open your browser and navigate to:
[http://127.0.0.1:5000/](http://127.0.0.1:5000/)

---

## 🔌 API Endpoints

The Flask backend exposes the following REST API endpoints:

- **`POST /api/execute`**: Executes a query or script.
  - **Request Body**: `{"sql": "string"}`
  - **Response**: `{ "success": boolean, "lint": { "errors": [...], "warnings": [...] }, "result": { ... } | null, "error": "string" | null }`
- **`GET /api/tables`**: Returns a list of all tables currently defined in the database.
- **`GET /api/table/<name>`**: Returns columns and rows for a specific table.
- **`GET /api/syntax`**: Returns the array of syntax reference documentation items used to build the syntax guide.

---

##  License & Warranty

> ⚠️ **Disclaimer:** This software comes with **ABSOLUTE NO WARRANTY!**

* **Open-Source:** You are free to redistribute, modify, and use this software. However, it **must** remain fully open-source at all times and under all conditions.
* **Attribution:** You must give explicit credit to the original creator (**HanYC666**) if you post, publish, or distribute this program or any of its variants.