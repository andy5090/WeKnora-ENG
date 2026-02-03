## MCP Feature Usage Guide

### Feature Overview
- MCP (Model Context Protocol) allows WeKnora to securely connect to external tools or data sources, extending the capabilities that Agents can invoke during reasoning.
- All services are centrally managed in the frontend at `Settings > MCP Services` (`frontend/src/views/settings/McpSettings.vue`), without manually editing configuration files.
- Each service includes name, transport method (SSE / HTTP Streamable / Stdio), connection address or command, authentication information, and advanced timeout and retry strategies.

### Entry Point and Interface
- Open the left menu in the console `Settings -> MCP Services` to see all MCP services under the current tenant.
- The list allows quick enable/disable of services, viewing descriptions, and executing "Test / Edit / Delete" through the right-side menu.
- The "Add Service" button opens `McpServiceDialog` for creating or modifying services.

### Common Operation Workflows
1. **Create New Service**
   - Click "Add Service", fill in name and description, select transport method.
   - SSE / HTTP Streamable requires an accessible service URL; Stdio requires configuring `uvx`/`npx` commands and parameters, with optional environment variables.
   - Fill in API Key, Bearer Token, timeout and retry strategies as needed. After saving, the service will appear in the list.
2. **Enable/Disable Service**
   - Toggle the enable switch in the list. The system will immediately call the backend `updateMCPService`. If it fails, the status will automatically rollback with a notification.
3. **Connection Test**
   - Select "Test" from the more menu. The frontend will call `/api/v1/mcp-services/{id}/test` and display `McpTestResult`.
   - On success, it shows the available tools list (with input schema) and resource list; on failure, it displays error information to help troubleshoot network or authentication issues.
4. **Edit / Delete**
   - "Edit" loads the existing configuration for modification and saving.
   - "Delete" requires confirmation in a popup; the list auto-refreshes after completion.

### Usage Recommendations
- **Transport Method Selection**: Prefer SSE for streaming experience; switch to standard HTTP Streamable when compatibility is needed; Stdio is suitable for local debugging or offline environments, running MCP Server on the same machine.
- **Authentication Management**: Save API Key / Token in "Authentication Configuration". For production environments, it's recommended to create minimum-permission Keys separately and rotate them regularly.
- **Retry Strategy**: For public network or third-party services, appropriately increase `retry_count` and `retry_delay` to avoid Agent interruptions due to intermittent timeouts.
