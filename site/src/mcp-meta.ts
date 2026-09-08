/**
 * The MCP wire as of 2026-07-28: what every request from the website or a script carries.
 * A leaf module (no Supabase, no DOM) so scripts/mcp-client.ts can share it with site/src/mcp.ts.
 */
export const PROTOCOL = "2026-07-28";
export const MCP_ENDPOINT = "/functions/v1/chef/mcp";
export const META = {
  "io.modelcontextprotocol/protocolVersion": PROTOCOL,
  "io.modelcontextprotocol/clientInfo": { name: "chef-gpt-site", version: "0" },
  "io.modelcontextprotocol/clientCapabilities": {
    extensions: { "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] } },
  },
};
