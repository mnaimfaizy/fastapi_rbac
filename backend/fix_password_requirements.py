#!/usr/bin/env python3
"""
Fix password requirements in IUserCreate usage in test files.
"""

import re
from pathlib import Path


def fix_password_in_user_create() -> None:
    """Fix missing password field in IUserCreate instances."""

    test_file = Path("test/unit/test_crud_user_enhanced.py")

    if not test_file.exists():
        print(f"File {test_file} not found")
        return

    print(f"Processing {test_file}")

    with open(test_file, "r", encoding="utf-8") as f:
        content = f.read()

    original_content = content

    # Pattern to find IUserCreate instances that are missing password
    # Look for IUserCreate with parentheses and capture the content
    pattern = r"(IUserCreate\s*\(\s*)((?:[^)]*\n?)*?)(\s*\))"

    def add_password_if_missing(match: re.Match) -> str:
        prefix = match.group(1)
        content = match.group(2)
        suffix = match.group(3)

        # Check if password is already present
        if "password=" in content:
            return match.group(0)  # Return unchanged if password is already there

        # Add password field
        if content.strip():
            # If there's existing content, add comma and password
            content = content.rstrip().rstrip(",") + ',\n            password="test_password123",'
        else:
            # If no existing content, just add password
            content = '\n            password="test_password123",\n        '

        return prefix + content + suffix

    # Apply the pattern
    content = re.sub(pattern, add_password_if_missing, content, flags=re.MULTILINE | re.DOTALL)

    # Write the file if changes were made
    if content != original_content:
        with open(test_file, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"✓ Fixed password requirements in {test_file}")
    else:
        print(f"No changes needed in {test_file}")


if __name__ == "__main__":
    fix_password_in_user_create()
