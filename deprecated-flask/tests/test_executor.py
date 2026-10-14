import tempfile
import unittest

from database import DatabaseManager
from executor import Executor


class ExecutorTests(unittest.TestCase):
    def test_lint_errors_block_execution_by_default(self):
        with tempfile.NamedTemporaryFile(suffix=".db") as db_file:
            executor = Executor(db=DatabaseManager(db_file.name))
            result = executor.run("CREATE TABLE Student (Name TEXT);")

        self.assertFalse(result["success"])
        self.assertTrue(result["blocked_by_lint"])

    def test_run_anyway_allows_execution_attempt(self):
        with tempfile.NamedTemporaryFile(suffix=".db") as db_file:
            executor = Executor(db=DatabaseManager(db_file.name))
            result = executor.run(
                "CREATE TABLE Student (Name TEXT);",
                run_anyway=True,
            )

        self.assertFalse(result["blocked_by_lint"])
        self.assertTrue("success" in result)

    def test_cambridge_only_statement_succeeds(self):
        with tempfile.NamedTemporaryFile(suffix=".db") as db_file:
            executor = Executor(db=DatabaseManager(db_file.name))
            result = executor.run("CREATE DATABASE School;", run_anyway=True)

        self.assertTrue(result["success"])
        self.assertEqual(result["result"]["type"], "validated_only")


if __name__ == "__main__":
    unittest.main()
