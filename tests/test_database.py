import tempfile
import unittest

from database import DatabaseManager, split_sql_statements


class DatabaseTests(unittest.TestCase):
    def test_split_preserves_semicolon_inside_string(self):
        statements = split_sql_statements(
            "INSERT INTO Notes (Text) VALUES ('hello; world'); SELECT * FROM Notes;"
        )
        self.assertEqual(len(statements), 2)

    def test_failed_script_rolls_back(self):
        with tempfile.NamedTemporaryFile(suffix=".db") as db_file:
            db = DatabaseManager(db_file.name)
            db.execute("CREATE TABLE Student (StudentID INTEGER);")

            with self.assertRaises(Exception):
                db.execute(
                    "INSERT INTO Student (StudentID) VALUES (1); "
                    "INSERT INTO MissingTable (ID) VALUES (2);"
                )

            result = db.execute("SELECT * FROM Student;")
            self.assertEqual(result["rows"], [])

    def test_create_database_is_validated_only(self):
        with tempfile.NamedTemporaryFile(suffix=".db") as db_file:
            db = DatabaseManager(db_file.name)
            result = db.execute("CREATE DATABASE School;")

        self.assertEqual(result["type"], "validated_only")
        self.assertIn("valid Cambridge 9618 syntax", result["message"])


if __name__ == "__main__":
    unittest.main()
