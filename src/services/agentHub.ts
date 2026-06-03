import { appConfig, env } from "#config";
import crypto from "node:crypto";
import type { Server as HttpServer } from "node:http";
import {
  inboundAgentMessageSchema,
  type AgentCapability,
  type InboundAgentMessage,
  type AgentJobResult,
  type AgentResultMessage,
  type OutboundServerMessage,
} from "../agent/protocol.js";
import { handleAgentControllerButtonMessage } from "../agent/inbound/controllerButton/handler.js";
import {
  syncVoicemodRedeemsFromAgent,
  syncVoicemodSoundAlertsFromAgent,
} from "./agentRedeems.js";
import { WebSocketServer, type WebSocket } from "ws";

type AgentSession = {
  connectionId: string;
  agentId: string;
  agentName: string;
  location: string;
  version: string;
  capabilities: AgentCapability[];
  socket: WebSocket;
  isReady: boolean;
  connectedAt: number;
  lastHeartbeatAt: number;
};

type PendingJob = {
  agentId: string;
  timeout: NodeJS.Timeout;
  resolve: (value: AgentJobResult) => void;
  reject: (reason?: unknown) => void;
};

type VoicemodRedeemVoicePayload = {
  id?: unknown;
  friendlyName?: unknown;
  enabled?: unknown;
  isCustom?: unknown;
  favorited?: unknown;
  isNew?: unknown;
  bitmapChecksum?: unknown;
  image?: unknown;
  selectedImage?: unknown;
  transparentImage?: unknown;
  thumbnailImage?: unknown;
  thumbnailSelectedImage?: unknown;
  thumbnailTransparentImage?: unknown;
  imageUrl?: unknown;
  transparentImageUrl?: unknown;
  icon?: unknown;
  iconUrl?: unknown;
  avatar?: unknown;
  avatarUrl?: unknown;
};

type VoicemodSoundAlertPayload = {
  id?: unknown;
  name?: unknown;
  enabled?: unknown;
  playbackMode?: unknown;
  loop?: unknown;
  muteVoice?: unknown;
  stopOtherSounds?: unknown;
  image?: unknown;
  imageUrl?: unknown;
  icon?: unknown;
  iconUrl?: unknown;
  thumbnailImage?: unknown;
  thumbnailUrl?: unknown;
};

type VoicemodSoundboardPayload = {
  id?: unknown;
  name?: unknown;
};

const AGENT_WS_PATH = appConfig.server.agent.wsPath;
const HELLO_TIMEOUT_MS = 10_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_STALE_MS = 90_000;
const DEFAULT_JOB_TIMEOUT_MS = 15_000;

let agentWss: WebSocketServer | null = null;
const agentSessions = new Map<string, AgentSession>();
const pendingJobs = new Map<string, PendingJob>();
let heartbeatInterval: NodeJS.Timeout | null = null;

function nowIso() {
  return new Date().toISOString();
}

function sessionSupportsAction(session: AgentSession, action: string) {
  return session.capabilities.some((capability) => capability.actions.includes(action));
}

function isAgentDisconnectDuringJobError(error: unknown) {
  return error instanceof Error && error.message.includes("desconectou antes de concluir o job");
}

function getAgentCredentials() {
  const raw = env.VULKAN_AGENT_KEYS?.trim();
  if (!raw) {
    return new Map<string, string>();
  }

  const entries = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const credentials = new Map<string, string>();

  for (const entry of entries) {
    const separatorIndex = entry.indexOf(":");
    if (separatorIndex <= 0 || separatorIndex === entry.length - 1) {
      continue;
    }

    const agentId = entry.slice(0, separatorIndex).trim();
    const secret = entry.slice(separatorIndex + 1).trim();
    if (agentId && secret) {
      credentials.set(agentId, secret);
    }
  }

  return credentials;
}

function isAgentHubEnabled() {
  return getAgentCredentials().size > 0;
}

function sendMessage(socket: WebSocket, message: OutboundServerMessage) {
  socket.send(JSON.stringify(message));
}

function createServerHello() {
  return {
    type: "server.hello" as const,
    payload: {
      serverName: "Vulkan Sentinel",
      version: "1.0.0",
      sentAt: nowIso(),
    },
  };
}

function createServerAck(connectionId: string) {
  return {
    type: "server.ack" as const,
    payload: {
      ok: true,
      connectionId,
      sentAt: nowIso(),
    },
  };
}

function createServerPing() {
  return {
    type: "server.ping" as const,
    payload: {
      sentAt: nowIso(),
    },
  };
}

function closeSocket(socket: WebSocket, code: number, reason: string) {
  try {
    socket.close(code, reason);
  } catch {
  }
}

function unregisterAgent(connectionId: string) {
  const session = agentSessions.get(connectionId);
  if (!session) {
    return;
  }

  agentSessions.delete(connectionId);
  console.log(`[AgentHub] Agent ${session.agentId} desconectado.`);

  for (const [jobId, pendingJob] of pendingJobs.entries()) {
    if (pendingJob.agentId !== session.agentId) {
      continue;
    }

    clearTimeout(pendingJob.timeout);
    pendingJobs.delete(jobId);
    pendingJob.reject(new Error(`Agent ${session.agentId} desconectou antes de concluir o job ${jobId}.`));
  }
}

function registerAgent(connectionId: string, socket: WebSocket, message: Extract<ReturnType<typeof inboundAgentMessageSchema.parse>, { type: "agent.hello" }>) {
  const credentials = getAgentCredentials();
  const expectedSecret = credentials.get(message.payload.agentId);

  if (!expectedSecret || expectedSecret !== message.payload.agentSecret) {
    closeSocket(socket, 4003, "INVALID_AGENT_SECRET");
    throw new Error(`Agent ${message.payload.agentId} falhou na autenticacao.`);
  }

  const previousSession = Array.from(agentSessions.values()).find((session) => session.agentId === message.payload.agentId);
  if (previousSession) {
    closeSocket(previousSession.socket, 4001, "REPLACED_BY_NEW_CONNECTION");
    unregisterAgent(previousSession.connectionId);
  }

  agentSessions.set(connectionId, {
    connectionId,
    agentId: message.payload.agentId,
    agentName: message.payload.agentName,
    location: message.payload.location,
    version: message.payload.version,
    capabilities: message.payload.capabilities,
    socket,
    isReady: false,
    connectedAt: Date.now(),
    lastHeartbeatAt: Date.now(),
  });

  console.log(`[AgentHub] Agent ${message.payload.agentId} autenticado de ${message.payload.location}.`);
}

function ensureHeartbeatLoop() {
  if (heartbeatInterval) {
    return;
  }

  heartbeatInterval = setInterval(() => {
    const now = Date.now();
    for (const session of agentSessions.values()) {
      if (now - session.lastHeartbeatAt > HEARTBEAT_STALE_MS) {
        console.warn(`[AgentHub] Agent ${session.agentId} ficou sem heartbeat e sera desconectado.`);
        closeSocket(session.socket, 4000, "HEARTBEAT_TIMEOUT");
        unregisterAgent(session.connectionId);
        continue;
      }

      sendMessage(session.socket, createServerPing());
    }
  }, HEARTBEAT_INTERVAL_MS);
}

function formatValidationIssues(error: { issues?: Array<{ path?: PropertyKey[]; message?: string }> }) {
  return error.issues?.map((issue) => {
    const path = issue.path?.length ? issue.path.join(".") : "root";
    return `${path}: ${issue.message ?? "erro de validacao"}`;
  }).join("; ") ?? "erro de validacao desconhecido";
}

function parseSocketPayload(raw: unknown) {
  if (typeof raw !== "string" && !Buffer.isBuffer(raw)) {
    return {
      ok: false as const,
      reason: "payload websocket nao esta em texto/json",
    };
  }

  try {
    return {
      ok: true as const,
      payload: JSON.parse(Buffer.isBuffer(raw) ? raw.toString("utf8") : raw) as unknown,
    };
  } catch (error) {
    return {
      ok: false as const,
      reason: error instanceof Error ? error.message : "json invalido",
    };
  }
}

function parseSocketMessage(payload: unknown) {
  const parsed = inboundAgentMessageSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false as const,
      reason: formatValidationIssues(parsed.error),
    };
  }

  return {
    ok: true as const,
    message: parsed.data satisfies InboundAgentMessage,
  };
}

function getRawMessageType(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("type" in payload)) {
    return null;
  }

  const type = (payload as { type?: unknown }).type;
  return typeof type === "string" ? type : null;
}

function getControllerButtonReceiptSummary(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "sem payload estruturado";
  }

  const envelope = payload as {
    payload?: {
      jobId?: unknown;
      action?: unknown;
      source?: unknown;
      payload?: {
        category?: unknown;
      };
    };
  };

  const jobId = typeof envelope.payload?.jobId === "string" ? envelope.payload.jobId : "desconhecido";
  const action = typeof envelope.payload?.action === "string" ? envelope.payload.action : "desconhecido";
  const source = typeof envelope.payload?.source === "string" ? envelope.payload.source : "desconhecido";
  const category = typeof envelope.payload?.payload?.category === "string" ? envelope.payload.payload.category : null;

  return `jobId=${jobId} action=${action} source=${source}${category ? ` category=${category}` : ""}`;
}

function handleAgentResult(message: AgentResultMessage) {
  const pendingJob = pendingJobs.get(message.payload.jobId);
  if (!pendingJob) {
    return;
  }

  clearTimeout(pendingJob.timeout);
  pendingJobs.delete(message.payload.jobId);

  if (message.payload.ok) {
    pendingJob.resolve({
      ok: true,
      data: message.payload.data,
      sentAt: message.payload.sentAt,
    });
    return;
  }

  pendingJob.resolve({
    ok: false,
    error: {
      code: message.payload.error?.code ?? "UNKNOWN_AGENT_ERROR",
      message: message.payload.error?.message ?? "Agent retornou erro sem mensagem.",
      details: message.payload.error?.details,
    },
    sentAt: message.payload.sentAt,
  });
}

export function attachAgentHub(server: HttpServer) {
  if (agentWss || !isAgentHubEnabled()) {
    if (!isAgentHubEnabled()) {
      console.log("[AgentHub] Desabilitado: VULKAN_AGENT_KEYS nao configurado.");
    }
    return;
  }

  agentWss = new WebSocketServer({ noServer: true });
  ensureHeartbeatLoop();

  server.on("upgrade", (request, socket, head) => {
    const host = request.headers.host ?? `127.0.0.1:${request.socket.localPort ?? 80}`;
    const url = new URL(request.url ?? "/", `http://${host}`);
    if (url.pathname !== AGENT_WS_PATH) {
      socket.destroy();
      return;
    }

    agentWss?.handleUpgrade(request, socket, head, (ws) => {
      agentWss?.emit("connection", ws, request);
    });
  });

  agentWss.on("connection", (socket) => {
    const connectionId = crypto.randomUUID();
    let authenticated = false;
    const helloTimeout = setTimeout(() => {
      if (!authenticated) {
        closeSocket(socket, 4008, "HELLO_TIMEOUT");
      }
    }, HELLO_TIMEOUT_MS);

    sendMessage(socket, createServerHello());

    socket.on("message", async (raw) => {
      const decodedPayload = parseSocketPayload(raw);
      if (!decodedPayload.ok) {
        console.warn(`[AgentHub] Mensagem rejeitada connection=${connectionId}: ${decodedPayload.reason}`);
        closeSocket(socket, 4007, "INVALID_MESSAGE");
        return;
      }

      const rawType = getRawMessageType(decodedPayload.payload);
      if (rawType === "agent.controllerButton") {
        console.log(
          `[AgentHub] agent.controllerButton recebido connection=${connectionId}${authenticated ? ` agent=${agentSessions.get(connectionId)?.agentId ?? "desconhecido"}` : ""} ${getControllerButtonReceiptSummary(decodedPayload.payload)}`,
        );
      }

      const parsedMessage = parseSocketMessage(decodedPayload.payload);
      if (!parsedMessage.ok) {
        console.warn(
          `[AgentHub] Mensagem rejeitada connection=${connectionId}${rawType ? ` type=${rawType}` : ""}: ${parsedMessage.reason}`,
        );
        closeSocket(socket, 4007, "INVALID_MESSAGE");
        return;
      }

      const message = parsedMessage.message;

      if (!authenticated) {
        if (message.type !== "agent.hello") {
          closeSocket(socket, 4002, "EXPECTED_AGENT_HELLO");
          return;
        }

        try {
          registerAgent(connectionId, socket, message);
          authenticated = true;
          clearTimeout(helloTimeout);
          sendMessage(socket, createServerAck(connectionId));
        } catch (error) {
          console.error("[AgentHub] Falha ao registrar agent:", error);
        }
        return;
      }

      const session = agentSessions.get(connectionId);
      if (!session) {
        closeSocket(socket, 4004, "SESSION_NOT_FOUND");
        return;
      }

      session.lastHeartbeatAt = Date.now();

      if (message.type === "agent.ready") {
        session.isReady = true;
        console.log(`[AgentHub] Agent ${session.agentId} sinalizou pronto.`);
        void syncAgentRedeems(session.agentId);
        return;
      }

      if (message.type === "agent.heartbeat") {
        return;
      }

      if (message.type === "agent.result") {
        handleAgentResult(message);
        return;
      }

      if (message.type === "agent.error" && message.payload.jobId) {
        const pendingJob = pendingJobs.get(message.payload.jobId);
        if (!pendingJob) {
          return;
        }

        clearTimeout(pendingJob.timeout);
        pendingJobs.delete(message.payload.jobId);
        pendingJob.resolve({
          ok: false,
          error: {
            code: message.payload.code,
            message: message.payload.message,
            details: message.payload.details,
          },
          sentAt: message.payload.sentAt,
        });
        return;
      }

      if (message.type === "agent.controllerButton") {
        try {
          await handleAgentControllerButtonMessage(
            {
              connectionId: session.connectionId,
              agentId: session.agentId,
            },
            message,
          );
        } catch (error) {
          console.error(
            `[AgentHub] Erro ao processar agent.controllerButton connection=${session.connectionId} agent=${session.agentId} jobId=${message.payload.jobId} action=${message.payload.action}:`,
            error,
          );
        }
      }
    });

    socket.on("close", () => {
      clearTimeout(helloTimeout);
      unregisterAgent(connectionId);
    });

    socket.on("error", (error) => {
      console.error("[AgentHub] Erro no socket do agent:", error);
    });
  });

  console.log(`[AgentHub] Aceitando conexoes de agent em ${AGENT_WS_PATH}.`);
}

export function getConnectedAgentsSnapshot() {
  return Array.from(agentSessions.values()).map((session) => ({
    connectionId: session.connectionId,
    agentId: session.agentId,
    agentName: session.agentName,
    location: session.location,
    version: session.version,
    capabilities: session.capabilities,
    isReady: session.isReady,
    connectedAt: new Date(session.connectedAt).toISOString(),
    lastHeartbeatAt: new Date(session.lastHeartbeatAt).toISOString(),
  }));
}

export function isAgentConnected(agentId: string) {
  return Array.from(agentSessions.values()).some((session) => session.agentId === agentId && session.isReady);
}

async function syncVoicemodRedeemsForAgent(agentId: string) {
  const session = Array.from(agentSessions.values()).find((entry) => entry.agentId === agentId);
  if (!session || !session.isReady || !sessionSupportsAction(session, "voicemod.getRedeemVoices")) {
    return;
  }

  try {
    const { result } = await dispatchAgentJob({
      agentId,
      action: "voicemod.getRedeemVoices",
      payload: {},
      timeoutMs: 30_000,
    });

    if (!result.ok) {
      console.error(`[AgentHub] Falha ao sincronizar vozes do agent ${agentId}:`, result.error);
      return;
    }

    const rawVoices = Array.isArray(result.data)
      ? result.data
      : result.data && typeof result.data === "object" && Array.isArray((result.data as { voices?: unknown[] }).voices)
        ? (result.data as { voices: unknown[] }).voices
        : [];

    const voices = rawVoices
      .map((voice) => {
        if (!voice || typeof voice !== "object") {
          return null;
        }

        const candidate = voice as VoicemodRedeemVoicePayload;

        if (typeof candidate.id !== "string" || typeof candidate.friendlyName !== "string") {
          return null;
        }

        return {
          id: candidate.id,
          friendlyName: candidate.friendlyName,
          enabled: typeof candidate.enabled === "boolean" ? candidate.enabled : true,
          isCustom: typeof candidate.isCustom === "boolean" ? candidate.isCustom : false,
          favorited: typeof candidate.favorited === "boolean" ? candidate.favorited : false,
          isNew: typeof candidate.isNew === "boolean" ? candidate.isNew : false,
          bitmapChecksum: typeof candidate.bitmapChecksum === "string" ? candidate.bitmapChecksum : null,
          image:
            typeof candidate.thumbnailImage === "string"
              ? candidate.thumbnailImage
              : typeof candidate.image === "string"
              ? candidate.image
              : typeof candidate.imageUrl === "string"
                ? candidate.imageUrl
                : typeof candidate.icon === "string"
                  ? candidate.icon
                  : typeof candidate.iconUrl === "string"
                    ? candidate.iconUrl
                    : typeof candidate.avatar === "string"
                      ? candidate.avatar
                      : typeof candidate.avatarUrl === "string"
                        ? candidate.avatarUrl
                        : null,
          selectedImage:
            typeof candidate.thumbnailSelectedImage === "string"
              ? candidate.thumbnailSelectedImage
              : typeof candidate.selectedImage === "string"
                ? candidate.selectedImage
                : null,
          transparentImage:
            typeof candidate.thumbnailTransparentImage === "string"
              ? candidate.thumbnailTransparentImage
              : typeof candidate.transparentImage === "string"
              ? candidate.transparentImage
              : typeof candidate.transparentImageUrl === "string"
                ? candidate.transparentImageUrl
                : null,
          thumbnailImage: typeof candidate.thumbnailImage === "string" ? candidate.thumbnailImage : null,
          thumbnailSelectedImage: typeof candidate.thumbnailSelectedImage === "string" ? candidate.thumbnailSelectedImage : null,
          thumbnailTransparentImage: typeof candidate.thumbnailTransparentImage === "string" ? candidate.thumbnailTransparentImage : null,
        };
      })
      .filter((voice): voice is NonNullable<typeof voice> => Boolean(voice));

    const voicesWithThumb = voices.filter((voice) => Boolean(voice.image || voice.transparentImage)).length;
    const sampleVoiceKeys = rawVoices[0] && typeof rawVoices[0] === "object" ? Object.keys(rawVoices[0] as Record<string, unknown>) : [];

    await syncVoicemodRedeemsFromAgent({
      agentId,
      voices,
    });

    console.log(
      `[AgentHub] Sincronizacao de vozes concluida para ${agentId}. Vozes: ${voices.length}. ` +
      `Com thumb: ${voicesWithThumb}. Sem thumb: ${Math.max(voices.length - voicesWithThumb, 0)}. ` +
      `Campos da primeira voz: ${sampleVoiceKeys.join(", ") || "nenhum"}.`
    );
  } catch (error) {
    if (isAgentDisconnectDuringJobError(error)) {
      console.warn(`[AgentHub] Sync de vozes cancelado para ${agentId}: agent desconectou durante voicemod.getRedeemVoices.`);
      return;
    }

    console.error(`[AgentHub] Erro ao sincronizar vozes do agent ${agentId}:`, error);
  }
}

async function syncVoicemodSoundAlertsForAgent(agentId: string) {
  const session = Array.from(agentSessions.values()).find((entry) => entry.agentId === agentId);
  if (!session || !session.isReady || !sessionSupportsAction(session, "voicemod.getSoundAlerts")) {
    return;
  }

  try {
    const { result } = await dispatchAgentJob({
      agentId,
      action: "voicemod.getSoundAlerts",
      payload: {},
      timeoutMs: 30_000,
    });

    if (!result.ok) {
      console.error(`[AgentHub] Falha ao sincronizar sound alerts do agent ${agentId}:`, result.error);
      return;
    }

    const data = result.data && typeof result.data === "object" ? result.data as {
      soundAlerts?: unknown[];
      soundboard?: unknown;
    } : null;
    const rawSoundAlerts = Array.isArray(data?.soundAlerts) ? data.soundAlerts : [];
    const rawSoundboard = data?.soundboard && typeof data.soundboard === "object"
      ? data.soundboard as VoicemodSoundboardPayload
      : null;

    const soundAlerts = rawSoundAlerts
      .map((soundAlert) => {
        if (!soundAlert || typeof soundAlert !== "object") {
          return null;
        }

        const candidate = soundAlert as VoicemodSoundAlertPayload;
        if (typeof candidate.id !== "string" || typeof candidate.name !== "string") {
          return null;
        }

        return {
          id: candidate.id,
          name: candidate.name,
          enabled: typeof candidate.enabled === "boolean" ? candidate.enabled : true,
          playbackMode: typeof candidate.playbackMode === "string" ? candidate.playbackMode : null,
          loop: typeof candidate.loop === "boolean" ? candidate.loop : false,
          muteVoice: typeof candidate.muteVoice === "boolean" ? candidate.muteVoice : false,
          stopOtherSounds: typeof candidate.stopOtherSounds === "boolean" ? candidate.stopOtherSounds : false,
          thumbnailImage:
            typeof candidate.thumbnailImage === "string"
              ? candidate.thumbnailImage
              : typeof candidate.thumbnailUrl === "string"
                ? candidate.thumbnailUrl
                : typeof candidate.image === "string"
                  ? candidate.image
                  : typeof candidate.imageUrl === "string"
                    ? candidate.imageUrl
                    : typeof candidate.icon === "string"
                      ? candidate.icon
                      : typeof candidate.iconUrl === "string"
                        ? candidate.iconUrl
                        : null,
        };
      })
      .filter((soundAlert): soundAlert is NonNullable<typeof soundAlert> => Boolean(soundAlert));

    await syncVoicemodSoundAlertsFromAgent({
      agentId,
      soundAlerts,
      soundboard: {
        id: typeof rawSoundboard?.id === "string" ? rawSoundboard.id : null,
        name: typeof rawSoundboard?.name === "string" ? rawSoundboard.name : null,
      },
    });

    console.log(
      `[AgentHub] Sincronizacao de sound alerts concluida para ${agentId}. Itens: ${soundAlerts.length}. ` +
      `Soundboard: ${typeof rawSoundboard?.name === "string" ? rawSoundboard.name : "desconhecida"}.`
    );
  } catch (error) {
    if (isAgentDisconnectDuringJobError(error)) {
      console.warn(`[AgentHub] Sync de sound alerts cancelado para ${agentId}: agent desconectou durante voicemod.getSoundAlerts.`);
      return;
    }

    console.error(`[AgentHub] Erro ao sincronizar sound alerts do agent ${agentId}:`, error);
  }
}

export async function syncAgentRedeems(agentId: string) {
  await Promise.allSettled([
    syncVoicemodRedeemsForAgent(agentId),
    syncVoicemodSoundAlertsForAgent(agentId),
  ]);
}

export async function syncVoicemodCatalogsForReadyAgents() {
  const readyAgentIds = Array.from(new Set(
    Array.from(agentSessions.values())
      .filter((session) => session.isReady)
      .filter((session) =>
        sessionSupportsAction(session, "voicemod.getRedeemVoices") ||
        sessionSupportsAction(session, "voicemod.getSoundAlerts")
      )
      .map((session) => session.agentId)
  ));

  await Promise.allSettled(readyAgentIds.map((agentId) => syncAgentRedeems(agentId)));
}

export async function dispatchAgentJob(input: {
  agentId: string;
  action: string;
  payload: unknown;
  timeoutMs?: number;
}) {
  const session = Array.from(agentSessions.values()).find((entry) => entry.agentId === input.agentId);
  if (!session) {
    throw new Error(`Agent ${input.agentId} nao esta conectado.`);
  }

  if (!session.isReady) {
    throw new Error(`Agent ${input.agentId} ainda nao esta pronto.`);
  }

  const jobId = crypto.randomUUID();
  const timeoutMs = Math.max(1_000, Math.min(input.timeoutMs ?? DEFAULT_JOB_TIMEOUT_MS, 120_000));

  const resultPromise = new Promise<AgentJobResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingJobs.delete(jobId);
      reject(new Error(`Timeout aguardando resultado do job ${jobId} em ${input.agentId}.`));
    }, timeoutMs);

    pendingJobs.set(jobId, {
      agentId: input.agentId,
      timeout,
      resolve,
      reject,
    });
  });

  sendMessage(session.socket, {
    type: "job.execute",
    payload: {
      jobId,
      action: input.action,
      payload: input.payload,
      sentAt: nowIso(),
    },
  });

  return {
    jobId,
    result: await resultPromise,
  };
}

export async function shutdownAgentHub() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  for (const session of agentSessions.values()) {
    closeSocket(session.socket, 1001, "SERVER_SHUTDOWN");
  }
  agentSessions.clear();

  for (const [jobId, pendingJob] of pendingJobs.entries()) {
    clearTimeout(pendingJob.timeout);
    pendingJobs.delete(jobId);
    pendingJob.reject(new Error(`Job ${jobId} cancelado no shutdown do server.`));
  }

  if (agentWss) {
    await new Promise<void>((resolve) => {
      agentWss?.close(() => resolve());
    });
    agentWss = null;
  }
}
