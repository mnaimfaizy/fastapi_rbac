"""
Add this to the top of your main.py file after imports to debug CORS configuration:

# Debug CORS configuration
print(f"BACKEND_CORS_ORIGINS in settings: {settings.BACKEND_CORS_ORIGINS}")
allowed_origins = [str(origin) for origin in settings.BACKEND_CORS_ORIGINS]
print(f"Configuring CORS with allowed origins: {allowed_origins}")
"""


def debug_cors():
    """
    Add this function to your main.py file and call it before adding CORS middleware
    """
    from app.core.config import settings

    print(f"BACKEND_CORS_ORIGINS in settings: {settings.BACKEND_CORS_ORIGINS}")
    allowed_origins = [str(origin) for origin in settings.BACKEND_CORS_ORIGINS]
    print(f"Configuring CORS with allowed origins: {allowed_origins}")
    return allowed_origins
