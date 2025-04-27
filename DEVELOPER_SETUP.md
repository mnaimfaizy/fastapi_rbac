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
