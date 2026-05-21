import { readdir, mkdir } from "fs/promises";
import { join } from "path";

export interface ListDiagramsOutput {
  diagrams: string[];
}

export async function listDiagrams(): Promise<ListDiagramsOutput> {
  const outputDir = process.env.OUTPUT_DIR ?? join(process.cwd(), "diagrams");
  await mkdir(outputDir, { recursive: true });
  const files = await readdir(outputDir);
  const diagrams = files
    .filter((f) => f.endsWith(".excalidraw"))
    .sort()
    .map((f) => join(outputDir, f));

  console.error(`[list_diagrams] found ${diagrams.length} diagrams`);
  return { diagrams };
}
