import type { Schema } from "@google/generative-ai";
import { SchemaType } from "@google/generative-ai";

const bindingSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    elementId: { type: SchemaType.STRING },
    focus: { type: SchemaType.NUMBER },
    gap: { type: SchemaType.NUMBER },
  },
  required: ["elementId", "focus", "gap"],
};

const elementSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    type: { type: SchemaType.STRING },
    x: { type: SchemaType.NUMBER },
    y: { type: SchemaType.NUMBER },
    width: { type: SchemaType.NUMBER },
    height: { type: SchemaType.NUMBER },
    angle: { type: SchemaType.NUMBER },
    strokeColor: { type: SchemaType.STRING },
    backgroundColor: { type: SchemaType.STRING },
    fillStyle: { type: SchemaType.STRING },
    strokeWidth: { type: SchemaType.NUMBER },
    roughness: { type: SchemaType.NUMBER },
    opacity: { type: SchemaType.NUMBER },
    // text-specific
    text: { type: SchemaType.STRING },
    fontSize: { type: SchemaType.NUMBER },
    textAlign: { type: SchemaType.STRING },
    // arrow-specific
    points: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.ARRAY,
        items: { type: SchemaType.NUMBER },
      },
    },
    startArrowhead: { type: SchemaType.STRING },
    endArrowhead: { type: SchemaType.STRING },
    startBinding: bindingSchema,
    endBinding: bindingSchema,
  },
  required: ["id", "type", "x", "y", "width", "height"],
};

export const diagramResponseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    elements: {
      type: SchemaType.ARRAY,
      items: elementSchema,
    },
  },
  required: ["elements"],
};
