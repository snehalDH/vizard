import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFile, writeFile } from "fs/promises";
import { extname, join, dirname, basename } from "path";
import { diagramResponseSchema } from "../../agent/schema.js";
import { UPDATE_SYSTEM_PROMPT } from "../../agent/prompts.js";
import { buildExcalidrawFile, type ExcalidrawFile } from "../../utils/excalidraw.js";
import { generateWithRetry } from "../../utils/generate-with-retry.js";
import { toSvg } from "../../utils/svg.js";

export interface UpdateDiagramInput {
  filePath: string;
  changes: string;
}

export interface UpdateDiagramOutput {
  filePath: string;
  svgPath: string;
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

  const elements = await generateWithRetry(model, prompt, "[update_diagram]");

  const excalidrawFile = buildExcalidrawFile(elements);
  const dir = dirname(filePath);
  const base = basename(filePath, extname(filePath));
  const svgPath = join(dir, `${base}.svg`);

  await Promise.all([
    writeFile(filePath, JSON.stringify(excalidrawFile, null, 2), "utf-8"),
    writeFile(svgPath, toSvg(excalidrawFile), "utf-8"),
  ]);

  console.error(`[update_diagram] updated ${filePath} + ${svgPath} (${elements.length} elements)`);
  return { filePath, svgPath };
}
