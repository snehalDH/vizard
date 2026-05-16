import { GoogleGenerativeAI } from "@google/generative-ai";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { diagramResponseSchema } from "../../agent/schema.js";
import { SYSTEM_PROMPT } from "../../agent/prompts.js";
import {
  buildExcalidrawFile,
  withDefaults,
  type ExcalidrawElement,
} from "../../utils/excalidraw.js";

export type DiagramStyle = "flowchart" | "sequence" | "architecture";

export interface CreateDiagramInput {
  description: string;
  style?: DiagramStyle;
}

export interface CreateDiagramOutput {
  filePath: string;
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
  const result = await model.generateContent(prompt);
  const parsed = JSON.parse(result.response.text()) as {
    elements: Partial<ExcalidrawElement>[];
  };

  const elements = parsed.elements.map((el) =>
    withDefaults(el as Parameters<typeof withDefaults>[0])
  );

  await mkdir("diagrams", { recursive: true });
  const filename = `${slugify(description)}-${Date.now()}.excalidraw`;
  const filePath = join("diagrams", filename);
  await writeFile(filePath, JSON.stringify(buildExcalidrawFile(elements), null, 2), "utf-8");

  console.error(`[create_diagram] saved ${filePath} (${elements.length} elements)`);
  return { filePath, elementCount: elements.length };
}
