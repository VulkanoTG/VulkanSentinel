import { z } from "zod";
import { agentControllerButtonMessageSchema } from "./inbound/controllerButton/schemas.js";

export const agentCapabilitySchema = z.object({
  key: z.string().min(1),
  actions: z.array(z.string().min(1)).default([]),
});

export const agentHelloMessageSchema = z.object({
  type: z.literal("agent.hello"),
  payload: z.object({
    agentId: z.string().min(1),
    agentName: z.string().min(1),
    location: z.string().min(1),
    version: z.string().min(1),
    capabilities: z.array(agentCapabilitySchema).default([]),
    agentSecret: z.string().min(1),
    sentAt: z.string().min(1),
  }),
});

export const agentReadyMessageSchema = z.object({
  type: z.literal("agent.ready"),
  payload: z.object({
    sentAt: z.string().min(1),
  }),
});

export const agentHeartbeatMessageSchema = z.object({
  type: z.literal("agent.heartbeat"),
  payload: z.object({
    sentAt: z.string().min(1),
  }),
});

export const agentResultMessageSchema = z.object({
  type: z.literal("agent.result"),
  payload: z.object({
    jobId: z.string().min(1),
    ok: z.boolean(),
    data: z.unknown().optional(),
    error: z.object({
      code: z.string().min(1),
      message: z.string().min(1),
      details: z.unknown().optional(),
    }).nullable().optional(),
    sentAt: z.string().min(1),
  }),
});

export const agentErrorMessageSchema = z.object({
  type: z.literal("agent.error"),
  payload: z.object({
    jobId: z.string().min(1).optional(),
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.unknown().optional(),
    sentAt: z.string().min(1),
  }),
});

export const inboundAgentMessageSchema = z.discriminatedUnion("type", [
  agentHelloMessageSchema,
  agentReadyMessageSchema,
  agentHeartbeatMessageSchema,
  agentResultMessageSchema,
  agentErrorMessageSchema,
  agentControllerButtonMessageSchema,
]);

export const serverHelloMessageSchema = z.object({
  type: z.literal("server.hello"),
  payload: z.object({
    serverName: z.string().min(1),
    version: z.string().min(1),
    sentAt: z.string().min(1),
  }),
});

export const serverAckMessageSchema = z.object({
  type: z.literal("server.ack"),
  payload: z.object({
    ok: z.boolean(),
    connectionId: z.string().min(1),
    sentAt: z.string().min(1),
  }),
});

export const serverPingMessageSchema = z.object({
  type: z.literal("server.ping"),
  payload: z.object({
    sentAt: z.string().min(1),
  }),
});

export const jobExecuteMessageSchema = z.object({
  type: z.literal("job.execute"),
  payload: z.object({
    jobId: z.string().min(1),
    action: z.string().min(1),
    payload: z.unknown(),
    sentAt: z.string().min(1),
  }),
});

export const jobCancelMessageSchema = z.object({
  type: z.literal("job.cancel"),
  payload: z.object({
    jobId: z.string().min(1),
    sentAt: z.string().min(1),
  }),
});

export type AgentCapability = z.infer<typeof agentCapabilitySchema>;
export type AgentHelloMessage = z.infer<typeof agentHelloMessageSchema>;
export type AgentReadyMessage = z.infer<typeof agentReadyMessageSchema>;
export type AgentHeartbeatMessage = z.infer<typeof agentHeartbeatMessageSchema>;
export type AgentResultMessage = z.infer<typeof agentResultMessageSchema>;
export type AgentErrorMessage = z.infer<typeof agentErrorMessageSchema>;
export type InboundAgentMessage = z.infer<typeof inboundAgentMessageSchema>;
export type ServerHelloMessage = z.infer<typeof serverHelloMessageSchema>;
export type ServerAckMessage = z.infer<typeof serverAckMessageSchema>;
export type ServerPingMessage = z.infer<typeof serverPingMessageSchema>;
export type JobExecuteMessage = z.infer<typeof jobExecuteMessageSchema>;
export type JobCancelMessage = z.infer<typeof jobCancelMessageSchema>;

export type OutboundServerMessage =
  | ServerHelloMessage
  | ServerAckMessage
  | ServerPingMessage
  | JobExecuteMessage
  | JobCancelMessage;

export type AgentJobResult =
  | {
      ok: true;
      data: unknown;
      sentAt: string;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        details?: unknown;
      };
      sentAt: string;
    };
