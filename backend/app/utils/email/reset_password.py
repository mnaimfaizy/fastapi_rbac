from app.core.config import settings
from app.utils.email.email import send_email_with_template


async def send_reset_password_email(
    email: str,
    token: str,
    reset_url: str = None,
) -> None:
    """
    Send a password reset email to a user.

    Args:
        email: The recipient's email address
        token: The password reset token
        reset_url: The complete URL to reset the password (optional)
    """
    # Use the provided reset URL or construct one from settings
    reset_link = reset_url or f"{settings.PASSWORD_RESET_URL}?token={token}"

    project_name = settings.PROJECT_NAME
    subject = f"{project_name} - Password Recovery"

    # Template context variables
    template_context = {
        "project_name": settings.PROJECT_NAME,
        "username": email,  # Use email as username
        "email": email,
        "reset_password_url": reset_link,
        "token": token,
        "valid_hours": settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES // 60,
    }

    # Send the email using the password-reset.html template
    send_email_with_template(
        email_to=email,
        subject=subject,
        template_name="password-reset.html",
        context=template_context,
    )
