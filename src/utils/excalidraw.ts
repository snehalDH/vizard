import { randomUUID } from "crypto";

export type ElementType = "rectangle" | "ellipse" | "diamond" | "text" | "arrow";
export type FillStyle = "hachure" | "cross-hatch" | "solid" | "none";
export type StrokeStyle = "solid" | "dashed" | "dotted";
export type TextAlign = "left" | "center" | "right";
export type Arrowhead = "arrow" | "dot" | "bar" | "triangle" | null;

export interface Binding {
  elementId: string;
  focus: number;
  gap: number;
}

export interface ExcalidrawElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  roughness: number;
  opacity: number;
  groupIds: string[];
  roundness: { type: number } | null;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  boundElements: Array<{ id: string; type: string }> | null;
  updated: number;
  link: string | null;
  locked: boolean;
  // text-specific
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: TextAlign;
  verticalAlign?: "top" | "middle" | "bottom";
  containerId?: string | null;
  originalText?: string;
  // arrow-specific
  points?: Array<[number, number]>;
  lastCommittedPoint?: [number, number] | null;
  startArrowhead?: Arrowhead;
  endArrowhead?: Arrowhead;
  startBinding?: Binding | null;
  endBinding?: Binding | null;
}

export interface ExcalidrawFile {
  type: "excalidraw";
  version: 2;
  source: string;
  elements: ExcalidrawElement[];
  appState: {
    gridSize: null;
    viewBackgroundColor: string;
  };
  files: Record<string, unknown>;
}

export function buildExcalidrawFile(elements: ExcalidrawElement[]): ExcalidrawFile {
  return {
    type: "excalidraw",
    version: 2,
    source: "https://github.com/vizard",
    elements,
    appState: {
      gridSize: null,
      viewBackgroundColor: "#ffffff",
    },
    files: {},
  };
}

// Merges Gemini-generated partial elements with required boilerplate fields.
export function withDefaults(
  partial: Partial<ExcalidrawElement> & Pick<ExcalidrawElement, "id" | "type" | "x" | "y" | "width" | "height">
): ExcalidrawElement {
  const now = Date.now();
  const base: ExcalidrawElement = {
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "hachure",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    roundness: partial.type === "arrow" ? null : { type: 3 },
    seed: Math.floor(Math.random() * 2 ** 31),
    version: 1,
    versionNonce: Math.floor(Math.random() * 2 ** 31),
    isDeleted: false,
    boundElements: null,
    updated: now,
    link: null,
    locked: false,
    ...partial,
  };

  if (base.type === "text") {
    base.fontFamily = base.fontFamily ?? 1;
    base.fontSize = base.fontSize ?? 20;
    base.textAlign = base.textAlign ?? "center";
    base.verticalAlign = base.verticalAlign ?? "middle";
    base.containerId = base.containerId ?? null;
    base.originalText = base.originalText ?? base.text ?? "";
  }

  if (base.type === "arrow") {
    base.points = base.points ?? [[0, 0], [base.width, 0]];
    base.lastCommittedPoint = null;
    base.startArrowhead = base.startArrowhead ?? null;
    base.endArrowhead = base.endArrowhead ?? "arrow";
    base.startBinding = base.startBinding ?? null;
    base.endBinding = base.endBinding ?? null;
  }

  return base;
}

export function generateId(): string {
  return randomUUID();
}
