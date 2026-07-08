from linter import lint_cambridge_sql
from database import DatabaseManager


class Executor:

    def __init__(self, db=None):
        self.db = db or DatabaseManager()

    def run(self, sql, run_anyway=False):
        lint_result = lint_cambridge_sql(sql)

        if lint_result["errors"] and not run_anyway:
            return {
                "success": False,
                "blocked_by_lint": True,
                "lint": lint_result,
                "result": None,
                "error": (
                    "Execution blocked because the SQL has Cambridge 9618 lint "
                    "errors."
                )
            }

        try:
            execution_result = self.db.execute(sql)

            return {
                "success": True,
                "blocked_by_lint": False,
                "lint": lint_result,
                "result": execution_result
            }

        except Exception as e:
            return {
                "success": False,
                "blocked_by_lint": False,
                "lint": lint_result,
                "error": str(e)
            }

    def tables(self):
        return self.db.get_tables()

    def table(self, name):
        return self.db.fetch_table(name)
