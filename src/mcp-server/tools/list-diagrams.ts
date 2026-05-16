import { readdir, mkdir } from "fs/promises";
import { join } from "path";

export interface ListDiagramsOutput {
  diagrams: string[];
}

export async function listDiagrams(): Promise<ListDiagramsOutput> {
  await mkdir("diagrams", { recursive: true });
  const files = await readdir("diagrams");
  const diagrams = files
    .filter((f) => f.endsWith(".excalidraw"))
    .sort()
    .map((f) => join("diagrams", f));

  console.error(`[list_diagrams] found ${diagrams.length} diagrams`);
  return { diagrams };
}
