# Troubleshooting CORS Issues in Production

This guide helps you resolve CORS (Cross-Origin Resource Sharing) issues in the production environment.

## Common CORS Issues

CORS errors typically occur when:

1. The frontend container makes requests to the backend container
2. The backend's CORS configuration doesn't match the origin of the requests
3. Docker networking issues prevent proper communication between containers

## Quick Fix Steps

1. **Check your `.env.production` file**:

   - Ensure `BACKEND_CORS_ORIGINS` includes all necessary origins
   - For local development with Docker, include:
     ```
     BACKEND_CORS_ORIGINS=["http://localhost:80", "http://react_frontend:80", "http://react_frontend", "http://fastapi_rbac:8000"]
     ```

2. **Configure correct API URL in your frontend**:

   - Inside Docker network: Use `http://fastapi_rbac:8000`
   - From host browser: Use `http://localhost:8000`
   - In react-frontend's docker-compose.prod.yml:
     ```yaml
     environment:
       - VITE_API_BASE_URL=http://fastapi_rbac:8000
     ```

3. **Test with the provided scripts**:

   ```powershell # Test both containers together
   .\scripts\docker\test-cors-setup.ps1

   # Diagnose specific CORS issues
   .\scripts\docker\diagnose-cors.ps1
   ```

## Advanced Troubleshooting

1. Check browser console for specific CORS error messages
2. Verify containers are on the same Docker network
3. Test direct communication between containers using `curl`
4. Look for CORS configuration logs in the backend container

## Debugging Tools

- `docker-compose.prod-test.yml`: Runs frontend and backend together
- `scripts\docker\test-cors-setup.ps1`: Sets up and tests the containers
- `scripts\docker\diagnose-cors.ps1`: Provides detailed diagnostic information

For persistent issues, check the container logs:

```powershell
docker logs fastapi_rbac
docker logs react_frontend
```
