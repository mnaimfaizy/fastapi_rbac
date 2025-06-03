# Production Setup Guide

## Environment Setup

1. Copy the production environment example file:

   ```bash
   cd backend
   cp production.env.example .env.production
   ```

2. Edit the `.env.production` file:

   - Set strong passwords for `ENCRYPT_KEY`, `JWT_REFRESH_SECRET_KEY`, `JWT_RESET_SECRET_KEY`
   - Configure your database connection details
   - Set up your SMTP settings for production email service
   - Update Redis configuration
   - Update CORS origins for your production domain

3. Make sure the `.env.production` file is properly copied to the `/app` directory in the Docker container. This is handled by the `Dockerfile.prod`.

## Common Issues

### Application Startup Errors

If you see errors during application startup:

1. Check that `.env.production` exists in the backend directory
2. Verify that all required environment variables are set
3. Ensure Redis settings match your Redis container configuration
4. Make sure file permissions are correct in the container
5. Check that paths and URLs are correct for production

### Database Connection Issues

1. If using PostgreSQL:

   - Verify `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD` are correct
   - Check if PostgreSQL service is running and accessible

2. If using Supabase:
   - Verify `POSTGRES_URL` and other Supabase-related variables are set correctly
   - Check if Supabase connection string includes all required parameters

### Redis Connection Issues

1. Verify Redis settings:

   ```yaml
   REDIS_HOST=fastapi_rbac_redis_server
   REDIS_PORT=6379
   REDIS_PASSWORD=your_secure_password
   ```

2. Make sure Redis container is running:
   ```bash
   docker-compose -f docker-compose.prod.yml ps
   ```

### Email Configuration

1. Make sure SMTP settings are correct:

   ```yaml
   SMTP_HOST=your_smtp_server
   SMTP_PORT=587
   SMTP_USER=your_smtp_user
   SMTP_PASSWORD=your_smtp_password
   ```

2. Test email configuration with the email test endpoint

### Security Settings

1. Ensure all security keys are strong and unique:

   - `ENCRYPT_KEY`
   - `JWT_REFRESH_SECRET_KEY`
   - `JWT_RESET_SECRET_KEY`
   - `SECRET_KEY`

2. Configure CORS for your production domain:
   ```yaml
   BACKEND_CORS_ORIGINS=["https://your-domain.com"]
   ```

## Deployment Steps

1. Build production images:

   ```bash
   docker-compose -f docker-compose.prod.yml build
   ```

2. Start the services:

   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. Verify services are running:

   ```bash
   docker-compose -f docker-compose.prod.yml ps
   ```

4. Check logs for any errors:
   ```bash
   docker-compose -f docker-compose.prod.yml logs -f fastapi_rbac
   ```
