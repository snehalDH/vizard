import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node_modules/.bin/tsx",
  args: ["src/mcp-server/index.ts"],
  stderr: "inherit", // forward server's console.error to this terminal
});

const client = new Client({ name: "vizard-test-client", version: "1.0.0" });

await client.connect(transport);
console.log("Connected to vizard MCP server\n");

// --- listTools ---
console.log("=== listTools ===");
const { tools } = await client.listTools();
for (const tool of tools) {
  const params = Object.keys(tool.inputSchema?.properties ?? {}).join(", ");
  console.log(`  ${tool.name}(${params})`);
  console.log(`    ${tool.description}\n`);
}

// --- list_diagrams ---
console.log("=== callTool: list_diagrams ===");
const listResult = await client.callTool({ name: "list_diagrams", arguments: {} });
console.log(JSON.stringify(listResult, null, 2));

await transport.close();
console.log("\nDone. Server process stopped.");
