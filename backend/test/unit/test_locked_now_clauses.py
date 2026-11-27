"""locked_now_clauses encodes the predicate the Locked accounts count uses."""

from sqlalchemy.dialects import sqlite
from sqlmodel import select

from app.dashboard_metrics import locked_now_clauses
from app.models.user_model import User


def test_locked_now_clauses_predicate() -> None:
    clauses = locked_now_clauses()
    assert len(clauses) == 3
    sql = str(
        select(User)
        .where(*clauses)
        .compile(dialect=sqlite.dialect(), compile_kwargs={"literal_binds": False})
    )
    where = sql.split("WHERE", 1)[1]
    assert "is_locked" in where
    assert "locked_until IS NOT NULL" in where
    assert "locked_until >" in where
