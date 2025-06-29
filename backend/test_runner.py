"""
Comprehensive test runner for the refactored test suite.

This script provides easy ways to run different types of tests:
- All tests
- Unit tests only
- Integration tests only
- Specific test modules
- With coverage reporting
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional

# Ensure .coverage is not a directory before running tests
coverage_path = Path(".coverage")
if coverage_path.exists() and coverage_path.is_dir():
    print("Removing .coverage directory to avoid Docker/coverage conflict...")
    import shutil

    shutil.rmtree(coverage_path)
# Optionally, create an empty .coverage file if it does not exist
if not coverage_path.exists():
    coverage_path.touch()

# Load environment variables from .env.test.local if present
try:
    from dotenv import load_dotenv

    env_path = Path(__file__).parent / ".env.test.local"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        print(f"Loaded environment variables from {env_path}")
except ImportError:
    print("python-dotenv not installed. Skipping .env.test.local loading.")


def run_command(cmd: list[str], cwd: Optional[str] = None) -> int:
    """Run a command and return the exit code."""
    # Replace 'python' with sys.executable for all subprocess calls
    if cmd and cmd[0] == "python":
        cmd[0] = sys.executable
    print(f"Running: {' '.join(cmd)}")
    if cwd:
        print(f"Working directory: {cwd}")

    result = subprocess.run(cmd, cwd=cwd)
    return result.returncode


def run_unit_tests(
    test_path: Optional[str] = None, verbose: bool = False, coverage: bool = False, parallel: bool = False
) -> int:
    """Run unit tests."""
    cmd = ["python", "-m", "pytest"]

    # Test path
    if test_path:
        cmd.append(test_path)
    else:
        cmd.append("test/unit/")

    # Verbose output
    if verbose:
        cmd.extend(["-v", "-s"])

    # Coverage
    if coverage:
        cmd.extend(
            [
                "--cov=app",
                "--cov-branch",
                "--cov-report=html:htmlcov",
                "--cov-report=term-missing",
                "--cov-report=xml:coverage.xml",
                "--cov-fail-under=80",
            ]
        )

    # Parallel execution
    if parallel:
        cmd.extend(["-n", "auto"])

    # Additional pytest options
    cmd.extend(["--tb=short", "--strict-markers", "--disable-warnings"])

    return run_command(cmd)


def run_integration_tests(
    test_path: Optional[str] = None, verbose: bool = False, coverage: bool = False, parallel: bool = False
) -> int:
    """
    Run integration tests using backend/docker-compose.test.minimal.yml and fastapi_rbac_test_runner service.
    All services are started together, and everything is cleaned up after the test run.
    If no test_path is specified, defaults to running all integration tests.
    """
    compose_file = "backend/docker-compose.test.minimal.yml"
    service = "fastapi_rbac_test_runner"
    compose_base_cmd = ["docker-compose", "-f", compose_file]

    # Set environment variables for the test runner service
    os.environ["TEST_PATH"] = test_path if test_path else "test/integration/"
    if verbose:
        os.environ["VERBOSE"] = "1"
    if coverage:
        os.environ["COVERAGE"] = "1"
    if parallel:
        os.environ["PARALLEL"] = "1"

    # Step 1: Run all services, abort on test runner exit, propagate exit code
    up_cmd = compose_base_cmd + ["up", "--abort-on-container-exit", "--exit-code-from", service]
    print("Starting all required services and running integration tests (full stack, isolated)...")
    up_result = run_command(up_cmd, cwd=str(Path(__file__).parent.parent))

    # Step 2: Clean up all containers, networks, and volumes
    down_cmd = compose_base_cmd + ["down", "-v"]
    print("Cleaning up all test containers, networks, and volumes...")
    run_command(down_cmd, cwd=str(Path(__file__).parent.parent))

    # Print summary after cleanup
    if up_result == 0:
        print("\n✅ All integration tests passed!")
    else:
        print("\n❌ Some integration tests failed. See above for details.")

    return up_result


def run_all_tests(
    verbose: bool = False, coverage: bool = False, parallel: bool = False, fast: bool = False
) -> int:
    """Run all tests (unit + integration) in Docker Compose for correct environment and coverage."""
    if not is_running_in_docker():
        compose_file = "backend/docker-compose.test.minimal.yml"
        service = "fastapi_rbac_test_runner"
        compose_base_cmd = ["docker-compose", "-f", compose_file]
        # Pass through relevant environment variables and arguments
        env = os.environ.copy()
        env["TEST_COMMAND"] = "all"
        if coverage:
            env["COVERAGE"] = "1"
        if verbose:
            env["VERBOSE"] = "1"
        if parallel:
            env["PARALLEL"] = "1"
        if fast:
            env["FAST"] = "1"
        env["TEST_PATH"] = "./test"
        up_cmd = compose_base_cmd + ["up", "--abort-on-container-exit", "--exit-code-from", service]
        print("Starting Docker Compose for 'all' tests...")
        result = subprocess.run(up_cmd, cwd=str(Path(__file__).parent.parent), env=env)
        down_cmd = compose_base_cmd + ["down", "-v"]
        print("Cleaning up all test containers, networks, and volumes...")
        subprocess.run(down_cmd, cwd=str(Path(__file__).parent.parent), env=env)
        return result.returncode

    # Fallback to running pytest directly in Docker
    cmd = ["python", "-m", "pytest", "./test"]
    if verbose:
        cmd.extend(["-v", "-s"])
    if coverage:
        cmd.extend(
            [
                "--cov=app",
                "--cov-branch",
                "--cov-report=html:htmlcov",
                "--cov-report=term-missing",
                "--cov-report=xml:coverage.xml",
                "--cov-fail-under=80",
            ]
        )
    if fast:
        cmd.extend(["-m", "not slow"])
    if parallel:
        cmd.extend(["-n", "auto"])
    cmd.extend(["--tb=short", "--strict-markers", "--maxfail=5"])
    return run_command(cmd)


def run_specific_test(
    test_path: str, verbose: bool = False, coverage: bool = False, debug: bool = False
) -> int:
    """Run a specific test or test method."""
    cmd = ["python", "-m", "pytest", test_path]

    # Verbose output
    if verbose:
        cmd.extend(["-v", "-s"])

    # Debug mode
    if debug:
        cmd.extend(["--pdb", "--capture=no"])

    # Coverage
    if coverage:
        cmd.extend(["--cov=app", "--cov-report=term-missing"])

    return run_command(cmd)


def lint_code() -> int:
    """Run code linting."""
    print("Running code linting...")

    # Run flake8
    flake8_result = run_command(
        [
            "python",
            "-m",
            "flake8",
            "app/",
            "test/",
            "--max-line-length=100",
            "--exclude=alembic/versions/,__pycache__/",
            "--ignore=E203,W503",
        ]
    )

    # Run mypy
    mypy_result = run_command(
        ["python", "-m", "mypy", "app/", "--ignore-missing-imports", "--no-strict-optional"]
    )

    return max(flake8_result, mypy_result)


def format_code() -> int:
    """Format code using black and isort."""
    print("Formatting code...")

    # Run black
    black_result = run_command(
        ["python", "-m", "black", "app/", "test/", "--line-length=100", "--target-version=py310"]
    )

    # Run isort
    isort_result = run_command(
        ["python", "-m", "isort", "app/", "test/", "--profile=black", "--line-length=100"]
    )

    return max(black_result, isort_result)


def clean_cache() -> int:
    """Clean pytest and Python cache files."""
    print("Cleaning cache files...")

    import shutil

    # Remove pytest cache
    pytest_cache = Path(".pytest_cache")
    if pytest_cache.exists():
        shutil.rmtree(pytest_cache)
        print("Removed .pytest_cache")

    # Remove __pycache__ directories
    for pycache in Path(".").rglob("__pycache__"):
        shutil.rmtree(pycache)
        print(f"Removed {pycache}")

    # Remove coverage files
    coverage_files = [".coverage", "htmlcov", "coverage.xml"]
    for file in coverage_files:
        path = Path(file)
        if path.exists():
            if path.is_dir():
                shutil.rmtree(path)
            else:
                path.unlink()
            print(f"Removed {file}")

    return 0


def run_demo_suite() -> int:
    """Run the comprehensive demo test suite (showcase)."""
    demo_tests = [
        {
            "cmd": [
                "python",
                "-m",
                "pytest",
                "test/test_api_rbac_comprehensive.py::TestUserEndpoints::test_user_crud_operations",
                "-v",
            ],
            "description": "User CRUD Operations Test",
        },
        {
            "cmd": [
                "python",
                "-m",
                "pytest",
                "test/test_api_rbac_comprehensive.py::TestRoleEndpoints::test_role_crud_operations",
                "-v",
            ],
            "description": "Role CRUD Operations Test",
        },
        {
            "cmd": [
                "python",
                "-m",
                "pytest",
                (
                    "test/test_api_rbac_comprehensive.py::"
                    "TestPermissionEndpoints::test_permission_crud_operations"
                ),
                "-v",
            ],
            "description": "Permission CRUD Operations Test",
        },
        {
            "cmd": ["python", "-m", "pytest", "test/test_simple_mock.py", "-v"],
            "description": "Simple Mock Test (Baseline)",
        },
    ]
    print("\n🚀 FastAPI RBAC Comprehensive Test Suite Demonstration")
    print("=" * 70)
    passed_tests = 0
    total_tests = len(demo_tests)
    for test in demo_tests:
        print(f"\n{'='*60}")
        print(f"Running: {test['description']}")
        print(f"Command: {' '.join(test['cmd'])}")
        print("=" * 60)
        result = subprocess.run(test["cmd"])
        if result.returncode == 0:
            print(f"✅ {test['description']} - PASSED")
            passed_tests += 1
        else:
            print(f"❌ {test['description']} - FAILED")
    # Summary
    print(f"\n{'='*70}")
    print("🎯 TEST SUMMARY")
    print(f"{'='*70}")
    print(f"Passed: {passed_tests}/{total_tests}")
    print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
    if passed_tests == total_tests:
        print("🎉 ALL TESTS PASSED! Comprehensive test suite is functional!")
        print("\n✨ Key Achievements:")
        print("   ✅ Base test infrastructure working")
        print("   ✅ Authentication mocking framework in place")
        print("   ✅ Multiple test classes with proper inheritance")
        print("   ✅ Graceful handling of authentication challenges")
        print("   ✅ Foundation ready for full RBAC testing")
        return 0
    else:
        print(f"❌ {total_tests - passed_tests} tests failed. Check output above.")
        return 1


def is_running_in_docker() -> bool:
    """Check if the code is running inside a Docker container."""
    import os
    from pathlib import Path

    return os.environ.get("IN_DOCKER") == "1" or Path("/.dockerenv").exists()


def cleanup_coverage_files() -> None:
    """Remove old coverage files and directories to avoid permission issues and stale data."""
    import shutil
    from pathlib import Path

    for path in [Path(".coverage"), Path("htmlcov"), Path("coverage.xml")]:
        if path.exists():
            try:
                if path.is_dir():
                    shutil.rmtree(path)
                else:
                    path.unlink()
                print(f"Removed old coverage file or directory: {path}")
            except Exception as e:
                print(f"Warning: Could not remove {path}: {e}")


def main() -> int:
    """Main entry point for the test runner."""
    parser = argparse.ArgumentParser(description="Unified test runner for FastAPI RBAC backend.")
    parser.add_argument(
        "command",
        choices=[
            "all",
            "unit",
            "integration",
            "specific",
            "demo",
            "lint",
            "format",
            "clean",
        ],
        help="Test command to run",
    )
    parser.add_argument("--coverage", action="store_true", help="Enable coverage reporting")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")
    parser.add_argument("--parallel", action="store_true", help="Run tests in parallel")
    parser.add_argument("--fast", action="store_true", help="Skip slow tests (unit only)")
    parser.add_argument("--path", type=str, help="Path to specific test file or method")
    parser.add_argument("--debug", action="store_true", help="Debug mode for specific test")
    args = parser.parse_args()

    # Clean up coverage files before running tests
    cleanup_coverage_files()

    exit_code = 0

    if args.command == "unit":
        exit_code = run_unit_tests(
            test_path=args.path, verbose=args.verbose, coverage=args.coverage, parallel=args.parallel
        )
    elif args.command == "integration":
        exit_code = run_integration_tests(
            test_path=args.path, verbose=args.verbose, coverage=args.coverage, parallel=args.parallel
        )
    elif args.command == "all":
        exit_code = run_all_tests(
            verbose=args.verbose, coverage=args.coverage, parallel=args.parallel, fast=args.fast
        )
    elif args.command == "specific":
        if not args.path:
            print("Error: --path is required for 'specific' command")
            return 1
        exit_code = run_specific_test(
            test_path=args.path, verbose=args.verbose, coverage=args.coverage, debug=args.debug
        )
    elif args.command == "lint":
        exit_code = lint_code()
    elif args.command == "format":
        exit_code = format_code()
    elif args.command == "clean":
        exit_code = clean_cache()
    elif args.command == "health":
        print("Running test health check...")
        # Run a quick smoke test
        exit_code = run_command(["python", "-m", "pytest", "test/unit/test_config.py", "-v", "--tb=short"])
        if exit_code == 0:
            print("✅ Test suite health check passed!")
        else:
            print("❌ Test suite health check failed!")
    elif args.command == "demo":
        exit_code = run_demo_suite()
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
