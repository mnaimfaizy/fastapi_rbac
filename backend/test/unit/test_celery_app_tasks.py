"""Ensure Celery workers register task modules from app.worker."""

from app.celery_app import celery_app


def test_celery_app_imports_worker_tasks() -> None:
    """Worker boot via app.celery_app must register security/email tasks."""
    registered = set(celery_app.tasks.keys())
    assert "app.worker.log_security_event_task" in registered
    assert "app.worker.send_email_task" in registered
    assert "app.worker.cleanup_tokens_task" in registered
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
    import app.celery_beat_schedule  # noqa: F401  (registers the schedule)

    entry = celery_app.conf.beat_schedule["cleanup-unverified-users"]
    assert entry["task"] == "app.worker.cleanup_unverified_users_task"
    assert entry["options"]["queue"] == "periodic_tasks"


def test_registration_no_longer_sleeps_in_process() -> None:
    """The 72-hour asyncio.sleep is gone from the request path (#136)."""
    import app.utils.background_tasks as background_tasks

    assert not hasattr(background_tasks, "cleanup_unverified_account")
