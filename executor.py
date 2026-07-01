from linter import lint_cambridge_sql
from database import DatabaseManager


class Executor:

    def __init__(self):
        self.db = DatabaseManager()

    def run(self, sql):
        lint_result = lint_cambridge_sql(sql)

        try:
            execution_result = self.db.execute(sql)

            return {
                "success": True,
                "lint": lint_result,
                "result": execution_result
            }

        except Exception as e:
            return {
                "success": False,
                "lint": lint_result,
                "error": str(e)
            }

    def tables(self):
        return self.db.get_tables()

    def table(self, name):
        return self.db.fetch_table(name)