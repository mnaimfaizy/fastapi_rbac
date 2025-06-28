#!/usr/bin/env python3
"""
Script to fix relative imports in test files.
"""
import re
from pathlib import Path


def fix_relative_imports(file_path: Path) -> None:
    """Fix relative imports in a single file."""
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Replace relative imports with absolute imports
    patterns = [
        (r"from \.utils import ([^,\n]+)", r"from test.utils import \1"),
        (r"from \.utils import ([^,\n]+,[^,\n]+)", r"from test.utils import \1"),
        (r"from \.utils import ([^,\n]+,[^,\n]+,[^,\n]+)", r"from test.utils import \1"),
    ]

    updated = False
    for pattern, replacement in patterns:
        if re.search(pattern, content):
            content = re.sub(pattern, replacement, content)
            updated = True

    if updated:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Fixed imports in {file_path}")
    else:
        print(f"No changes needed in {file_path}")


def main() -> None:
    """Fix relative imports in all test files."""
    backend_dir = Path(__file__).parent
    test_unit_dir = backend_dir / "test" / "unit"

    # Find all Python test files
    test_files = list(test_unit_dir.glob("test_*.py"))

    for test_file in test_files:
        if test_file.name == "test_config.py":
            continue  # Skip the config file we already fixed
        fix_relative_imports(test_file)


if __name__ == "__main__":
    main()
