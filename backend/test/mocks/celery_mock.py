"""
Celery service mocks for testing.
"""

from typing import Any, Callable, Dict, List, Optional
from unittest.mock import MagicMock


class MockCeleryTask(MagicMock):
    """Mock Celery task for testing."""

    def __init__(self, name: str = "mock_task", *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.name = name
        self.called_tasks: List[Dict[str, Any]] = []

    def delay(self, *args: Any, **kwargs: Any) -> "MockCeleryResult":
        """Mock task.delay() method."""
        task_call = {"task_name": self.name, "args": args, "kwargs": kwargs, "method": "delay"}
        self.called_tasks.append(task_call)
        return MockCeleryResult(task_id=f"task_{len(self.called_tasks)}")

    def apply_async(self, args: Any = None, kwargs: Any = None, **options: Any) -> "MockCeleryResult":
        """Mock task.apply_async() method."""
        task_call = {
            "task_name": self.name,
            "args": args or (),
            "kwargs": kwargs or {},
            "options": options,
            "method": "apply_async",
        }
        self.called_tasks.append(task_call)
        return MockCeleryResult(task_id=f"task_{len(self.called_tasks)}")

    def clear_calls(self) -> None:
        """Clear the task call history."""
        self.called_tasks.clear()


class MockCeleryResult:
    """Mock Celery AsyncResult for testing."""

    def __init__(self, task_id: str, state: str = "SUCCESS", result: Any = None) -> None:
        self.task_id = task_id
        self.state = state
        self.result = result

    def get(self, timeout: Optional[float] = None) -> Any:
        """Mock get() method."""
        return self.result

    def ready(self) -> bool:
        """Mock ready() method."""
        return self.state in ["SUCCESS", "FAILURE"]

    def successful(self) -> bool:
        """Mock successful() method."""
        return self.state == "SUCCESS"

    def failed(self) -> bool:
        """Mock failed() method."""
        return self.state == "FAILURE"


class MockCeleryApp:
    """Mock Celery application for testing."""

    def __init__(self) -> None:
        self.tasks: Dict[str, MockCeleryTask] = {}
        self.task_calls: List[Dict[str, Any]] = []

    def task(self, name: Optional[str] = None, **kwargs: Any) -> Callable:
        """Mock task decorator."""

        def decorator(func: Callable) -> MockCeleryTask:
            task_name = name or func.__name__
            mock_task = MockCeleryTask(name=task_name)
            mock_task.func = func
            self.tasks[task_name] = mock_task
            return mock_task

        return decorator

    def send_task(self, name: str, args: Any = None, kwargs: Any = None, **options: Any) -> MockCeleryResult:
        """Mock send_task method."""
        task_call = {
            "task_name": name,
            "args": args or (),
            "kwargs": kwargs or {},
            "options": options,
            "method": "send_task",
        }
        self.task_calls.append(task_call)
        return MockCeleryResult(task_id=f"task_{len(self.task_calls)}")

    def get_task_calls(self, task_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get task calls, optionally filtered by task name."""
        if task_name:
            return [call for call in self.task_calls if call["task_name"] == task_name]
        return self.task_calls

    def clear_calls(self) -> None:
        """Clear all task call history."""
        self.task_calls.clear()
        for task in self.tasks.values():
            task.clear_calls()
