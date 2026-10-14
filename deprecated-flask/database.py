import sqlite3
import os
import re
import threading


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

        # One SQLite connection for this DatabaseManager.
        #
        # check_same_thread=False allows Flask requests handled by
        # different threads to use the connection.
        #
        # Access to the connection is protected by self.lock below.
        self.conn = sqlite3.connect(
            self.db_path,
            check_same_thread=False
        )

        # IMPORTANT:
        # Do NOT keep a shared cursor as self.cursor.
        #
        # A cursor is created locally for each operation instead.
        self.lock = threading.RLock()

    def execute(self, sql):
        """
        Run a full SQL script (as CIE 9618 calls it), i.e. one or more
        semicolon-separated statements.

        sqlite3's cursor.execute() only accepts a single statement,
        so a script is split on ';' and each statement is executed
        separately.

        The result of the final SELECT is returned, or the total number
        of rows affected for write statements.
        """

        statements = split_sql_statements(sql)

        if not statements:
            return {
                "type": "write",
                "rows_affected": 0,
                "statements_run": 0
            }

        # CREATE DATABASE is valid Cambridge syntax but is not executable
        # by SQLite in this practice environment.
        if all(is_cambridge_only_statement(stmt) for stmt in statements):
            return {
                "type": "validated_only",
                "message": (
                    "This is valid Cambridge 9618 syntax, but SQLite does not "
                    "execute CREATE DATABASE within this practice environment."
                ),
                "statements_run": 0,
            }

        # Do not allow CREATE DATABASE to be mixed with executable SQL.
        if any(is_cambridge_only_statement(stmt) for stmt in statements):
            raise ValueError(
                "CREATE DATABASE cannot be mixed with executable SQLite statements "
                "in this practice environment."
            )

        last_select_result = None
        total_rows_affected = 0
        statements_run = 0

        # SQLite connections are not designed for multiple concurrent
        # transactions. Protect the entire transaction with a lock.
        with self.lock:
            try:
                self.conn.execute("BEGIN")

                for stmt in statements:
                    # IMPORTANT:
                    # Create a fresh cursor for every statement.
                    cursor = self.conn.cursor()

                    cursor.execute(stmt)
                    statements_run += 1

                    if stmt.lstrip().lower().startswith("select"):
                        columns = [
                            desc[0]
                            for desc in cursor.description
                        ]

                        rows = cursor.fetchall()

                        last_select_result = {
                            "type": "select",
                            "columns": columns,
                            "rows": rows,
                        }

                    else:
                        total_rows_affected += max(
                            cursor.rowcount,
                            0
                        )

                    # Explicitly close this cursor.
                    cursor.close()

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
        """
        Return all user tables in the SQLite database.

        A fresh cursor is used for this query so that this method cannot
        interfere with another cursor operation.
        """

        with self.lock:
            cursor = self.conn.cursor()

            try:
                cursor.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                )

                return [
                    table[0]
                    for table in cursor.fetchall()
                ]

            finally:
                cursor.close()

    def fetch_table(self, table_name):
        """
        Return all rows and column names from a table.

        table_name comes from the URL, so it must be strictly validated
        before being interpolated into SQL.
        """

        # Validate identifier syntax first.
        if not _IDENTIFIER_RE.match(table_name):
            raise ValueError(
                f"'{table_name}' is not a valid table name."
            )

        with self.lock:

            # Check that the requested table actually exists.
            if table_name not in self.get_tables():
                raise ValueError(
                    f"Table '{table_name}' does not exist."
                )

            # Fresh cursor for this query.
            cursor = self.conn.cursor()

            try:
                # table_name has already passed strict identifier validation
                # and has been checked against sqlite_master.
                cursor.execute(
                    f"SELECT * FROM {table_name}"
                )

                rows = cursor.fetchall()

                columns = [
                    description[0]
                    for description in cursor.description
                ]

                return {
                    "columns": columns,
                    "rows": rows
                }

            finally:
                cursor.close()

    def close(self):
        """
        Close the SQLite connection cleanly.
        """

        with self.lock:
            self.conn.close()
