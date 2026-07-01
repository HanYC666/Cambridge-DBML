import sqlite3
import os

class DatabaseManager:

    def __init__(self, db_path="workspace/current.db"):
        self.db_path = db_path
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.cursor = self.conn.cursor()

    def execute(self, sql):
        sql = sql.strip()

        if sql.lower().startswith("select"):
            self.cursor.execute(sql)
            columns = [desc[0] for desc in self.cursor.description]
            rows = self.cursor.fetchall()

            return {
                "type": "select",
                "columns": columns,
                "rows": rows
            }

        self.cursor.execute(sql)
        self.conn.commit()

        return {
            "type": "write",
            "rows_affected": self.cursor.rowcount
        }

    def get_tables(self):
        self.cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )
        return [t[0] for t in self.cursor.fetchall()]

    def fetch_table(self, table_name):
        self.cursor.execute(f"SELECT * FROM {table_name}")
        rows = self.cursor.fetchall()
        columns = [d[0] for d in self.cursor.description]

        return {
            "columns": columns,
            "rows": rows
        }