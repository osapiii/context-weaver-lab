import { z } from "zod";
import { nodeDataSchema } from "./diagnosisFlow";

const PositionZod = z.union([
  z.literal("left"),
  z.literal("top"),
  z.literal("right"),
  z.literal("bottom"),
]);

export const vueFlowNodeZodObject = z.object({
  id: z.string(),
  type: z.union([
    z.literal("welcome"),
    z.literal("profile"),
    z.literal("section"),
    z.literal("questionnaire"),
    z.literal("logicRule"),
    z.literal("entry"),
  ]),
  label: z.string(),
  data: nodeDataSchema,
  sourcePosition: PositionZod.optional(),
  targetPosition: PositionZod.optional(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
});

export const vueFlowEdgeZodObject = z.object({
  id: z.string(),
  type: z.string(),
  source: z.string(),
  target: z.string(),
  data: z.record(z.string()),
});

export const vueFlowElementsSchema = z.array(
  z.union([vueFlowNodeZodObject, vueFlowEdgeZodObject])
);
