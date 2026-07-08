import tempfile
import unittest

import app as app_module
from database import DatabaseManager
from executor import Executor


class AppTests(unittest.TestCase):
    def setUp(self):
        self.db_file = tempfile.NamedTemporaryFile(suffix=".db")
        app_module.executor = Executor(db=DatabaseManager(self.db_file.name))
        self.client = app_module.app.test_client()

    def tearDown(self):
        self.db_file.close()

    def test_execute_rejects_invalid_json(self):
        response = self.client.post(
            "/api/execute",
            data="not json",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.get_json()["success"])

    def test_execute_requires_sql_string(self):
        response = self.client.post("/api/execute", json={})
        self.assertEqual(response.status_code, 400)
        self.assertIn("sql", response.get_json()["error"])

    def test_invalid_table_name_returns_400(self):
        response = self.client.get("/api/table/not-valid!")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.get_json()["success"])

    def test_lint_blocked_execution_returns_flag(self):
        response = self.client.post(
            "/api/execute",
            json={"sql": "CREATE TABLE Student (Name TEXT);"},
        )
        payload = response.get_json()
        self.assertEqual(response.status_code, 200)
        self.assertFalse(payload["success"])
        self.assertTrue(payload["blocked_by_lint"])


if __name__ == "__main__":
    unittest.main()
