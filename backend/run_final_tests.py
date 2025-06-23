#!/usr/bin/env python3
"""
Final test results summary
"""

import subprocess
import sys


def run_all_unit_tests():
    """Run all unit tests and provide a summary."""
    print("🚀 Running complete unit test suite...")
    print("=" * 60)

    try:
        result = subprocess.run(
            [sys.executable, "-m", "pytest", "test/unit/", "--tb=line", "-v"],
            capture_output=True,
            text=True,
            timeout=300,  # 5 minutes timeout
        )

        print("STDOUT:")
        print(result.stdout)

        if result.stderr:
            print("\nSTDERR:")
            print(result.stderr)

        print(f"\nReturn code: {result.returncode}")

        if result.returncode == 0:
            print("🎉 ALL TESTS PASSED!")
        else:
            print("❌ Some tests failed.")

    except subprocess.TimeoutExpired:
        print("⏰ Tests timed out after 5 minutes")
    except Exception as e:
        print(f"❌ Error running tests: {e}")


if __name__ == "__main__":
    run_all_unit_tests()
