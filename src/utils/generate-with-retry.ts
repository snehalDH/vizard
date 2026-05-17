import type { GenerativeModel } from "@google/generative-ai";
import { withDefaults, type ExcalidrawElement } from "./excalidraw.js";
import { validateElements } from "./validate.js";

const MAX_RETRIES = 3;

export async function generateWithRetry(
  model: GenerativeModel,
  basePrompt: string,
  logPrefix: string
): Promise<ExcalidrawElement[]> {
  let lastError = "";
  let lastElements: ExcalidrawElement[] = [];

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const prompt = lastError
      ? `${basePrompt}\n\nERROR IN PREVIOUS ATTEMPT — fix these issues before responding:\n${lastError}`
      : basePrompt;

    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text()) as {
      elements: Partial<ExcalidrawElement>[];
    };
    const elements = parsed.elements.map((el) =>
      withDefaults(el as Parameters<typeof withDefaults>[0])
    );
    lastElements = elements;

    const { valid, errors } = validateElements(elements);
    if (valid) {
      if (attempt > 1) {
        console.error(`${logPrefix} attempt ${attempt} passed validation`);
      }
      return elements;
    }

    lastError = errors.join("; ");
    console.error(`${logPrefix} attempt ${attempt} failed validation: ${lastError}`);
  }

  console.error(`${logPrefix} max retries reached, using last result`);
  return lastElements;
}
