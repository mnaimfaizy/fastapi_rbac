#!/usr/bin/env python3
"""
Script to test all unit test files systematically and report results.
"""
import subprocess
import sys
from pathlib import Path


def run_test_file(test_file: Path) -> dict:
    """Run a single test file and return the results."""
    cmd = [sys.executable, "-m", "pytest", str(test_file), "-v", "--tb=short", "--disable-warnings"]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)  # 60 second timeout

        return {
            "file": test_file.name,
            "returncode": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "status": "PASSED" if result.returncode == 0 else "FAILED",
        }
    except subprocess.TimeoutExpired:
        return {
            "file": test_file.name,
            "returncode": -1,
            "stdout": "",
            "stderr": "Test timed out",
            "status": "TIMEOUT",
        }
    except Exception as e:
        return {"file": test_file.name, "returncode": -1, "stdout": "", "stderr": str(e), "status": "ERROR"}


def main():
    """Test all unit test files and report results."""
    backend_dir = Path(__file__).parent
    test_unit_dir = backend_dir / "test" / "unit"

    # Get all test files
    test_files = sorted(test_unit_dir.glob("test_*.py"))

    results = []

    print("Testing all unit test files...")
    print("=" * 60)

    for test_file in test_files:
        print(f"Testing {test_file.name}...")
        result = run_test_file(test_file)
        results.append(result)

        print(f"  Status: {result['status']}")
        if result["status"] != "PASSED":
            # Print first few lines of error
            error_lines = result["stderr"].split("\n")[:3]
            for line in error_lines:
                if line.strip():
                    print(f"  Error: {line.strip()}")
        print()

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY:")
    print("=" * 60)

    passed = [r for r in results if r["status"] == "PASSED"]
    failed = [r for r in results if r["status"] == "FAILED"]
    errors = [r for r in results if r["status"] in ["ERROR", "TIMEOUT"]]

    print(f"Total files tested: {len(results)}")
    print(f"Passed: {len(passed)}")
    print(f"Failed: {len(failed)}")
    print(f"Errors/Timeouts: {len(errors)}")

    if passed:
        print(f"\nPASSED FILES:")
        for result in passed:
            print(f"  ✅ {result['file']}")

    if failed:
        print(f"\nFAILED FILES:")
        for result in failed:
            print(f"  ❌ {result['file']}")

    if errors:
        print(f"\nERROR FILES:")
        for result in errors:
            print(
                f"  🚫 {result['file']} - {result['stderr'].split()[0] if result['stderr'] else 'Unknown error'}"
            )


if __name__ == "__main__":
    main()
