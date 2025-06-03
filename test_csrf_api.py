#!/usr/bin/env python3
"""
Test script to understand fastapi-csrf-protect API.
"""

from fastapi_csrf_protect import CsrfProtect

# Check available methods and attributes
print("CsrfProtect class attributes and methods:")
for attr in dir(CsrfProtect):
    if not attr.startswith("_"):
        print(f"  {attr}")

# Try to see if there's a Settings class
try:
    from fastapi_csrf_protect import CsrfSettings

    print("\nCsrfSettings class attributes:")
    for attr in dir(CsrfSettings):
        if not attr.startswith("_"):
            print(f"  {attr}")
except ImportError:
    print("\nNo CsrfSettings class found")

# Check if there's documentation in __doc__
if CsrfProtect.__doc__:
    print(f"\nCsrfProtect documentation:\n{CsrfProtect.__doc__}")
