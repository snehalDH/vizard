import {
  GoogleGenerativeAI,
  type FunctionCallPart,
  type FunctionDeclaration,
  type FunctionDeclarationSchema,
  type FunctionResponsePart,
  type Part,
  type Tool,
} from "@google/generative-ai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Tool as McpTool } from "@modelcontextprotocol/sdk/types.js";

const MAX_ITERATIONS = 10;

function toFunctionDeclaration(mcpTool: McpTool): FunctionDeclaration {
  // Strip JSON Schema meta-fields Gemini's API does not accept
  const { $schema, additionalProperties, ...cleanSchema } =
    mcpTool.inputSchema as Record<string, unknown>;
  void $schema;
  void additionalProperties;
  return {
    name: mcpTool.name,
    description: mcpTool.description ?? "",
    parameters: cleanSchema as unknown as FunctionDeclarationSchema,
  };
}

function isFunctionCallPart(part: Part): part is FunctionCallPart {
  return "functionCall" in part && part.functionCall != null;
}

function extractText(parts: Part[]): string {
  return parts
    .filter((p): p is Part & { text: string } => "text" in p && typeof p.text === "string")
    .map((p) => (p as { text: string }).text)
    .join("");
}

export async function runAgent(userMessage: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  // Spawn MCP server and connect
  const transport = new StdioClientTransport({
    command: "node_modules/.bin/tsx",
    args: ["src/mcp-server/index.ts"],
    stderr: "inherit",
  });
  const mcpClient = new Client({ name: "vizard-agent", version: "1.0.0" });
  await mcpClient.connect(transport);

  // Convert MCP tools → Gemini function declarations
  const { tools: mcpTools } = await mcpClient.listTools();
  const geminiTools: Tool[] = [
    { functionDeclarations: mcpTools.map(toFunctionDeclaration) },
  ];

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", tools: geminiTools });
  const chat = model.startChat();

  let finalText = "";
  let response = await chat.sendMessage(userMessage);

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const parts: Part[] = response.response.candidates?.[0]?.content?.parts ?? [];
    const callParts = parts.filter(isFunctionCallPart);

    // No function calls → Gemini is done, collect text
    if (callParts.length === 0) {
      finalText = extractText(parts);
      break;
    }

    if (i === MAX_ITERATIONS - 1) {
      console.error("[agent] hit max iterations limit, stopping");
      break;
    }

    // Execute each tool call and build function responses
    const functionResponses: FunctionResponsePart[] = [];
    for (const part of callParts) {
      const { name, args } = part.functionCall;
      console.log(`→ Calling tool: ${name}`, JSON.stringify(args));

      const toolResult = await mcpClient.callTool({
        name,
        arguments: args as Record<string, unknown>,
      });

      type ContentItem = { type: string; text?: string };
      const resultText = (toolResult.content as ContentItem[])
        .filter((c) => c.type === "text" && typeof c.text === "string")
        .map((c) => c.text as string)
        .join("");

      console.log(`← Tool result: ${resultText}`);

      functionResponses.push({
        functionResponse: { name, response: { result: resultText } },
      });
    }

    // Feed all results back in one turn
    response = await chat.sendMessage(functionResponses);
  }

  await transport.close();
  return finalText;
}
