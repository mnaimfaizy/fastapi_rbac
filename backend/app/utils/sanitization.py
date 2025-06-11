"""
Input sanitization utilities for XSS prevention and data cleaning.

This module provides comprehensive input sanitization functions to prevent
Cross-Site Scripting (XSS) attacks and clean user input data.
"""

import html
import re
from typing import Any, Dict, List, Optional

import bleach

# Define allowed HTML tags and attributes for rich text fields
ALLOWED_TAGS = [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "ol",
    "ul",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
]

ALLOWED_ATTRIBUTES = {
    "*": ["class"],
    "a": ["href", "title"],
    "abbr": ["title"],
    "acronym": ["title"],
}

# Protocols allowed for links
ALLOWED_PROTOCOLS = ["http", "https", "mailto"]


def sanitize_html(
    value: str,
    allowed_tags: Optional[List[str]] = None,
    allowed_attributes: Optional[Dict[str, List[str]]] = None,
) -> str:
    """
    Sanitize HTML content to prevent XSS attacks.

    Args:
        value: The HTML string to sanitize
        allowed_tags: List of allowed HTML tags (uses default if None)
        allowed_attributes: Dict of allowed attributes per tag (uses default if None)

    Returns:
        Sanitized HTML string
    """
    if not value:
        return ""

    tags = allowed_tags or ALLOWED_TAGS
    attributes = allowed_attributes or ALLOWED_ATTRIBUTES

    return bleach.clean(value, tags=tags, attributes=attributes, protocols=ALLOWED_PROTOCOLS, strip=True)


def sanitize_text(value: str) -> str:
    """
    Sanitize plain text by removing all HTML tags and escaping special characters.

    Args:
        value: The text string to sanitize

    Returns:
        Sanitized plain text string
    """
    if not value:
        return ""

    # Remove all HTML tags
    clean_text = bleach.clean(value, tags=[], attributes={}, strip=True)

    # Escape HTML entities
    return html.escape(clean_text)


def sanitize_filename(filename: str) -> str:
    """
    Sanitize a filename to prevent directory traversal attacks.

    Args:
        filename: The filename to sanitize

    Returns:
        Sanitized filename
    """
    if not filename:
        return ""

    # Remove path separators and special characters
    sanitized = re.sub(r"[^\w\s\-_\.]", "", filename)

    # Remove multiple spaces and convert to single space
    sanitized = re.sub(r"\s+", " ", sanitized).strip()

    # Prevent hidden files and relative paths
    sanitized = sanitized.lstrip(".")

    # Ensure filename is not empty after sanitization
    if not sanitized:
        return "unnamed_file"

    return sanitized


def sanitize_email(email: str) -> str:
    """
    Sanitize email address input.

    Args:
        email: The email address to sanitize

    Returns:
        Sanitized email address
    """
    if not email:
        return ""

    # Basic email sanitization - remove HTML and trim
    sanitized = sanitize_text(email).strip().lower()

    # Basic email format validation (additional validation should be done separately)
    email_pattern = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")

    if email_pattern.match(sanitized):
        return sanitized

    # If invalid format, return empty string (let validation handle the error)
    return ""


def sanitize_search_query(query: str) -> str:
    """
    Sanitize search query input to prevent injection attacks.

    Args:
        query: The search query to sanitize

    Returns:
        Sanitized search query
    """
    if not query:
        return ""

    # Remove HTML tags and escape special characters
    sanitized = sanitize_text(query)

    # Remove potentially dangerous SQL characters
    sanitized = re.sub(r"[;\'\"\\]", "", sanitized)

    # Limit length to prevent DoS
    return sanitized[:500].strip()


def sanitize_json_values(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Recursively sanitize string values in a dictionary/JSON object.

    Args:
        data: Dictionary with potential string values to sanitize

    Returns:
        Dictionary with sanitized string values
    """
    if not isinstance(data, dict):
        return data

    sanitized = {}

    for key, value in data.items():
        if isinstance(value, str):
            # Sanitize string values
            sanitized[key] = sanitize_text(value)
        elif isinstance(value, dict):
            # Recursively sanitize nested dictionaries
            sanitized[key] = sanitize_json_values(value)
        elif isinstance(value, list):
            # Sanitize list items
            sanitized[key] = [
                (
                    sanitize_text(item)
                    if isinstance(item, str)
                    else sanitize_json_values(item) if isinstance(item, dict) else item
                )
                for item in value
            ]
        else:
            # Keep non-string values as-is
            sanitized[key] = value

    return sanitized


def sanitize_url(url: str) -> str:
    """
    Sanitize URL input to prevent XSS and injection attacks.

    Args:
        url: The URL to sanitize

    Returns:
        Sanitized URL or empty string if invalid
    """
    if not url:
        return ""

    # Remove HTML tags and escape
    sanitized = sanitize_text(url).strip()

    # Check for allowed protocols
    allowed_url_pattern = re.compile(
        r"^https?://[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?"
        r"(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*"
        r"(:[0-9]{1,5})?(/.*)?$"
    )

    if allowed_url_pattern.match(sanitized):
        return sanitized

    # If invalid format, return empty string
    return ""


class InputSanitizer:
    """
    Class-based input sanitizer for dependency injection.
    """

    def __init__(self, strict_mode: bool = True, max_length: int = 10000):
        """
        Initialize the input sanitizer.

        Args:
            strict_mode: If True, applies stricter sanitization rules
            max_length: Maximum allowed length for input strings
        """
        self.strict_mode = strict_mode
        self.max_length = max_length

    def sanitize(self, value: Any, field_type: str = "text") -> Any:
        """
        Sanitize input value based on field type.

        Args:
            value: The value to sanitize
            field_type: Type of field ("text", "html", "email", "url", "search", "filename")

        Returns:
            Sanitized value
        """
        if value is None:
            return None

        if not isinstance(value, str):
            return value

        # Truncate if too long
        if len(value) > self.max_length:
            value = value[: self.max_length]

        # Apply sanitization based on field type
        if field_type == "html":
            return sanitize_html(value)
        elif field_type == "email":
            return sanitize_email(value)
        elif field_type == "url":
            return sanitize_url(value)
        elif field_type == "search":
            return sanitize_search_query(value)
        elif field_type == "filename":
            return sanitize_filename(value)
        else:  # default to text
            return sanitize_text(value)

    def sanitize_dict(
        self, data: Dict[str, Any], field_types: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Sanitize all string values in a dictionary.

        Args:
            data: Dictionary to sanitize
            field_types: Optional mapping of field names to their types

        Returns:
            Dictionary with sanitized values
        """
        if not isinstance(data, dict):
            return data

        field_types = field_types or {}
        sanitized = {}

        for key, value in data.items():
            field_type = field_types.get(key, "text")
            sanitized[key] = self.sanitize(value, field_type)

        return sanitized


# Default sanitizer instance
default_sanitizer = InputSanitizer()


# Convenience functions using default sanitizer
def sanitize_input(value: Any, field_type: str = "text") -> Any:
    """Convenience function for sanitizing input using default sanitizer."""
    return default_sanitizer.sanitize(value, field_type)


def sanitize_form_data(data: Dict[str, Any], field_types: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """Convenience function for sanitizing form data using default sanitizer."""
    return default_sanitizer.sanitize_dict(data, field_types)
