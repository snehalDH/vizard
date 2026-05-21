import { GoogleGenerativeAI } from "@google/generative-ai";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { diagramResponseSchema } from "../../agent/schema.js";
import { SYSTEM_PROMPT } from "../../agent/prompts.js";
import { buildExcalidrawFile } from "../../utils/excalidraw.js";
import { generateWithRetry } from "../../utils/generate-with-retry.js";
import { toSvg } from "../../utils/svg.js";

export type DiagramStyle = "flowchart" | "sequence" | "architecture";

export interface CreateDiagramInput {
  description: string;
  style?: DiagramStyle;
}

export interface CreateDiagramOutput {
  filePath: string;
  svgPath: string;
  elementCount: number;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function createDiagram({
  description,
  style = "architecture",
}: CreateDiagramInput): Promise<CreateDiagramOutput> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: diagramResponseSchema,
    },
  });

  const prompt = `Style: ${style}\n\n${description}`;
  const elements = await generateWithRetry(model, prompt, "[create_diagram]");

  const outputDir = process.env.OUTPUT_DIR ?? join(process.cwd(), "diagrams");
  await mkdir(outputDir, { recursive: true });
  const base = `${slugify(description)}-${Date.now()}`;
  const filePath = join(outputDir, `${base}.excalidraw`);
  const svgPath = join(outputDir, `${base}.svg`);

  const excalidrawFile = buildExcalidrawFile(elements);
  await Promise.all([
    writeFile(filePath, JSON.stringify(excalidrawFile, null, 2), "utf-8"),
    writeFile(svgPath, toSvg(excalidrawFile), "utf-8"),
  ]);

  console.error(`[create_diagram] saved ${filePath} + ${svgPath} (${elements.length} elements)`);
  return { filePath, svgPath, elementCount: elements.length };
}
