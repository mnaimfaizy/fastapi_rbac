# Developer Setup Guide

This guide provides detailed instructions for setting up the development environment for the FastAPI RBAC project. It includes instructions for configuring your IDE, installing dependencies, and common workflows.

## VS Code Setup

This project uses Visual Studio Code for development with a standardized set of extensions and configurations to maintain code quality and consistency across the team.

### Required Extensions

Install the following extensions for the optimal development experience:

#### For Python Development

1. **Python** (ms-python.python) - Main Python extension
2. **Black Formatter** (ms-python.black-formatter) - Python code formatter
3. **isort** (ms-python.isort) - Python import organization
4. **Flake8** (ms-python.flake8) - Python linting
5. **Mypy Type Checker** (ms-python.mypy-type-checker) - Python type checking

#### For Frontend Development

1. **ESLint** (dbaeumer.vscode-eslint) - JavaScript/TypeScript linting
2. **Prettier** (esbenp.prettier-vscode) - JavaScript/TypeScript formatting

#### Optional but Recommended

1. **Better Comments** (aaron-bond.better-comments) - Color coded comment categorization
2. **GitLens** (eamodio.gitlens) - Git capabilities in VS Code
3. **Docker** (ms-azuretools.vscode-docker) - Docker integration
4. **REST Client** (humao.rest-client) - Test API endpoints directly from VS Code

### Workspace Settings

The project includes workspace settings at `.vscode/settings.json` with configurations for:

#### Import Sorting with isort

```json
"isort.args": ["--profile", "black"]
```

This configures isort to follow Black's code style, which:

- Places imports on separate lines
- Groups imports by standard library, third-party, and local
- Sorts alphabetically within groups

#### Python Code Formatting with Black

```json
"black-formatter.args": ["--line-length", "88"]
```

This applies Black's opinionated code formatting with a line length of 88 characters.

#### Automatic Import Organization on Save

```json
"[python]": {
  "editor.codeActionsOnSave": {
    "source.organizeImports": "explicit"
  }
}
```

This configuration automatically organizes your imports when you save Python files.

### isort Configuration

The project includes an `.isort.cfg` file with these settings:

```
[settings]
profile=black
multi_line_output=3
line_length=88
```

This configuration:

- Makes isort compatible with Black's formatting style
- Sets multi-line output format to vertical hanging indent
- Aligns line length with Black's settings

## Setup Instructions

### First-Time Setup

1. **Clone the repository**:

   ```bash
   git clone <repository-url>
   cd fastapi_rbac
   ```

2. **Install VS Code extensions**:

   - Open VS Code
   - Go to Extensions (Ctrl+Shift+X)
   - Search for and install all required extensions listed above

3. **Open the project**:
   - File > Open Folder... > Select the fastapi_rbac directory
   - The workspace settings will automatically apply

### Backend Setup

Follow the backend setup instructions in the main README.md to set up your Python environment and dependencies.

### Frontend Setup

Follow the frontend setup instructions in the main README.md to set up your Node.js environment and dependencies.

## Testing Framework

### Test Structure

The project uses pytest for testing with the following structure:

```
backend/test/
├── conftest.py                    # Test configuration and fixtures
├── test_config.py                 # Configuration for test environment
├── utils.py                       # Utility functions for tests
├── test_api_*.py                  # API endpoint tests
├── test_crud_*.py                 # CRUD operation tests
├── test_models_*.py               # Database model tests
└── test_integration_*.py          # Integration tests
```

### Test Configuration

Tests are configured in `conftest.py` which provides:

1. **Database fixtures**:

   - Creates in-memory SQLite database for tests
   - Creates test tables using SQLModel metadata
   - Provides session fixtures for database access
   - Includes transaction isolation between tests

2. **API Testing fixtures**:

   - `app`: Creates a FastAPI test application
   - `client`: HTTPx AsyncClient for making API requests
   - `superuser_token_headers`: Authentication headers for admin access
   - `normal_user_token_headers`: Authentication headers for regular user access

3. **Mock fixtures**:
   - `redis_mock`: AsyncMock for Redis operations
   - Various service mocks for external dependencies

### Running Tests

You can run tests using the provided script:

```bash
# Run all tests
cd backend
python run_tests.py

# Run specific test file
python run_tests.py test/test_api_auth.py

# Run specific test function
python run_tests.py test/test_api_auth.py::test_login_successful

# Run tests with verbose output
python run_tests.py --verbose

# Run tests with coverage report
python run_tests.py --coverage
```

### Testing Strategy

The project follows these testing principles:

1. **Unit Tests**:

   - Test individual components in isolation
   - Mock dependencies for focused testing
   - Fast execution for quick feedback

2. **API Tests**:

   - Test API endpoints through the FastAPI test client
   - Verify correct responses and status codes
   - Ensure proper error handling
   - Test authentication and authorization

3. **CRUD Tests**:

   - Test database operations
   - Verify correct data persistence
   - Test constraints and relationships

4. **Model Tests**:

   - Verify model properties and methods
   - Test model relationships
   - Validate data integrity constraints

5. **Integration Tests**:
   - Test multiple components working together
   - Focus on critical user workflows
   - Verify system behavior end-to-end

### Writing New Tests

When adding new features, follow these guidelines for writing tests:

1. **API Endpoint Tests**:

   ```python
   @pytest.mark.asyncio
   async def test_new_endpoint(client: AsyncClient, superuser_token_headers: Dict[str, str]) -> None:
       """Test description here"""
       # Arrange - prepare test data
       test_data = {"field1": "value1", "field2": "value2"}

       # Act - make API request
       response = await client.post(
           f"{settings.API_V1_STR}/your-endpoint",
           json=test_data,
           headers=superuser_token_headers
       )

       # Assert - verify response
       assert response.status_code == 201
       result = response.json()
       assert result["status"] == "success"
       assert "field1" in result["data"]
       assert result["data"]["field1"] == "value1"
   ```

2. **CRUD Tests**:

   ```python
   @pytest.mark.asyncio
   async def test_crud_operation(db: AsyncSession) -> None:
       """Test description here"""
       # Arrange - prepare test data
       obj_in = IYourModelCreate(field1="value1", field2="value2")

       # Act - perform CRUD operation
       obj = await crud.your_model.create(db_session=db, obj_in=obj_in)

       # Assert - verify result
       assert obj.field1 == "value1"
       assert obj.field2 == "value2"
   ```

3. **Test Setup Best Practices**:
   - Use fixtures for common setup
   - Create helper functions for repeated test patterns
   - Provide descriptive test names and docstrings
   - Follow the AAA pattern (Arrange-Act-Assert)
   - Clean up resources in teardown

### Debugging Tests

When tests fail, you can debug using these techniques:

1. **Verbose Output**:

   ```bash
   python run_tests.py test/failing_test.py -v
   ```

2. **Print Statements**:
   Add print statements to understand the state during test execution:

   ```python
   print(f"Response: {response.json()}")
   ```

3. **VS Code Debugger**:

   - Set breakpoints in your test file
   - Use the "Python: Debug Current File" command
   - Inspect variables in the debugger

4. **Pytest Features**:
   - Use `pytest.set_trace()` for debugger
   - Use `-s` flag to see print outputs

## Continuous Integration

The project uses GitHub Actions for continuous integration, which runs:

- Linting checks
- Type checking
- Unit tests
- Integration tests

The CI workflow is defined in `.github/workflows/ci.yml` and `.github/workflows/test.yml`.

## Code Quality Guidelines

The configured tools enforce these guidelines automatically:

1. **Formatting**:

   - Black enforces consistent Python code style
   - Prettier enforces consistent JavaScript/TypeScript code style

2. **Import Organization**:

   - isort groups and sorts Python imports
   - ESLint organizes JavaScript/TypeScript imports

3. **Linting**:

   - Flake8 checks for Python code quality issues
   - ESLint checks for JavaScript/TypeScript code quality issues

4. **Type Checking**:
   - Mypy enforces static type checking in Python

## Troubleshooting

### VS Code Doesn't Recognize Python Environment

1. Open VS Code Command Palette (Ctrl+Shift+P)
2. Select "Python: Select Interpreter"
3. Choose the Python interpreter from your virtual environment

### Import Sorting Not Working

1. Check if isort extension is installed and enabled
2. Ensure the virtual environment has isort installed
3. Verify there are no errors in the VS Code Extensions panel

### Black Formatting Not Working

1. Check if Black extension is installed and enabled
2. Ensure the virtual environment has Black installed
3. Try running Black manually: `black <filename>` from terminal

## Additional Information

For more information, refer to:

- [Python Extension for VS Code](https://marketplace.visualstudio.com/items?itemName=ms-python.python)
- [Black documentation](https://black.readthedocs.io/)
- [isort documentation](https://pycqa.github.io/isort/)
- [Flake8 documentation](https://flake8.pycqa.org/)
- [Mypy documentation](https://mypy.readthedocs.io/)
- [Pytest documentation](https://docs.pytest.org/)
- [FastAPI testing](https://fastapi.tiangolo.com/tutorial/testing/)
- [SQLModel testing](https://sqlmodel.tiangolo.com/tutorial/fastapi/tests/)
