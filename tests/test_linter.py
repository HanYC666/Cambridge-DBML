import unittest

from linter import lint_cambridge_sql


class LinterTests(unittest.TestCase):
    def test_blocks_forbidden_datatype(self):
        result = lint_cambridge_sql("CREATE TABLE Student (Name TEXT);")
        self.assertTrue(result["errors"])
        self.assertTrue(any("VARCHAR" in item["message"] for item in result["errors"]))

    def test_missing_semicolon_is_error(self):
        result = lint_cambridge_sql("SELECT * FROM Student")
        self.assertTrue(any("semicolon" in item["message"].lower() for item in result["errors"]))

    def test_out_of_syllabus_limit_is_warning(self):
        result = lint_cambridge_sql("SELECT * FROM Student LIMIT 5;")
        self.assertTrue(any("LIMIT" in item["message"] for item in result["warnings"]))


if __name__ == "__main__":
    unittest.main()
