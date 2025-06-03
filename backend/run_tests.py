#!/usr/bin/env python
"""
Test runner script that provides options for running tests in different environments.
This script helps standardize test execution between local development and CI.
"""
import argparse
import os
import subprocess
import sys
from enum import Enum


class TestEnv(str, Enum):
    """Test environment options"""

    LOCAL_SQLITE = "sqlite"
    LOCAL_POSTGRES = "postgres"
    DOCKER = "docker"
    CI = "ci"


def setup_env_vars(env: TestEnv) -> None:
    """Set up environment variables based on test environment"""
    # Default to SQLite for local testing
    os.environ["MODE"] = "testing"

    if env == TestEnv.LOCAL_POSTGRES:
        os.environ["TEST_DB_TYPE"] = "postgres"
        os.environ["TEST_POSTGRES_USER"] = os.environ.get(
            "TEST_POSTGRES_USER", "postgres"
        )
        os.environ["TEST_POSTGRES_PASSWORD"] = os.environ.get(
            "TEST_POSTGRES_PASSWORD", "postgres"
        )
        os.environ["TEST_POSTGRES_HOST"] = os.environ.get(
            "TEST_POSTGRES_HOST", "localhost"
        )
        os.environ["TEST_POSTGRES_PORT"] = os.environ.get("TEST_POSTGRES_PORT", "5432")
        os.environ["TEST_POSTGRES_DB"] = os.environ.get("TEST_POSTGRES_DB", "test_db")
        print("Using local PostgreSQL database for testing")
    elif env == TestEnv.CI:
        # CI environment variables are typically set by the CI system
        os.environ["TEST_DB_TYPE"] = "postgres"
        print("Using CI environment for testing")
    else:  # Default to SQLite
        os.environ["TEST_DB_TYPE"] = "sqlite"
        print("Using SQLite in-memory database for testing")

    # Redis configuration
    os.environ["TEST_REDIS_USE_MOCK"] = "true"  # Default to mock Redis


def run_docker_tests() -> int:
    """Run tests in Docker containers"""
    print("Running tests in Docker environment...")
    result = subprocess.run(
        [
            "docker-compose",
            "-f",
            "docker-compose.test.yml",
            "up",
            "--build",
            "--abort-on-container-exit",
        ],
        check=False,
    )
    # Clean up containers after test
    subprocess.run(
        ["docker-compose", "-f", "docker-compose.test.yml", "down", "-v"],
        check=False,
    )
    return result.returncode


def run_local_tests(args: argparse.Namespace) -> int:
    """Run tests locally with pytest"""
    print(f"Running tests locally with {'coverage' if args.coverage else 'pytest'}...")

    # Build the pytest command
    cmd = []

    if args.coverage:
        cmd.extend(["coverage", "run", "-m", "pytest"])
    else:
        cmd.append("pytest")

    # Add verbosity flags
    if args.verbose:
        cmd.append("-v")

    # Add specific test path if provided
    if args.test_path:
        cmd.append(args.test_path)

    # Generate HTML coverage report if requested
    result = subprocess.run(cmd, check=False)

    if args.coverage and result.returncode == 0:
        print("Generating coverage report...")
        subprocess.run(["coverage", "report", "-m"], check=False)
        subprocess.run(["coverage", "html"], check=False)
        print("Coverage report generated in htmlcov/ directory")

    return result.returncode


def main() -> int:
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Run FastAPI RBAC tests")
    parser.add_argument(
        "--env",
        type=TestEnv,
        choices=list(TestEnv),
        default=TestEnv.LOCAL_SQLITE,
        help="Test environment (default: sqlite)",
    )
    parser.add_argument(
        "--coverage", action="store_true", help="Run tests with coverage"
    )
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    parser.add_argument(
        "test_path", nargs="?", help="Path to specific test file or directory"
    )

    args = parser.parse_args()

    if args.env == TestEnv.DOCKER:
        # Run tests in Docker
        return run_docker_tests()
    else:
        # Set up environment variables
        setup_env_vars(args.env)

        # Run tests locally
        return run_local_tests(args)


if __name__ == "__main__":
    sys.exit(main())
