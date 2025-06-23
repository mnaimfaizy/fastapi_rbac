from typing import Any, Dict, Optional

from fastapi import HTTPException, status


class UserSelfDeleteException(HTTPException):
    def __init__(
        self,
        headers: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Users can not delete theirselfs.",
            headers=headers,
        )


class UserNotFoundException(HTTPException):
    def __init__(
        self,
        user_id: str = None,
        email: str = None,
        headers: Optional[Dict[str, Any]] = None,
    ) -> None:
        if user_id:
            detail = f"User with ID {user_id} not found."
        elif email:
            detail = f"User with email {email} not found."
        else:
            detail = "User not found."

        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
            headers=headers,
        )
