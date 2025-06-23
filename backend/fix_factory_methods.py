#!/usr/bin/env python3
"""
Script to fix factory method calls in test files.
"""
import re
from pathlib import Path


def fix_factory_methods(file_path: Path):
    """Fix factory method calls in a single file."""
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    updated = False

    # Replace create_verified_user with create (since verified=True is default)
    if "create_verified_user(" in content:
        content = content.replace("create_verified_user(", "create(")
        updated = True

    # Replace create_unverified_user with create_unverified
    if "create_unverified_user(" in content:
        content = content.replace("create_unverified_user(", "create_unverified(")
        updated = True

    if updated:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Fixed factory methods in {file_path}")
    else:
        print(f"No changes needed in {file_path}")


def main():
    """Fix factory method calls in test files."""
    backend_dir = Path(__file__).parent
    test_file = backend_dir / "test" / "unit" / "test_crud_user_enhanced.py"

    if test_file.exists():
        fix_factory_methods(test_file)
    else:
        print(f"File not found: {test_file}")


if __name__ == "__main__":
    main()
