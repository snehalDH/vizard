import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fileURLToPath } from "url";
import "dotenv/config";
import { createDiagram } from "./tools/create-diagram.js";
import { updateDiagram } from "./tools/update-diagram.js";
import { listDiagrams } from "./tools/list-diagrams.js";

export async function startMcpServer() {
  const server = new McpServer({
    name: "vizard",
    version: "1.0.0",
  });

  server.registerTool(
    "create_diagram",
    {
      description:
        "Generate a new Excalidraw diagram from a plain-English description of a system or process.",
      inputSchema: {
        description: z.string().describe("Plain-English description of the diagram to generate"),
        style: z
          .enum(["flowchart", "sequence", "architecture"])
          .optional()
          .describe("Visual style: flowchart (process steps), sequence (actor swim lanes), architecture (system components). Defaults to architecture."),
      },
    },
    async ({ description, style }) => {
      try {
        const result = await createDiagram({ description, style });
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (err) {
        console.error("[create_diagram] error:", err);
        return {
          content: [
            {
              type: "text",
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "update_diagram",
    {
      description:
        "Modify an existing Excalidraw diagram based on a plain-English description of changes.",
      inputSchema: {
        filePath: z.string().describe("Path to the .excalidraw file to update"),
        changes: z
          .string()
          .describe("Plain-English description of what to add, remove, or change in the diagram"),
      },
    },
    async ({ filePath, changes }) => {
      try {
        const result = await updateDiagram({ filePath, changes });
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (err) {
        console.error("[update_diagram] error:", err);
        return {
          content: [
            {
              type: "text",
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "list_diagrams",
    {
      description: "List all saved Excalidraw diagram files in the diagrams/ directory.",
    },
    async () => {
      try {
        const result = await listDiagrams();
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (err) {
        console.error("[list_diagrams] error:", err);
        return {
          content: [
            {
              type: "text",
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[vizard-mcp] server started on stdio");
}

// Direct invocation guard (npm run mcp:server)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startMcpServer();
}
