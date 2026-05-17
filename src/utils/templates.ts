import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const AVAILABLE = ["rag", "microservices", "auth", "cicd"] as const;
export type TemplateName = (typeof AVAILABLE)[number];

export async function loadTemplate(name: string): Promise<string> {
  if (!AVAILABLE.includes(name as TemplateName)) {
    throw new Error(
      `Unknown template "${name}". Available templates: ${AVAILABLE.join(", ")}`
    );
  }
  const filePath = join(__dirname, "../../examples", `${name}.prompt`);
  return (await readFile(filePath, "utf-8")).trim();
}

export { AVAILABLE as TEMPLATE_NAMES };
