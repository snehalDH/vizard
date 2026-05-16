import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFile, writeFile } from "fs/promises";
import { diagramResponseSchema } from "../../agent/schema.js";
import { UPDATE_SYSTEM_PROMPT } from "../../agent/prompts.js";
import {
  buildExcalidrawFile,
  withDefaults,
  type ExcalidrawElement,
  type ExcalidrawFile,
} from "../../utils/excalidraw.js";

export interface UpdateDiagramInput {
  filePath: string;
  changes: string;
}

export interface UpdateDiagramOutput {
  filePath: string;
}

export async function updateDiagram({
  filePath,
  changes,
}: UpdateDiagramInput): Promise<UpdateDiagramOutput> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const raw = await readFile(filePath, "utf-8");
  const existing = JSON.parse(raw) as ExcalidrawFile;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: UPDATE_SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: diagramResponseSchema,
    },
  });

  const prompt = [
    "Current diagram elements:",
    JSON.stringify(existing.elements, null, 2),
    "",
    `Changes requested: ${changes}`,
  ].join("\n");

  const result = await model.generateContent(prompt);
  const parsed = JSON.parse(result.response.text()) as {
    elements: Partial<ExcalidrawElement>[];
  };

  const elements = parsed.elements.map((el) =>
    withDefaults(el as Parameters<typeof withDefaults>[0])
  );

  await writeFile(filePath, JSON.stringify(buildExcalidrawFile(elements), null, 2), "utf-8");

  console.error(`[update_diagram] updated ${filePath} (${elements.length} elements)`);
  return { filePath };
}
