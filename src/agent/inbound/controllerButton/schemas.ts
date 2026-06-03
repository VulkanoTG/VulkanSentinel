import { z } from "zod";

function isValidIsoTimestamp(value: string) {
  return !Number.isNaN(Date.parse(value));
}

const isoTimestampSchema = z.string().refine(isValidIsoTimestamp, {
  message: "Timestamp ISO invalido.",
});

export const controllerMarkerCategorySchema = z.enum(["funny", "hype", "rage"]);

export const controllerMarkerCreatePayloadSchema = z.object({
  type: z.literal("marker:create"),
  category: controllerMarkerCategorySchema,
  source: z.string().min(1),
});

export const controllerButtonActionPayloadSchema = z.discriminatedUnion("type", [
  controllerMarkerCreatePayloadSchema,
]);

export const agentControllerButtonPayloadSchema = z.object({
  jobId: z.string().min(1),
  action: z.literal("marker:create"),
  payload: controllerButtonActionPayloadSchema,
  source: z.literal("controller-ipc"),
  sentAt: isoTimestampSchema,
}).superRefine((value, ctx) => {
  if (value.payload.type !== value.action) {
    ctx.addIssue({
      code: "custom",
      path: ["payload", "type"],
      message: "payload.type deve corresponder ao action recebido.",
    });
  }
});

export const agentControllerButtonMessageSchema = z.object({
  type: z.literal("agent.controllerButton"),
  payload: agentControllerButtonPayloadSchema,
});

export type ControllerMarkerCategory = z.infer<typeof controllerMarkerCategorySchema>;
export type ControllerMarkerCreatePayload = z.infer<typeof controllerMarkerCreatePayloadSchema>;
export type AgentControllerButtonMessage = z.infer<typeof agentControllerButtonMessageSchema>;
