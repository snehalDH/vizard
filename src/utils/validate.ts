import type { ExcalidrawElement } from "./excalidraw.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateElements(elements: ExcalidrawElement[]): ValidationResult {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const el of elements) {
    if (!el.id || typeof el.id !== "string") {
      errors.push(`Element missing a string id: ${JSON.stringify(el).slice(0, 80)}`);
      continue;
    }
    if (ids.has(el.id)) {
      errors.push(`Duplicate element id: "${el.id}"`);
    }
    ids.add(el.id);
  }

  // Arrow binding references must point to existing element IDs
  for (const el of elements) {
    if (el.type !== "arrow") continue;
    if (el.startBinding?.elementId && !ids.has(el.startBinding.elementId)) {
      errors.push(
        `Arrow "${el.id}" startBinding references unknown id: "${el.startBinding.elementId}"`
      );
    }
    if (el.endBinding?.elementId && !ids.has(el.endBinding.elementId)) {
      errors.push(
        `Arrow "${el.id}" endBinding references unknown id: "${el.endBinding.elementId}"`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}
