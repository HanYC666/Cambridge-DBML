import sqlite3
import os
import re

# Table/field identifiers CIE syntax uses — letters, digits, underscore,
# must start with a letter. Used to prevent SQL injection through the
# /api/table/<name> endpoint, where `name` comes straight from the URL.
_IDENTIFIER_RE = re.compile(r'^[A-Za-z][A-Za-z0-9_]*$')
_CREATE_DATABASE_RE = re.compile(
    r'^\s*CREATE\s+DATABASE\s+[A-Za-z][A-Za-z0-9_]*\s*$',
    re.IGNORECASE
)


def split_sql_statements(sql):
    """Split SQL on semicolons, ignoring semicolons inside single quotes."""
    statements = []
    current = []
    in_single_quote = False
    i = 0

    while i < len(sql):
        char = sql[i]

        if char == "'":
            # SQLite-style escaped single quote inside a string: ''
            if in_single_quote and i + 1 < len(sql) and sql[i + 1] == "'":
                current.append(char)
                current.append(sql[i + 1])
                i += 2
                continue

            in_single_quote = not in_single_quote

        if char == ";" and not in_single_quote:
            statement = "".join(current).strip()
            if statement:
                statements.append(statement)
            current = []
        else:
            current.append(char)

        i += 1

    tail = "".join(current).strip()
    if tail:
        statements.append(tail)

    return statements


def is_cambridge_only_statement(statement):
    return bool(_CREATE_DATABASE_RE.match(statement.strip()))


class DatabaseManager:

    def __init__(self, db_path="workspace/current.db"):
        self.db_path = db_path
        db_dir = os.path.dirname(db_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.cursor = self.conn.cursor()

    def execute(self, sql):
        """
        Run a full SQL *script* (as CIE 9618 calls it), i.e. one or more
        semicolon-separated statements. sqlite3's cursor.execute() only
        accepts a single statement, so a script with e.g. an INSERT INTO
        followed by a SELECT would previously fail. We split on ';' and
        run each statement in turn, returning the result of the last
        SELECT if there is one (or the total rows affected otherwise).
        """
        statements = split_sql_statements(sql)
        if not statements:
            return {"type": "write", "rows_affected": 0, "statements_run": 0}

        if all(is_cambridge_only_statement(stmt) for stmt in statements):
            return {
                "type": "validated_only",
                "message": (
                    "This is valid Cambridge 9618 syntax, but SQLite does not "
                    "execute CREATE DATABASE within this practice environment."
                ),
                "statements_run": 0,
            }

        if any(is_cambridge_only_statement(stmt) for stmt in statements):
            raise ValueError(
                "CREATE DATABASE cannot be mixed with executable SQLite statements "
                "in this practice environment."
            )

        last_select_result = None
        total_rows_affected = 0
        statements_run = 0

        try:
            self.conn.execute("BEGIN")

            for stmt in statements:
                self.cursor.execute(stmt)
                statements_run += 1

                if stmt.lstrip().lower().startswith("select"):
                    columns = [desc[0] for desc in self.cursor.description]
                    rows = self.cursor.fetchall()
                    last_select_result = {
                        "type": "select",
                        "columns": columns,
                        "rows": rows,
                    }
                else:
                    total_rows_affected += max(self.cursor.rowcount, 0)

            self.conn.commit()
        except Exception:
            self.conn.rollback()
            raise

        if last_select_result is not None:
            last_select_result["statements_run"] = statements_run
            return last_select_result

        return {
            "type": "write",
            "rows_affected": total_rows_affected,
            "statements_run": statements_run,
        }

    def get_tables(self):
        self.cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )
        return [t[0] for t in self.cursor.fetchall()]

    def fetch_table(self, table_name):
        # table_name is user-controlled (comes from the URL path) and
        # SQLite doesn't support parameterised identifiers, so validate
        # it against a strict pattern AND the real table list before
        # interpolating it into SQL — otherwise this is a straightforward
        # SQL injection point (e.g. /api/table/x); DROP TABLE Customer;--).
        if not _IDENTIFIER_RE.match(table_name):
            raise ValueError(f"'{table_name}' is not a valid table name.")
        if table_name not in self.get_tables():
            raise ValueError(f"Table '{table_name}' does not exist.")

        self.cursor.execute(f"SELECT * FROM {table_name}")
        rows = self.cursor.fetchall()
        columns = [d[0] for d in self.cursor.description]

        return {
            "columns": columns,
            "rows": rows
        }
