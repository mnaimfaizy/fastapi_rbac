"""
Tools for loading and validating common passwords.
"""

import os
from typing import Optional, Set

import zxcvbn  # Advanced password strength estimation

_COMMON_PASSWORDS: Optional[Set[str]] = None


def load_common_passwords() -> Set[str]:
    """
    Load common passwords from files in the project's password lists directory.
    """
    global _COMMON_PASSWORDS
    if _COMMON_PASSWORDS is not None:
        return _COMMON_PASSWORDS

    common_passwords: set[str] = set()
    password_lists_dir = os.path.join(os.path.dirname(__file__), "password_lists")

    # Create password_lists directory if it doesn't exist
    if not os.path.exists(password_lists_dir):
        os.makedirs(password_lists_dir)

    # List of common password files to check
    password_files = [
        "10k_most_common.txt",  # 10,000 most common passwords
        "english_words.txt",  # Common English words
        "names.txt",  # Common names
    ]

    for filename in password_files:
        file_path = os.path.join(password_lists_dir, filename)
        if os.path.exists(file_path):
            with open(file_path, "r", encoding="utf-8") as f:
                common_passwords.update(line.strip().lower() for line in f)

    _COMMON_PASSWORDS = common_passwords
    return common_passwords


def estimate_password_strength(password: str) -> dict:
    """
    Estimate password strength using zxcvbn.

    Returns:
        dict: Password strength evaluation including:
            - score (0-4)
            - crack_times_display
            - feedback
            - warning
            - suggestions
    """
    # Load common passwords if not already loaded
    common_passwords = load_common_passwords()

    # Add common passwords to zxcvbn's dictionary
    result = zxcvbn(password, user_inputs=list(common_passwords))  # type: ignore

    # Map zxcvbn score to descriptive strength
    strength_map = {0: "Very Weak", 1: "Weak", 2: "Fair", 3: "Strong", 4: "Very Strong"}

    result["strength"] = strength_map[result["score"]]
    return result
