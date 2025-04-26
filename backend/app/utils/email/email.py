import logging
from pathlib import Path
from typing import Any, Dict

import emails
from emails.template import JinjaTemplate
from jinja2 import Environment, FileSystemLoader

from app.core.config import settings


def send_email(
    email_to: str,
    subject_template: str = "",
    html_template: str = "",
    environment: Dict[str, Any] = {},
) -> None:
    """
    Send an email using the emails library, which supports both development and production environments.
    """
    if not settings.EMAILS_ENABLED:
        logging.info(f"Email sending disabled, would have sent to {email_to}")
        return

    # Build the email message
    message = emails.Message(
        subject=JinjaTemplate(subject_template),
        html=JinjaTemplate(html_template),
        mail_from=(settings.EMAILS_FROM_NAME, settings.EMAILS_FROM_EMAIL),
    )

    # Send the email
    smtp_options = {
        "host": settings.SMTP_HOST,
        "port": settings.SMTP_PORT,
    }

    # Add TLS if enabled, regardless of environment mode
    if settings.SMTP_TLS:
        smtp_options["tls"] = True
        if settings.SMTP_USER:
            smtp_options["user"] = settings.SMTP_USER
            smtp_options["password"] = settings.SMTP_PASSWORD

    # Log connection attempt for debugging
    logging.info(
        f"Attempting to connect to SMTP server at {settings.SMTP_HOST}:{settings.SMTP_PORT}"
    )

    response = message.send(to=email_to, render=environment, smtp=smtp_options)

    # Log the appropriate response based on success or failure
    if response.status_code not in [250, 235]:
        logging.error(
            f"Failed to send email to {email_to}, status code: {response.status_code}"
        )
    else:
        logging.info(f"Email sent successfully to {email_to}")


def render_template(template_name: str, context: Dict[str, Any]) -> str:
    """
    Render a Jinja template from the email templates directory with the given context.
    """
    templates_dir = Path(settings.EMAIL_TEMPLATES_DIR)
    env = Environment(loader=FileSystemLoader(templates_dir))
    template = env.get_template(template_name)
    return template.render(**context)


def send_email_with_template(
    email_to: str,
    subject: str,
    template_name: str,
    context: Dict[str, Any],
) -> None:
    """
    Render a template and send it as an email.
    """
    html_content = render_template(template_name, context)
    send_email(email_to=email_to, subject_template=subject, html_template=html_content)
