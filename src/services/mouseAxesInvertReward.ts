import { prisma } from "#database";
import { dispatchAgentJob, getConnectedAgentsSnapshot, isAgentConnected } from "./agentHub.js";
import { publishRewardOverlayMessage } from "./chatOverlay.js";
import { publishMouseAxesInvertOverlayState } from "./mouseAxesInvertOverlay.js";
import { getRewardSetting } from "./rewardSettings.js";
import { sendSystemChatMessage } from "./twitchChat.js";

const MOUSE_AXES_INVERT_REDEEM_DURATION_MS = 3 * 60 * 1000;
const MOUSE_AXES_INVERT_MAX_DURATION_MS = 15 * 60 * 1000;
const MOUSE_AXES_INVERT_COOLDOWN_MS = 10 * 60 * 1000;
const MOUSE_AXES_INVERT_POLL_MS = 5_000;
const MOUSE_AXES_INVERT_EFFECT_KEY = "mouse.axes.invert.xy";
const MOUSE_AXES_INVERT_SOURCE = "sentinel";
const MOUSE_AXES_INVERT_AXES = ["x", "y"] as const;

type RewardUser = {
  id: number;
  discordId: string;
  twitchId: string | null;
  balance: number;
};

type PersistedEffectState = "idle" | "active" | "paused";

type MouseAxesInvertStateRow = {
  effectKey: string;
  userId: number | null;
  requesterName: string | null;
  agentId: string | null;
  state: string;
  startedAt: Date | null;
  expiresAt: Date | null;
  pausedAt: Date | null;
  sessionId: string | null;
  source: string | null;
  agentState: string;
  cooldownUntil: Date | null;
  lastConnectionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MouseAxesInvertEffectState = {
  effectKey: typeof MOUSE_AXES_INVERT_EFFECT_KEY;
  userId: number | null;
  requesterName: string | null;
  agentId: string | null;
  state: PersistedEffectState;
  startedAt: string | null;
  expiresAt: string | null;
  pausedAt: string | null;
  sessionId: string | null;
  source: string | null;
  agentState: PersistedEffectState;
  cooldownUntil: string | null;
};

type MouseAxesInvertAgentPayload = {
  accepted: boolean;
  state: PersistedEffectState;
  sessionId: string | null;
  source: string | null;
  startedAt: string | null;
  pausedAt: string | null;
  receivedAt: string | null;
};

type MouseAxesInvertRewardResult =
  | {
      ok: true;
      user: RewardUser;
      chargedAmount: number;
      balanceAfter: number;
      effect: MouseAxesInvertEffectState;
    }
  | {
      ok: false;
      code:
        | "USER_NOT_FOUND"
        | "REWARD_DISABLED"
        | "COOLDOWN_ACTIVE"
        | "AGENT_OFFLINE"
        | "INSUFFICIENT_BALANCE"
        | "AGENT_ERROR";
      chargedAmount?: number;
      user?: RewardUser;
      message: string;
    };

let ensureMouseAxesInvertStateTablePromise: Promise<void> | null = null;
let mouseAxesInvertControllerInterval: NodeJS.Timeout | null = null;
let mouseAxesInvertControllerInFlight = false;
let ensureMouseAxesInvertReconcilePromise: Promise<void> | null = null;

function parsePersistedEffectState(value: string | null | undefined): PersistedEffectState {
  if (value === "active" || value === "paused" || value === "idle") {
    return value;
  }

  return "idle";
}

function hasMouseAxesInvertReachedMaxDuration(row: MouseAxesInvertStateRow | null) {
  if (!row?.startedAt || !row.expiresAt) {
    return false;
  }

  return row.expiresAt.getTime() >= row.startedAt.getTime() + MOUSE_AXES_INVERT_MAX_DURATION_MS;
}

function mapEffectState(row: MouseAxesInvertStateRow | null): MouseAxesInvertEffectState {
  return {
    effectKey: MOUSE_AXES_INVERT_EFFECT_KEY,
    userId: row?.userId ?? null,
    requesterName: row?.requesterName ?? null,
    agentId: row?.agentId ?? null,
    state: parsePersistedEffectState(row?.state),
    startedAt: row?.startedAt?.toISOString() ?? null,
    expiresAt: row?.expiresAt?.toISOString() ?? null,
    pausedAt: row?.pausedAt?.toISOString() ?? null,
    sessionId: row?.sessionId ?? null,
    source: row?.source ?? null,
    agentState: parsePersistedEffectState(row?.agentState),
    cooldownUntil: row?.cooldownUntil?.toISOString() ?? null,
  };
}

function syncMouseAxesInvertOverlay(effect: MouseAxesInvertEffectState) {
  publishMouseAxesInvertOverlayState({
    active: effect.state === "active" || effect.state === "paused",
    requesterName: effect.requesterName,
    startedAt: effect.startedAt,
    expiresAt: effect.expiresAt,
  });
}

async function ensureMouseAxesInvertStateTable() {
  if (!ensureMouseAxesInvertStateTablePromise) {
    ensureMouseAxesInvertStateTablePromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "MouseAxesInvertState" (
          "effectKey" TEXT PRIMARY KEY,
          "userId" INTEGER NULL,
          "requesterName" TEXT NULL,
          "agentId" TEXT NULL,
          "state" TEXT NOT NULL DEFAULT 'idle',
          "startedAt" TIMESTAMP(3) NULL,
          "expiresAt" TIMESTAMP(3) NULL,
          "pausedAt" TIMESTAMP(3) NULL,
          "sessionId" TEXT NULL,
          "source" TEXT NULL,
          "agentState" TEXT NOT NULL DEFAULT 'idle',
          "cooldownUntil" TIMESTAMP(3) NULL,
          "lastConnectionId" TEXT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "MouseAxesInvertState"
        ADD COLUMN IF NOT EXISTS "userId" INTEGER NULL
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "MouseAxesInvertState"
        ADD COLUMN IF NOT EXISTS "requesterName" TEXT NULL
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "MouseAxesInvertState"
        ADD COLUMN IF NOT EXISTS "agentId" TEXT NULL
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "MouseAxesInvertState"
        ADD COLUMN IF NOT EXISTS "state" TEXT NOT NULL DEFAULT 'idle'
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "MouseAxesInvertState"
        ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3) NULL
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "MouseAxesInvertState"
        ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3) NULL
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "MouseAxesInvertState"
        ADD COLUMN IF NOT EXISTS "pausedAt" TIMESTAMP(3) NULL
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "MouseAxesInvertState"
        ADD COLUMN IF NOT EXISTS "sessionId" TEXT NULL
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "MouseAxesInvertState"
        ADD COLUMN IF NOT EXISTS "source" TEXT NULL
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "MouseAxesInvertState"
        ADD COLUMN IF NOT EXISTS "agentState" TEXT NOT NULL DEFAULT 'idle'
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "MouseAxesInvertState"
        ADD COLUMN IF NOT EXISTS "cooldownUntil" TIMESTAMP(3) NULL
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "MouseAxesInvertState"
        ADD COLUMN IF NOT EXISTS "lastConnectionId" TEXT NULL
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "MouseAxesInvertState"
        ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "MouseAxesInvertState"
        ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      `);

      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION update_mouse_axes_invert_state_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW."updatedAt" = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql'
      `);

      await prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS "MouseAxesInvertState_set_updatedAt" ON "MouseAxesInvertState"
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER "MouseAxesInvertState_set_updatedAt"
        BEFORE UPDATE ON "MouseAxesInvertState"
        FOR EACH ROW
        EXECUTE FUNCTION update_mouse_axes_invert_state_updated_at()
      `);

      await prisma.$queryRaw`
        INSERT INTO "MouseAxesInvertState" (
          "effectKey",
          "state",
          "agentState",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${MOUSE_AXES_INVERT_EFFECT_KEY},
          'idle',
          'idle',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT ("effectKey") DO NOTHING
      `;
    })().catch((error) => {
      ensureMouseAxesInvertStateTablePromise = null;
      throw error;
    });
  }

  await ensureMouseAxesInvertStateTablePromise;
}

async function loadMouseAxesInvertStateRow() {
  await ensureMouseAxesInvertStateTable();

  const rows = await prisma.$queryRaw<MouseAxesInvertStateRow[]>`
    SELECT
      "effectKey",
      "userId",
      "requesterName",
      "agentId",
      "state",
      "startedAt",
      "expiresAt",
      "pausedAt",
      "sessionId",
      "source",
      "agentState",
      "cooldownUntil",
      "lastConnectionId",
      "createdAt",
      "updatedAt"
    FROM "MouseAxesInvertState"
    WHERE "effectKey" = ${MOUSE_AXES_INVERT_EFFECT_KEY}
    LIMIT 1
  `;

  const row = rows[0] ?? null;
  syncMouseAxesInvertOverlay(mapEffectState(row));
  return row;
}

async function saveMouseAxesInvertState(input: {
  userId?: number | null;
  requesterName?: string | null;
  agentId?: string | null;
  state: PersistedEffectState;
  startedAt?: Date | null;
  expiresAt?: Date | null;
  pausedAt?: Date | null;
  sessionId?: string | null;
  source?: string | null;
  agentState?: PersistedEffectState;
  cooldownUntil?: Date | null;
  lastConnectionId?: string | null;
}) {
  await ensureMouseAxesInvertStateTable();

  const rows = await prisma.$queryRaw<MouseAxesInvertStateRow[]>`
    INSERT INTO "MouseAxesInvertState" (
      "effectKey",
      "userId",
      "requesterName",
      "agentId",
      "state",
      "startedAt",
      "expiresAt",
      "pausedAt",
      "sessionId",
      "source",
      "agentState",
      "cooldownUntil",
      "lastConnectionId",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${MOUSE_AXES_INVERT_EFFECT_KEY},
      ${input.userId ?? null},
      ${input.requesterName ?? null},
      ${input.agentId ?? null},
      ${input.state},
      ${input.startedAt ?? null},
      ${input.expiresAt ?? null},
      ${input.pausedAt ?? null},
      ${input.sessionId ?? null},
      ${input.source ?? null},
      ${input.agentState ?? input.state},
      ${input.cooldownUntil ?? null},
      ${input.lastConnectionId ?? null},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("effectKey")
    DO UPDATE SET
      "userId" = EXCLUDED."userId",
      "requesterName" = EXCLUDED."requesterName",
      "agentId" = EXCLUDED."agentId",
      "state" = EXCLUDED."state",
      "startedAt" = EXCLUDED."startedAt",
      "expiresAt" = EXCLUDED."expiresAt",
      "pausedAt" = EXCLUDED."pausedAt",
      "sessionId" = EXCLUDED."sessionId",
      "source" = EXCLUDED."source",
      "agentState" = EXCLUDED."agentState",
      "cooldownUntil" = EXCLUDED."cooldownUntil",
      "lastConnectionId" = EXCLUDED."lastConnectionId",
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING
      "effectKey",
      "userId",
      "requesterName",
      "agentId",
      "state",
      "startedAt",
      "expiresAt",
      "pausedAt",
      "sessionId",
      "source",
      "agentState",
      "cooldownUntil",
      "lastConnectionId",
      "createdAt",
      "updatedAt"
  `;

  return rows[0] ?? null;
}

function supportsAction(actions: Array<{ actions: string[] }>, action: string) {
  return actions.some((entry) => Array.isArray(entry.actions) && entry.actions.includes(action));
}

function findMouseAxesInvertAgent(preferredAgentId?: string | null) {
  const readyAgents = getConnectedAgentsSnapshot().filter((agent) => agent.isReady);

  if (preferredAgentId) {
    const preferred = readyAgents.find((agent) =>
      agent.agentId === preferredAgentId &&
      supportsAction(agent.capabilities, "mouse.axes.invert.start")
    );

    if (preferred) {
      return preferred;
    }
  }

  return readyAgents.find((agent) => supportsAction(agent.capabilities, "mouse.axes.invert.start")) ?? null;
}

function normalizeIsoDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseAgentPayload(payload: unknown): MouseAxesInvertAgentPayload {
  const candidate = payload && typeof payload === "object"
    ? payload as {
      accepted?: unknown;
      state?: unknown;
      sessionId?: unknown;
      source?: unknown;
      startedAt?: unknown;
      pausedAt?: unknown;
      receivedAt?: unknown;
    }
    : null;

  return {
    accepted: candidate?.accepted === true,
    state: parsePersistedEffectState(typeof candidate?.state === "string" ? candidate.state : null),
    sessionId: typeof candidate?.sessionId === "string" ? candidate.sessionId : null,
    source: typeof candidate?.source === "string" ? candidate.source : null,
    startedAt: normalizeIsoDate(candidate?.startedAt),
    pausedAt: normalizeIsoDate(candidate?.pausedAt),
    receivedAt: normalizeIsoDate(candidate?.receivedAt),
  };
}

function isMissingResumeSessionError(error: { code?: string; message?: string }) {
  const code = String(error.code ?? "").toUpperCase();
  const message = String(error.message ?? "").toUpperCase();
  return (
    code.includes("SESSION") ||
    message.includes("NO SESSION IS ACTIVE") ||
    message.includes("CANNOT RESUME")
  );
}

function logAgentEffectResponse(action: string, agentId: string, payload: MouseAxesInvertAgentPayload) {
  console.log(
    `[MouseAxesInvert] Resposta do Agent action=${action} agent=${agentId} state=${payload.state} sessionId=${payload.sessionId ?? "null"} startedAt=${payload.startedAt ?? "null"} pausedAt=${payload.pausedAt ?? "null"}`,
  );
}

async function dispatchMouseAxesInvertAction(input: {
  agentId: string;
  action: "mouse.axes.invert.start" | "mouse.axes.invert.stop" | "mouse.axes.invert.resume";
}) {
  console.log(`[MouseAxesInvert] Enviando ${input.action} para agent=${input.agentId}.`);

  const result = await dispatchAgentJob({
    agentId: input.agentId,
    action: input.action,
    payload: {
      source: MOUSE_AXES_INVERT_SOURCE,
      axes: [...MOUSE_AXES_INVERT_AXES],
    },
    timeoutMs: 30_000,
  });

  if (!result.result.ok) {
    return {
      ok: false as const,
      error: result.result.error,
    };
  }

  const payload = parseAgentPayload(result.result.data);
  logAgentEffectResponse(input.action, input.agentId, payload);

  return {
    ok: true as const,
    payload,
  };
}

async function findRewardUser(input: { twitchId?: string; discordId?: string }) {
  if (input.discordId) {
    return prisma.user.findUnique({
      where: { discordId: input.discordId },
      select: {
        id: true,
        discordId: true,
        twitchId: true,
        balance: true,
      },
    });
  }

  if (input.twitchId) {
    return prisma.user.findUnique({
      where: { twitchId: input.twitchId },
      select: {
        id: true,
        discordId: true,
        twitchId: true,
        balance: true,
      },
    });
  }

  return null;
}

async function activateOrExtendMouseAxesInvert(input: {
  userId: number;
  requesterName?: string | null;
}) {
  const current = await loadMouseAxesInvertStateRow();
  const now = new Date();

  if (current && (current.state === "active" || current.state === "paused") && current.agentId) {
    const startedAt = current.startedAt ?? now;
    const maxExpiresAt = startedAt.getTime() + MOUSE_AXES_INVERT_MAX_DURATION_MS;
    const extensionBaseMs = current.expiresAt && current.expiresAt.getTime() > now.getTime()
      ? current.expiresAt.getTime()
      : now.getTime();
    const nextExpiresAt = new Date(
      Math.min(extensionBaseMs + MOUSE_AXES_INVERT_REDEEM_DURATION_MS, maxExpiresAt),
    );

    const updated = await saveMouseAxesInvertState({
      userId: input.userId,
      requesterName: input.requesterName ?? current.requesterName,
      agentId: current.agentId,
      state: current.state === "paused" ? "paused" : "active",
      startedAt,
      expiresAt: nextExpiresAt,
      pausedAt: current.pausedAt,
      sessionId: current.sessionId,
      source: current.source ?? MOUSE_AXES_INVERT_SOURCE,
      agentState: parsePersistedEffectState(current.agentState),
      cooldownUntil: null,
      lastConnectionId: current.lastConnectionId,
    });

    return mapEffectState(updated);
  }

  const agent = findMouseAxesInvertAgent(current?.agentId ?? null);
  if (!agent) {
    throw new Error("AGENT_OFFLINE");
  }

  const startResult = await dispatchMouseAxesInvertAction({
    agentId: agent.agentId,
    action: "mouse.axes.invert.start",
  });

  if (!startResult.ok) {
    throw new Error(startResult.error.code || "AGENT_ERROR");
  }

  const startedAt = startResult.payload.startedAt ? new Date(startResult.payload.startedAt) : now;
  const nextExpiresAt = new Date(
    startedAt.getTime() + Math.min(MOUSE_AXES_INVERT_REDEEM_DURATION_MS, MOUSE_AXES_INVERT_MAX_DURATION_MS),
  );

  const persisted = await saveMouseAxesInvertState({
    userId: input.userId,
    requesterName: input.requesterName ?? null,
    agentId: agent.agentId,
    state: startResult.payload.state === "paused" ? "paused" : "active",
    startedAt,
    expiresAt: nextExpiresAt,
    pausedAt: startResult.payload.pausedAt ? new Date(startResult.payload.pausedAt) : null,
    sessionId: startResult.payload.sessionId,
    source: startResult.payload.source ?? MOUSE_AXES_INVERT_SOURCE,
    agentState: startResult.payload.state,
    cooldownUntil: null,
    lastConnectionId: agent.connectionId,
  });

  return mapEffectState(persisted);
}

async function announceMouseAxesInvertRedeem(requesterName?: string | null) {
  if (!requesterName?.trim()) {
    return;
  }

  const announcement = `${requesterName} resgatou Mouse invertido!`;

  publishRewardOverlayMessage({
    username: "Vulkan Sentinel",
    message: announcement,
    icon: "MSX",
  });

  await sendSystemChatMessage(announcement).catch((error) => {
    console.error("[MouseAxesInvert] Falha ao avisar resgate no chat da Twitch:", error);
  });
}

async function stopMouseAxesInvertInternal(row: MouseAxesInvertStateRow, options?: { applyCooldown?: boolean }) {
  const cooldownUntil = options?.applyCooldown
    ? new Date(Date.now() + MOUSE_AXES_INVERT_COOLDOWN_MS)
    : row.cooldownUntil;

  const clearPersistedState = async (agentId: string | null, lastConnectionId: string | null) => {
    const cleared = await saveMouseAxesInvertState({
      userId: row.userId,
      requesterName: row.requesterName,
      agentId,
      state: "idle",
      startedAt: null,
      expiresAt: null,
      pausedAt: null,
      sessionId: null,
      source: row.source ?? MOUSE_AXES_INVERT_SOURCE,
      agentState: "idle",
      cooldownUntil,
      lastConnectionId,
    });

    return mapEffectState(cleared);
  };

  if (!row.agentId) {
    return clearPersistedState(null, null);
  }

  if (!isAgentConnected(row.agentId)) {
    return clearPersistedState(row.agentId, null);
  }

  const stopResult = await dispatchMouseAxesInvertAction({
    agentId: row.agentId,
    action: "mouse.axes.invert.stop",
  });

  if (!stopResult.ok) {
    const errorCode = stopResult.error.code.toUpperCase();
    const errorMessage = stopResult.error.message.toUpperCase();
    if (errorCode.includes("IDLE") || errorMessage.includes("IDLE")) {
      return clearPersistedState(row.agentId, null);
    }

    throw new Error(stopResult.error.code || "AGENT_ERROR");
  }

  const persisted = await saveMouseAxesInvertState({
    userId: row.userId,
    requesterName: row.requesterName,
    agentId: row.agentId,
    state: "idle",
    startedAt: null,
    expiresAt: null,
    pausedAt: stopResult.payload.pausedAt ? new Date(stopResult.payload.pausedAt) : null,
    sessionId: stopResult.payload.sessionId,
    source: stopResult.payload.source ?? row.source ?? MOUSE_AXES_INVERT_SOURCE,
    agentState: stopResult.payload.state,
    cooldownUntil,
    lastConnectionId: null,
  });

  return mapEffectState(persisted);
}

async function reconcileMouseAxesInvertStateInternal() {
  const row = await loadMouseAxesInvertStateRow();
  if (!row) {
    return;
  }

  const state = parsePersistedEffectState(row.state);
  const now = Date.now();

  if (state === "idle") {
    if (row.cooldownUntil && row.cooldownUntil.getTime() <= now) {
      await saveMouseAxesInvertState({
        userId: row.userId,
        requesterName: row.requesterName,
        agentId: row.agentId,
        state: "idle",
        startedAt: null,
        expiresAt: null,
        pausedAt: row.pausedAt,
        sessionId: row.sessionId,
        source: row.source ?? MOUSE_AXES_INVERT_SOURCE,
        agentState: "idle",
        cooldownUntil: null,
        lastConnectionId: row.lastConnectionId,
      });
    }
    return;
  }

  if (row.expiresAt && row.expiresAt.getTime() <= now) {
    try {
      const totalDurationMs = row.startedAt && row.expiresAt
        ? row.expiresAt.getTime() - row.startedAt.getTime()
        : 0;

      await stopMouseAxesInvertInternal(row, {
        applyCooldown: totalDurationMs >= MOUSE_AXES_INVERT_MAX_DURATION_MS,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      console.warn(`[MouseAxesInvert] Falha ao encerrar efeito expirado: ${message}.`);
    }
    return;
  }

  if (!row.agentId) {
    return;
  }

  const agent = findMouseAxesInvertAgent(row.agentId);
  if (!agent) {
    return;
  }

  if (agent.connectionId === row.lastConnectionId) {
    return;
  }

  const resumeAction = supportsAction(agent.capabilities, "mouse.axes.invert.resume")
    ? "mouse.axes.invert.resume"
    : "mouse.axes.invert.start";

  try {
    const resumeResult = await dispatchMouseAxesInvertAction({
      agentId: agent.agentId,
      action: resumeAction,
    });

    if (!resumeResult.ok) {
      if (resumeAction === "mouse.axes.invert.resume" && isMissingResumeSessionError(resumeResult.error)) {
        console.warn(
          `[MouseAxesInvert] Agent ${agent.agentId} nao possui sessao para resume; reenviando mouse.axes.invert.start.`,
        );

        const restartResult = await dispatchMouseAxesInvertAction({
          agentId: agent.agentId,
          action: "mouse.axes.invert.start",
        });

        if (!restartResult.ok) {
          console.warn(`[MouseAxesInvert] Falha ao ressincronizar efeito com agent=${agent.agentId}: ${restartResult.error.message}`);
          await saveMouseAxesInvertState({
            userId: row.userId,
            requesterName: row.requesterName,
            agentId: agent.agentId,
            state: parsePersistedEffectState(row.state),
            startedAt: row.startedAt,
            expiresAt: row.expiresAt,
            pausedAt: row.pausedAt,
            sessionId: row.sessionId,
            source: row.source ?? MOUSE_AXES_INVERT_SOURCE,
            agentState: parsePersistedEffectState(row.agentState),
            cooldownUntil: row.cooldownUntil,
            lastConnectionId: agent.connectionId,
          });
          return;
        }

        await saveMouseAxesInvertState({
          userId: row.userId,
          requesterName: row.requesterName,
          agentId: agent.agentId,
          state: parsePersistedEffectState(restartResult.payload.state),
          startedAt: row.startedAt ?? (restartResult.payload.startedAt ? new Date(restartResult.payload.startedAt) : null),
          expiresAt: row.expiresAt,
          pausedAt: restartResult.payload.pausedAt ? new Date(restartResult.payload.pausedAt) : row.pausedAt,
          sessionId: restartResult.payload.sessionId ?? row.sessionId,
          source: restartResult.payload.source ?? row.source ?? MOUSE_AXES_INVERT_SOURCE,
          agentState: restartResult.payload.state,
          cooldownUntil: row.cooldownUntil,
          lastConnectionId: agent.connectionId,
        });
        return;
      }

      console.warn(`[MouseAxesInvert] Falha ao ressincronizar efeito com agent=${agent.agentId}: ${resumeResult.error.message}`);
      await saveMouseAxesInvertState({
        userId: row.userId,
        requesterName: row.requesterName,
        agentId: agent.agentId,
        state: parsePersistedEffectState(row.state),
        startedAt: row.startedAt,
        expiresAt: row.expiresAt,
        pausedAt: row.pausedAt,
        sessionId: row.sessionId,
        source: row.source ?? MOUSE_AXES_INVERT_SOURCE,
        agentState: parsePersistedEffectState(row.agentState),
        cooldownUntil: row.cooldownUntil,
        lastConnectionId: agent.connectionId,
      });
      return;
    }

    await saveMouseAxesInvertState({
      userId: row.userId,
      requesterName: row.requesterName,
      agentId: agent.agentId,
      state: parsePersistedEffectState(resumeResult.payload.state),
      startedAt: row.startedAt ?? (resumeResult.payload.startedAt ? new Date(resumeResult.payload.startedAt) : null),
      expiresAt: row.expiresAt,
      pausedAt: resumeResult.payload.pausedAt ? new Date(resumeResult.payload.pausedAt) : row.pausedAt,
      sessionId: resumeResult.payload.sessionId ?? row.sessionId,
      source: resumeResult.payload.source ?? row.source ?? MOUSE_AXES_INVERT_SOURCE,
      agentState: resumeResult.payload.state,
      cooldownUntil: row.cooldownUntil,
      lastConnectionId: agent.connectionId,
    });
  } catch (error) {
    console.warn(
      `[MouseAxesInvert] Erro ao retomar efeito para agent=${agent.agentId}: ${error instanceof Error ? error.message : "unknown"}`,
    );
  }
}

async function ensureMouseAxesInvertReconcile() {
  if (!ensureMouseAxesInvertReconcilePromise) {
    ensureMouseAxesInvertReconcilePromise = reconcileMouseAxesInvertStateInternal()
      .finally(() => {
        ensureMouseAxesInvertReconcilePromise = null;
      });
  }

  await ensureMouseAxesInvertReconcilePromise;
}

export async function getMouseAxesInvertEffectState() {
  await ensureMouseAxesInvertReconcile();
  return mapEffectState(await loadMouseAxesInvertStateRow());
}

export async function requestMouseAxesInvertReward(input: {
  twitchId?: string;
  discordId?: string;
  requesterName?: string;
}): Promise<MouseAxesInvertRewardResult> {
  const user = await findRewardUser({
    twitchId: input.twitchId,
    discordId: input.discordId,
  });

  if (!user) {
    return {
      ok: false,
      code: "USER_NOT_FOUND",
      message: "Sua conta ainda nao foi encontrada no banco. Vincule a Twitch primeiro.",
    };
  }

  const currentState = await loadMouseAxesInvertStateRow();
  const rewardSetting = await getRewardSetting("mouseAxesInvert");
  if (!rewardSetting.enabled) {
    return {
      ok: false,
      code: "REWARD_DISABLED",
      user,
      message: "A inversao dos eixos X e Y do mouse esta desativada no momento.",
    };
  }

  if (currentState?.cooldownUntil && currentState.cooldownUntil.getTime() > Date.now()) {
    return {
      ok: false,
      code: "COOLDOWN_ACTIVE",
      user,
      message: `A inversao dos eixos do mouse entrou em espera ate ${new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(currentState.cooldownUntil)}.`,
    };
  }

  const hasActiveState = currentState && (currentState.state === "active" || currentState.state === "paused");
  if (hasActiveState && hasMouseAxesInvertReachedMaxDuration(currentState)) {
    return {
      ok: false,
      code: "COOLDOWN_ACTIVE",
      user,
      message: "A inversao dos eixos do mouse atingiu o tempo maximo. Aguarde o efeito acabar e o cooldown liberar um novo resgate.",
    };
  }

  if (!hasActiveState && !findMouseAxesInvertAgent(currentState?.agentId ?? null)) {
    return {
      ok: false,
      code: "AGENT_OFFLINE",
      user,
      message: "Nenhum Vulkan Agent com suporte a inversao dos eixos X e Y do mouse esta disponivel agora.",
    };
  }

  const chargedAmount = rewardSetting.cost;
  if (user.balance < chargedAmount) {
    return {
      ok: false,
      code: "INSUFFICIENT_BALANCE",
      chargedAmount,
      user,
      message: `Saldo insuficiente. Voce precisa de ${chargedAmount} Firecoins e tem ${user.balance}.`,
    };
  }

  let charged = false;

  try {
    const chargeResult = await prisma.user.updateMany({
      where: {
        id: user.id,
        balance: {
          gte: chargedAmount,
        },
      },
      data: {
        balance: { decrement: chargedAmount },
      },
    });

    if (chargeResult.count === 0) {
      throw new Error("INSUFFICIENT_BALANCE");
    }

    charged = true;

    const [updatedUser, effect] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: {
          balance: true,
        },
      }),
      activateOrExtendMouseAxesInvert({
        userId: user.id,
        requesterName: input.requesterName ?? null,
      }),
    ]);

    if (!updatedUser) {
      throw new Error("USER_NOT_FOUND_AFTER_CHARGE");
    }

    await announceMouseAxesInvertRedeem(input.requesterName ?? null);

    return {
      ok: true,
      user,
      chargedAmount,
      balanceAfter: updatedUser.balance,
      effect,
    };
  } catch (error) {
    if (charged) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          balance: { increment: chargedAmount },
        },
      }).catch((refundError) => {
        console.error("[MouseAxesInvert] Falha ao estornar Firecoins:", refundError);
      });
    }

    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
      return {
        ok: false,
        code: "INSUFFICIENT_BALANCE",
        chargedAmount,
        user,
        message: `Saldo insuficiente. Voce precisa de ${chargedAmount} Firecoins.`,
      };
    }

    if (error instanceof Error && error.message === "AGENT_OFFLINE") {
      return {
        ok: false,
        code: "AGENT_OFFLINE",
        chargedAmount,
        user,
        message: "Nenhum Vulkan Agent com suporte a inversao dos eixos X e Y do mouse esta disponivel agora.",
      };
    }

    console.error("[MouseAxesInvert] Falha ao processar resgate:", error);
    return {
      ok: false,
      code: "AGENT_ERROR",
      chargedAmount,
      user,
      message: "Falha ao iniciar a inversao dos eixos X e Y do mouse. Se houve cobranca parcial, o sistema tentou estornar automaticamente.",
    };
  }
}

export function initializeMouseAxesInvertRewardController() {
  if (mouseAxesInvertControllerInterval) {
    return;
  }

  void ensureMouseAxesInvertStateTable().catch((error) => {
    console.error("[MouseAxesInvert] Falha ao preparar persistencia:", error);
  });

  mouseAxesInvertControllerInterval = setInterval(() => {
    if (mouseAxesInvertControllerInFlight) {
      return;
    }

    mouseAxesInvertControllerInFlight = true;
    void ensureMouseAxesInvertReconcile()
      .catch((error) => {
        console.error("[MouseAxesInvert] Erro no controlador do efeito:", error);
      })
      .finally(() => {
        mouseAxesInvertControllerInFlight = false;
      });
  }, MOUSE_AXES_INVERT_POLL_MS);

  void ensureMouseAxesInvertReconcile().catch((error) => {
    console.error("[MouseAxesInvert] Falha na reconciliacao inicial:", error);
  });

  void getMouseAxesInvertEffectState()
    .then((effect) => {
      syncMouseAxesInvertOverlay(effect);
    })
    .catch((error) => {
      console.error("[MouseAxesInvert] Falha ao sincronizar overlay da inversao dos eixos do mouse:", error);
    });
}

export async function shutdownMouseAxesInvertRewardController() {
  if (mouseAxesInvertControllerInterval) {
    clearInterval(mouseAxesInvertControllerInterval);
    mouseAxesInvertControllerInterval = null;
  }
}
