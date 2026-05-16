import { GoogleGenerativeAI } from "@google/generative-ai";
import { writeFile } from "fs/promises";
import { join } from "path";
import "dotenv/config";
import { diagramResponseSchema } from "./src/agent/schema.js";
import { SYSTEM_PROMPT } from "./src/agent/prompts.js";
import { buildExcalidrawFile, withDefaults, ExcalidrawElement } from "./src/utils/excalidraw.js";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Error: GEMINI_API_KEY is not set in .env");
  process.exit(1);
}

const description = process.argv[2] ?? "simple two-step login flow";
console.log(`Generating diagram for: "${description}"`);

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  systemInstruction: SYSTEM_PROMPT,
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: diagramResponseSchema,
  },
});

const result = await model.generateContent(description);
const raw = result.response.text();

let parsed: { elements: Partial<ExcalidrawElement>[] };
try {
  parsed = JSON.parse(raw);
} catch {
  console.error("Failed to parse Gemini response as JSON:");
  console.error(raw);
  process.exit(1);
}

const elements = (parsed.elements ?? []).map((el) =>
  withDefaults(el as Parameters<typeof withDefaults>[0])
);

const excalidrawFile = buildExcalidrawFile(elements);
const outputPath = join("diagrams", "test.excalidraw");
await writeFile(outputPath, JSON.stringify(excalidrawFile, null, 2), "utf-8");

console.log(`\nDiagram saved to: ${outputPath}`);
console.log(`Elements: ${elements.length}`);
console.log(`Types: ${[...new Set(elements.map((e) => e.type))].join(", ")}`);
console.log("\nTest it: go to excalidraw.com → Open → upload diagrams/test.excalidraw");
