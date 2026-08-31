"""Ensure Celery workers register task modules from app.worker."""

import subprocess
import sys
from pathlib import Path

from app.celery_app import celery_app


def test_celery_app_imports_worker_tasks() -> None:
    """Worker boot via app.celery_app must register security/email tasks."""
    registered = set(celery_app.tasks.keys())
    assert "app.worker.log_security_event_task" in registered
    assert "app.worker.send_email_task" in registered
    assert "app.worker.process_account_lockout_task" in registered


def test_celery_config_lists_worker_imports() -> None:
    """conf.imports keeps task registration for celery -A app.celery_app."""
    imports = tuple(celery_app.conf.imports or ())
    assert "app.worker" in imports


def test_celery_app_registers_unverified_cleanup_task() -> None:
    """The sweep that replaced the in-process sleep must be a real task (#136)."""
    assert "app.worker.cleanup_unverified_users_task" in set(celery_app.tasks.keys())


def test_beat_schedules_the_unverified_cleanup_sweep() -> None:
    """Beat drives the sweep; without an entry, pending users accumulate forever."""
    entry = celery_app.conf.beat_schedule["cleanup-unverified-users"]
    assert entry["task"] == "app.worker.cleanup_unverified_users_task"
    assert entry["options"]["queue"] == "periodic_tasks"


def test_beat_schedule_only_names_registered_tasks() -> None:
    """Every scheduled name must resolve to a task some worker can run.

    Beat does not validate task names: it dispatches whatever the schedule says
    and the message dies as NotRegistered in the worker. Four entries pointed at
    app.scheduled_tasks for months after that module was truncated to zero bytes
    and nothing caught it, so this walks the live schedule rather than asserting
    a fixed list of names.
    """
    registered = set(celery_app.tasks.keys())
    scheduled = {name: entry["task"] for name, entry in celery_app.conf.beat_schedule.items()}

    unregistered = {name: task for name, task in scheduled.items() if task not in registered}
    assert not unregistered, f"beat entries naming tasks no worker can execute: {unregistered}"


def test_beat_entrypoint_alone_carries_the_schedule() -> None:
    """`celery -A app.celery_app beat` must see the schedule on a cold import.

    Asserted in a subprocess because this one is only true of a process that
    imports nothing else: the schedule module used to be imported by app.main
    alone, which the beat container never loads, so conf.beat_schedule was empty
    wherever it actually mattered (#136).
    """
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "from app.celery_app import celery_app;"
            "print('cleanup-unverified-users' in celery_app.conf.beat_schedule)",
        ],
        cwd=Path(__file__).resolve().parents[2],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip().endswith("True"), result.stdout
