import re

KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'INNER JOIN', 'ON',
    'CREATE TABLE', 'INSERT INTO', 'VALUES',
    'UPDATE', 'SET', 'DELETE FROM',
    'ORDER BY', 'GROUP BY'
]

ALLOWED_TYPES = [
    'INTEGER', 'REAL', 'CHARACTER', 'VARCHAR', 'BOOLEAN', 'DATE', 'TIME'
]

FORBIDDEN_TYPES = {
    r'\bINT\b': 'INTEGER',
    r'\bTEXT\b': 'VARCHAR(n)',
    r'\bNUMBER\b': 'INTEGER or REAL',
    r'\bDATETIME\b': 'DATE or TIME',
    r'\bBIT\b': 'BOOLEAN'
}


def lint_cambridge_sql(sql_code: str):
    errors = []
    warnings = []

    lines = sql_code.split('\n')

    for i, line in enumerate(lines, start=1):
        clean = line.strip()

        if not clean or clean.startswith('--'):
            continue

        # Forbidden types
        for pattern, replacement in FORBIDDEN_TYPES.items():
            if re.search(pattern, clean, re.IGNORECASE):
                errors.append({
                    "line": i,
                    "message": f"Use Cambridge datatype instead: {replacement}"
                })

        # Missing semicolon warning
        if i == len(lines) and not clean.endswith(';'):
            warnings.append({
                "line": i,
                "message": "Final statement should end with semicolon"
            })

    return {
        "errors": errors,
        "warnings": warnings
    }