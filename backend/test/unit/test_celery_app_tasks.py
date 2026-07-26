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
