# Copilot MCP Server Integration

This project is pre-configured to use the GitHub MCP server for Copilot Chat automation and repository management.

## Workspace Scope

- The `.vscode/mcp.json` file ensures this configuration only applies to this repository.
- No local server setup is required; the remote GitHub MCP server is used.

## Getting Started

1. Open Copilot Chat in VS Code.
2. Switch to Agent mode and select the "github" MCP server.
3. Use the example prompts below or explore available actions via the tools menu.

## Example Prompts

- `List all open issues in this repository`
- `Create a new issue titled "Test MCP server connection"`
- `Show all collaborators`
- `List open pull requests`

## Best Practices

- Use clear, action-oriented prompts (e.g., "Create", "List", "Show").
- Reference issues, PRs, or resources by number or name when possible.
- Check the Copilot Chat tools menu for available actions.
- If the first response isn’t perfect, clarify or add more details in your next prompt.

## Advanced Prompting for GitHub MCP Server

To get the best results from the LLM and automate your GitHub workflows, use these standard prompt patterns. These are designed to be minimal, clear, and allow the LLM to infer details for you.

### 1. Creating an Issue

- `Create a new issue titled "Improve login error handling"`
  - _Tip: You only need to provide a title. The LLM will generate a description based on the title. Add more context if you want, but it's optional._

### 2. Creating a Pull Request from an Issue

- `Create a pull request to resolve issue #42`
  - _Tip: The LLM will link the PR to the issue, use the issue title and description, and follow standard PR conventions._

### 3. Managing PR Metadata (Labels, Reviewers, etc.)

- `Add the "bug" label to pull request #17`
- `Assign the "enhancement" label to issue #42`
- `Add reviewers to pull request #17`
- `Assign pull request #17 to @username`
  - _Tip: Use similar prompts for milestones, assignees, or other metadata._

### 4. General Prompting Tips

- Use clear, action-oriented language: "Create", "Add", "Assign", "Link", etc.
- Reference issues and PRs by number: `issue #42`, `pull request #17`
- For issue creation, just provide a title; the LLM will generate a description if needed.
- For PRs, reference the issue to be resolved; the LLM will infer the branch and link.
- If you want the LLM to generate more context, simply provide a short title or instruction and let it expand as needed.

### Example Workflow

1. **Create an issue:**
   - `Create a new issue titled "User cannot reset password"`
2. **Create a PR from that issue:**
   - `Create a pull request to resolve issue #53`
3. **Add a label to the PR:**
   - `Add the "critical" label to pull request #54`

These prompts are concise, standard, and designed for maximum LLM automation. You can copy them into Copilot Chat with the MCP server or use them as templates for your own workflows.

## Troubleshooting

- Ensure you are signed in to GitHub in VS Code.
- If you encounter issues, check the Copilot Chat output panel for errors.
- For more help, see the official [GitHub MCP server documentation](https://docs.github.com/en/copilot/how-tos/context/model-context-protocol/using-the-github-mcp-server).
