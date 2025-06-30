# Documentation Setup

This project uses MkDocs with the Material theme for documentation.

## Local Preview

To preview the documentation locally:

1. Install MkDocs and the Material theme at the user level (outside any virtual environments):

   ```
   pip install --user mkdocs mkdocs-material
   ```

2. From the project root, run:

   ```
   mkdocs serve
   ```

3. Open your browser to http://127.0.0.1:8000/

## Documentation Structure

- `README.md`: Main project overview (used as the home page)
- `CONTRIBUTING.md`: Simple redirect to the comprehensive contribution guidelines
- `docs/contributing.md`: Comprehensive contribution guidelines
- `docs/`: Contains all additional documentation markdown files
- `mkdocs.yml`: Configuration file for MkDocs
- `.github/workflows/docs.yml`: GitHub Actions workflow for automatic deployment

## Adding New Documentation

1. Add Markdown files to the appropriate subdirectory under `docs/`
2. Update `mkdocs.yml` if you're adding a new section

## Important Note About Root Files

The project's root `README.md` and `CONTRIBUTING.md` files are used as the home page and contributing page in the MkDocs site. When updating these files, remember that they will be reflected in the documentation.

## Adding New Documentation

1. Add Markdown files to the appropriate subdirectory under `docs/`
2. Update `mkdocs.yml` if you're adding a new section

## Deployment

Documentation is automatically deployed to GitHub Pages when changes are pushed to the main branch. The deployment is handled by the GitHub Actions workflow defined in `.github/workflows/docs.yml`.
