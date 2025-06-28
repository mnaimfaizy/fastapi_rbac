#!/usr/bin/env python3
"""
Script to fix CRUD method calls in test_crud_user_enhanced.py
"""

import re


def fix_crud_calls() -> None:
    """Fix CRUD method calls in the test file."""
    file_path = "test/unit/test_crud_user_enhanced.py"

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Fix get_multi_paginated calls to add db_session parameter
    content = re.sub(
        r"await crud\.user\.get_multi_paginated\(params=",
        r"await crud.user.get_multi_paginated(db_session=db, params=",
        content,
    )

    # 2. Fix update method calls: replace db_obj with obj_current and obj_in with obj_new
    content = re.sub(
        r"await crud\.user\.update\(db_session=db, db_obj=([^,]+), obj_in=([^)]+)\)",
        r"await crud.user.update(db_session=db, obj_current=\1, obj_new=\2)",
        content,
    )

    # 3. Fix Params usage - replace dict with Params class
    content = re.sub(r'params=\{"page": (\d+), "size": (\d+)\}', r"params=Params(page=\1, size=\2)", content)

    # 4. Add import for Params at the top
    if "from fastapi_pagination import Params" not in content:
        # Find the imports section and add the Params import
        import_section = re.search(r"(from sqlmodel[^\n]*\n)", content)
        if import_section:
            content = content.replace(
                import_section.group(1), import_section.group(1) + "from fastapi_pagination import Params\n"
            )

    # Write back the fixed content
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

    print("Fixed CRUD method calls in test_crud_user_enhanced.py")


if __name__ == "__main__":
    fix_crud_calls()
