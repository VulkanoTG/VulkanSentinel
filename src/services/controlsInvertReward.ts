import { prisma } from "#database";
import { dispatchAgentJob, getConnectedAgentsSnapshot, isAgentConnected } from "./agentHub.js";
import { publishRewardOverlayMessage } from "./chatOverlay.js";
import { publishControlsInvertOverlayState } from "./controlsInvertOverlay.js";
import { getRewardSetting } from "./rewardSettings.js";
import { sendSystemChatMessage } from "./twitchChat.js";

const CONTROLS_INVERT_DURATION_MS = 5 * 60 * 1000;
const CONTROLS_INVERT_MAX_DURATION_MS = 20 * 60 * 1000;
const CONTROLS_INVERT_COOLDOWN_MS = 10 * 60 * 1000;
const CONTROLS_INVERT_POLL_MS = 5_000;
const CONTROLS_INVERT_EFFECT_KEY = "controls.invert";
const CONTROLS_INVERT_SOURCE = "sentinel";

type RewardUser = {
  id: number;
  discordId: string;
  twitchId: string | null;
  balance: number;
};

type PersistedEffectState = "idle" | "active" | "paused";

type ControlsInvertStateRow = {
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

export type ControlsInvertEffectState = {
  effectKey: typeof CONTROLS_INVERT_EFFECT_KEY;
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

type ControlsInvertAgentPayload = {
  accepted: boolean;
  mode?: unknown;
  state: PersistedEffectState;
  sessionId: string | null;
  source: string | null;
  startedAt: string | null;
  pausedAt: string | null;
  receivedAt: string | null;
};

type ControlsInvertRewardResult =
  | {
      ok: true;
      user: RewardUser;
      chargedAmount: number;
      balanceAfter: number;
      effect: ControlsInvertEffectState;
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

let ensureControlsInvertStateTablePromise: Promise<void> | null = null;
let controlsInvertControllerInterval: NodeJS.Timeout | null = null;
let controlsInvertControllerInFlight = false;
let ensureControlsInvertReconcilePromise: Promise<void> | null = null;

function parsePersistedEffectState(value: string | null | undefined): PersistedEffectState {
  if (value === "active" || value === "paused" || value === "idle") {
    return value;
  }

  return "idle";
}

function hasControlsInvertReachedMaxDuration(row: ControlsInvertStateRow | null) {
  if (!row?.startedAt || !row.expiresAt) {
    return false;
  }

  return row.expiresAt.getTime() >= row.startedAt.getTime() + CONTROLS_INVERT_MAX_DURATION_MS;
}

function mapEffectState(row: ControlsInvertStateRow | null): ControlsInvertEffectState {
  return {
    effectKey: CONTROLS_INVERT_EFFECT_KEY,
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

function syncControlsInvertOverlay(effect: ControlsInvertEffectState) {
  publishControlsInvertOverlayState({
    active: effect.state === "active" || effect.state === "paused",
    requesterName: effect.requesterName,
    startedAt: effect.startedAt,
    expiresAt: effect.expiresAt,
  });
}

async function ensureControlsInvertStateTable() {
  if (!ensureControlsInvertStateTablePromise) {
    ensureControlsInvertStateTablePromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ControlsInvertState" (
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
        ALTER TABLE "ControlsInvertState"
        ADD COLUMN IF NOT EXISTS "userId" INTEGER NULL
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ControlsInvertState"
        ADD COLUMN IF NOT EXISTS "requesterName" TEXT NULL
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ControlsInvertState"
        ADD COLUMN IF NOT EXISTS "agentId" TEXT NULL
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ControlsInvertState"
        ADD COLUMN IF NOT EXISTS "state" TEXT NOT NULL DEFAULT 'idle'
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ControlsInvertState"
        ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3) NULL
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ControlsInvertState"
        ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3) NULL
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ControlsInvertState"
        ADD COLUMN IF NOT EXISTS "pausedAt" TIMESTAMP(3) NULL
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ControlsInvertState"
        ADD COLUMN IF NOT EXISTS "sessionId" TEXT NULL
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ControlsInvertState"
        ADD COLUMN IF NOT EXISTS "source" TEXT NULL
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ControlsInvertState"
        ADD COLUMN IF NOT EXISTS "agentState" TEXT NOT NULL DEFAULT 'idle'
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ControlsInvertState"
        ADD COLUMN IF NOT EXISTS "cooldownUntil" TIMESTAMP(3) NULL
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ControlsInvertState"
        ADD COLUMN IF NOT EXISTS "lastConnectionId" TEXT NULL
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ControlsInvertState"
        ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ControlsInvertState"
        ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      `);

      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION update_controls_invert_state_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW."updatedAt" = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql'
      `);

      await prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS "ControlsInvertState_set_updatedAt" ON "ControlsInvertState"
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER "ControlsInvertState_set_updatedAt"
        BEFORE UPDATE ON "ControlsInvertState"
        FOR EACH ROW
        EXECUTE FUNCTION update_controls_invert_state_updated_at()
      `);

      await prisma.$queryRaw`
        INSERT INTO "ControlsInvertState" (
          "effectKey",
          "state",
          "agentState",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${CONTROLS_INVERT_EFFECT_KEY},
          'idle',
          'idle',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT ("effectKey") DO NOTHING
      `;
    })().catch((error) => {
      ensureControlsInvertStateTablePromise = null;
      throw error;
    });
  }

  await ensureControlsInvertStateTablePromise;
}

async function loadControlsInvertStateRow() {
  await ensureControlsInvertStateTable();

  const rows = await prisma.$queryRaw<ControlsInvertStateRow[]>`
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
    FROM "ControlsInvertState"
    WHERE "effectKey" = ${CONTROLS_INVERT_EFFECT_KEY}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

async function saveControlsInvertState(input: {
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
  await ensureControlsInvertStateTable();

  const rows = await prisma.$queryRaw<ControlsInvertStateRow[]>`
    INSERT INTO "ControlsInvertState" (
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
      ${CONTROLS_INVERT_EFFECT_KEY},
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

  const row = rows[0] ?? null;
  syncControlsInvertOverlay(mapEffectState(row));
  return row;
}

function supportsAction(actions: Array<{ actions: string[] }>, action: string) {
  return actions.some((entry) => Array.isArray(entry.actions) && entry.actions.includes(action));
}

function findInvertAgent(preferredAgentId?: string | null) {
  const readyAgents = getConnectedAgentsSnapshot().filter((agent) => agent.isReady);

  if (preferredAgentId) {
    const preferred = readyAgents.find((agent) =>
      agent.agentId === preferredAgentId &&
      supportsAction(agent.capabilities, "controls.invert.start")
    );

    if (preferred) {
      return preferred;
    }
  }

  return readyAgents.find((agent) => supportsAction(agent.capabilities, "controls.invert.start")) ?? null;
}

function normalizeIsoDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseAgentPayload(payload: unknown): ControlsInvertAgentPayload {
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
    message.includes("CANNOT RESUME CONTROL INVERSION")
  );
}

function logAgentEffectResponse(action: string, agentId: string, payload: ControlsInvertAgentPayload) {
  console.log(
    `[ControlsInvert] Resposta do Agent action=${action} agent=${agentId} state=${payload.state} sessionId=${payload.sessionId ?? "null"} startedAt=${payload.startedAt ?? "null"} pausedAt=${payload.pausedAt ?? "null"}`,
  );
}

async function dispatchControlsInvertAction(input: {
  agentId: string;
  action: "controls.invert.start" | "controls.invert.stop" | "controls.invert.resume";
}) {
  console.log(`[ControlsInvert] Enviando ${input.action} para agent=${input.agentId}.`);

  const result = await dispatchAgentJob({
    agentId: input.agentId,
    action: input.action,
    payload: {
      source: CONTROLS_INVERT_SOURCE,
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

async function activateOrExtendControlsInvert(input: {
  userId: number;
  requesterName?: string | null;
}) {
  const current = await loadControlsInvertStateRow();
  const now = new Date();

  if (current && (current.state === "active" || current.state === "paused") && current.agentId) {
    const startedAt = current.startedAt ?? now;
    const maxExpiresAt = startedAt.getTime() + CONTROLS_INVERT_MAX_DURATION_MS;
    const extensionBaseMs = current.expiresAt && current.expiresAt.getTime() > now.getTime()
      ? current.expiresAt.getTime()
      : now.getTime();
    const nextExpiresAt = new Date(
      Math.min(extensionBaseMs + CONTROLS_INVERT_DURATION_MS, maxExpiresAt),
    );

    const updated = await saveControlsInvertState({
      userId: input.userId,
      requesterName: input.requesterName ?? current.requesterName,
      agentId: current.agentId,
      state: current.state === "paused" ? "paused" : "active",
      startedAt,
      expiresAt: nextExpiresAt,
      pausedAt: current.pausedAt,
      sessionId: current.sessionId,
      source: current.source ?? CONTROLS_INVERT_SOURCE,
      agentState: parsePersistedEffectState(current.agentState),
      cooldownUntil: null,
      lastConnectionId: current.lastConnectionId,
    });

    return mapEffectState(updated);
  }

  const agent = findInvertAgent(current?.agentId ?? null);
  if (!agent) {
    throw new Error("AGENT_OFFLINE");
  }

  const startResult = await dispatchControlsInvertAction({
    agentId: agent.agentId,
    action: "controls.invert.start",
  });

  if (!startResult.ok) {
    throw new Error(startResult.error.code || "AGENT_ERROR");
  }

  const startedAt = startResult.payload.startedAt ? new Date(startResult.payload.startedAt) : now;
  const nextExpiresAt = new Date(
    startedAt.getTime() + Math.min(CONTROLS_INVERT_DURATION_MS, CONTROLS_INVERT_MAX_DURATION_MS),
  );

  const persisted = await saveControlsInvertState({
    userId: input.userId,
    requesterName: input.requesterName ?? null,
    agentId: agent.agentId,
    state: startResult.payload.state === "paused" ? "paused" : "active",
    startedAt,
    expiresAt: nextExpiresAt,
    pausedAt: startResult.payload.pausedAt ? new Date(startResult.payload.pausedAt) : null,
    sessionId: startResult.payload.sessionId,
    source: startResult.payload.source ?? CONTROLS_INVERT_SOURCE,
    agentState: startResult.payload.state,
    cooldownUntil: null,
    lastConnectionId: agent.connectionId,
  });

  return mapEffectState(persisted);
}

async function announceControlsInvertRedeem(requesterName?: string | null) {
  if (!requesterName?.trim()) {
    return;
  }

  const announcement = `${requesterName} resgatou Controle maluco!`;

  publishRewardOverlayMessage({
    username: "Vulkan Sentinel",
    message: announcement,
    icon: "CTL",
  });

  await sendSystemChatMessage(announcement).catch((error) => {
    console.error("[ControlsInvert] Falha ao avisar resgate no chat da Twitch:", error);
  });
}

async function stopControlsInvertInternal(row: ControlsInvertStateRow, options?: { applyCooldown?: boolean }) {
  const cooldownUntil = options?.applyCooldown
    ? new Date(Date.now() + CONTROLS_INVERT_COOLDOWN_MS)
    : row.cooldownUntil;

  const clearPersistedState = async (agentId: string | null, lastConnectionId: string | null) => {
    const cleared = await saveControlsInvertState({
      userId: row.userId,
      requesterName: row.requesterName,
      agentId,
      state: "idle",
      startedAt: null,
      expiresAt: null,
      pausedAt: null,
      sessionId: null,
      source: row.source ?? CONTROLS_INVERT_SOURCE,
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

  const stopResult = await dispatchControlsInvertAction({
    agentId: row.agentId,
    action: "controls.invert.stop",
  });

  if (!stopResult.ok) {
    const errorCode = stopResult.error.code.toUpperCase();
    const errorMessage = stopResult.error.message.toUpperCase();
    if (errorCode.includes("IDLE") || errorMessage.includes("IDLE")) {
      return clearPersistedState(row.agentId, null);
    }

    throw new Error(stopResult.error.code || "AGENT_ERROR");
  }

  const persisted = await saveControlsInvertState({
    userId: row.userId,
    requesterName: row.requesterName,
    agentId: row.agentId,
    state: "idle",
    startedAt: null,
    expiresAt: null,
    pausedAt: stopResult.payload.pausedAt ? new Date(stopResult.payload.pausedAt) : null,
    sessionId: stopResult.payload.sessionId,
    source: stopResult.payload.source ?? row.source ?? CONTROLS_INVERT_SOURCE,
    agentState: stopResult.payload.state,
    cooldownUntil,
    lastConnectionId: null,
  });

  return mapEffectState(persisted);
}

async function reconcileControlsInvertStateInternal() {
  const row = await loadControlsInvertStateRow();
  if (!row) {
    return;
  }

  const state = parsePersistedEffectState(row.state);
  const now = Date.now();

  if (state === "idle") {
    if (row.cooldownUntil && row.cooldownUntil.getTime() <= now) {
      await saveControlsInvertState({
        userId: row.userId,
        requesterName: row.requesterName,
        agentId: row.agentId,
        state: "idle",
        startedAt: null,
        expiresAt: null,
        pausedAt: row.pausedAt,
        sessionId: row.sessionId,
        source: row.source ?? CONTROLS_INVERT_SOURCE,
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

      await stopControlsInvertInternal(row, {
        applyCooldown: totalDurationMs >= CONTROLS_INVERT_MAX_DURATION_MS,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      console.warn(`[ControlsInvert] Falha ao encerrar efeito expirado: ${message}.`);
    }
    return;
  }

  if (!row.agentId) {
    return;
  }

  const agent = findInvertAgent(row.agentId);
  if (!agent) {
    return;
  }

  if (agent.connectionId === row.lastConnectionId) {
    return;
  }

  const resumeAction = supportsAction(agent.capabilities, "controls.invert.resume")
    ? "controls.invert.resume"
    : "controls.invert.start";

  try {
    const resumeResult = await dispatchControlsInvertAction({
      agentId: agent.agentId,
      action: resumeAction,
    });

    if (!resumeResult.ok) {
      if (resumeAction === "controls.invert.resume" && isMissingResumeSessionError(resumeResult.error)) {
        console.warn(
          `[ControlsInvert] Agent ${agent.agentId} nao possui sessao para resume; reenviando controls.invert.start.`,
        );

        const restartResult = await dispatchControlsInvertAction({
          agentId: agent.agentId,
          action: "controls.invert.start",
        });

        if (!restartResult.ok) {
          console.warn(`[ControlsInvert] Falha ao ressincronizar efeito com agent=${agent.agentId}: ${restartResult.error.message}`);
          await saveControlsInvertState({
            userId: row.userId,
            requesterName: row.requesterName,
            agentId: agent.agentId,
            state: parsePersistedEffectState(row.state),
            startedAt: row.startedAt,
            expiresAt: row.expiresAt,
            pausedAt: row.pausedAt,
            sessionId: row.sessionId,
            source: row.source ?? CONTROLS_INVERT_SOURCE,
            agentState: parsePersistedEffectState(row.agentState),
            cooldownUntil: row.cooldownUntil,
            lastConnectionId: agent.connectionId,
          });
          return;
        }

        await saveControlsInvertState({
          userId: row.userId,
          requesterName: row.requesterName,
          agentId: agent.agentId,
          state: parsePersistedEffectState(restartResult.payload.state),
          startedAt: row.startedAt ?? (restartResult.payload.startedAt ? new Date(restartResult.payload.startedAt) : null),
          expiresAt: row.expiresAt,
          pausedAt: restartResult.payload.pausedAt ? new Date(restartResult.payload.pausedAt) : row.pausedAt,
          sessionId: restartResult.payload.sessionId ?? row.sessionId,
          source: restartResult.payload.source ?? row.source ?? CONTROLS_INVERT_SOURCE,
          agentState: restartResult.payload.state,
          cooldownUntil: row.cooldownUntil,
          lastConnectionId: agent.connectionId,
        });
        return;
      }

      console.warn(`[ControlsInvert] Falha ao ressincronizar efeito com agent=${agent.agentId}: ${resumeResult.error.message}`);
      await saveControlsInvertState({
        userId: row.userId,
        requesterName: row.requesterName,
        agentId: agent.agentId,
        state: parsePersistedEffectState(row.state),
        startedAt: row.startedAt,
        expiresAt: row.expiresAt,
        pausedAt: row.pausedAt,
        sessionId: row.sessionId,
        source: row.source ?? CONTROLS_INVERT_SOURCE,
        agentState: parsePersistedEffectState(row.agentState),
        cooldownUntil: row.cooldownUntil,
        lastConnectionId: agent.connectionId,
      });
      return;
    }

    await saveControlsInvertState({
      userId: row.userId,
      requesterName: row.requesterName,
      agentId: agent.agentId,
      state: parsePersistedEffectState(resumeResult.payload.state),
      startedAt: row.startedAt ?? (resumeResult.payload.startedAt ? new Date(resumeResult.payload.startedAt) : null),
      expiresAt: row.expiresAt,
      pausedAt: resumeResult.payload.pausedAt ? new Date(resumeResult.payload.pausedAt) : row.pausedAt,
      sessionId: resumeResult.payload.sessionId ?? row.sessionId,
      source: resumeResult.payload.source ?? row.source ?? CONTROLS_INVERT_SOURCE,
      agentState: resumeResult.payload.state,
      cooldownUntil: row.cooldownUntil,
      lastConnectionId: agent.connectionId,
    });
  } catch (error) {
    console.warn(
      `[ControlsInvert] Erro ao retomar efeito para agent=${agent.agentId}: ${error instanceof Error ? error.message : "unknown"}`,
    );
  }
}

async function ensureControlsInvertReconcile() {
  if (!ensureControlsInvertReconcilePromise) {
    ensureControlsInvertReconcilePromise = reconcileControlsInvertStateInternal()
      .finally(() => {
        ensureControlsInvertReconcilePromise = null;
      });
  }

  await ensureControlsInvertReconcilePromise;
}

export async function getControlsInvertEffectState() {
  await ensureControlsInvertReconcile();
  return mapEffectState(await loadControlsInvertStateRow());
}

export async function requestControlsInvertReward(input: {
  twitchId?: string;
  discordId?: string;
  requesterName?: string;
}): Promise<ControlsInvertRewardResult> {
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

  const currentState = await loadControlsInvertStateRow();
  const rewardSetting = await getRewardSetting("chaos");
  if (!rewardSetting.enabled) {
    return {
      ok: false,
      code: "REWARD_DISABLED",
      user,
      message: "A inversao de controles esta desativada no momento.",
    };
  }

  if (currentState?.cooldownUntil && currentState.cooldownUntil.getTime() > Date.now()) {
    return {
      ok: false,
      code: "COOLDOWN_ACTIVE",
      user,
      message: `A aleatorizacao de controles entrou em espera ate ${new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(currentState.cooldownUntil)}.`,
    };
  }

  const hasActiveState = currentState && (currentState.state === "active" || currentState.state === "paused");
  if (hasActiveState && hasControlsInvertReachedMaxDuration(currentState)) {
    return {
      ok: false,
      code: "COOLDOWN_ACTIVE",
      user,
      message: "A inversao de controles atingiu o tempo maximo. Aguarde o efeito acabar e o cooldown liberar um novo resgate.",
    };
  }

  if (!hasActiveState && !findInvertAgent(currentState?.agentId ?? null)) {
    return {
      ok: false,
      code: "AGENT_OFFLINE",
      user,
      message: "Nenhum Vulkan Agent com suporte a inversao de controles esta disponivel agora.",
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
      activateOrExtendControlsInvert({
        userId: user.id,
        requesterName: input.requesterName ?? null,
      }),
    ]);

    if (!updatedUser) {
      throw new Error("USER_NOT_FOUND_AFTER_CHARGE");
    }

    await announceControlsInvertRedeem(input.requesterName ?? null);

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
        console.error("[ControlsInvert] Falha ao estornar Firecoins:", refundError);
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
        message: "Nenhum Vulkan Agent com suporte a inversao de controles esta disponivel agora.",
      };
    }

    console.error("[ControlsInvert] Falha ao processar resgate:", error);
    return {
      ok: false,
      code: "AGENT_ERROR",
      chargedAmount,
      user,
      message: "Falha ao iniciar a inversao de controles. Se houve cobranca parcial, o sistema tentou estornar automaticamente.",
    };
  }
}

export function initializeControlsInvertRewardController() {
  if (controlsInvertControllerInterval) {
    return;
  }

  void ensureControlsInvertStateTable().catch((error) => {
    console.error("[ControlsInvert] Falha ao preparar persistencia:", error);
  });

  controlsInvertControllerInterval = setInterval(() => {
    if (controlsInvertControllerInFlight) {
      return;
    }

    controlsInvertControllerInFlight = true;
    void ensureControlsInvertReconcile()
      .catch((error) => {
        console.error("[ControlsInvert] Erro no controlador do efeito:", error);
      })
      .finally(() => {
        controlsInvertControllerInFlight = false;
      });
  }, CONTROLS_INVERT_POLL_MS);

  void ensureControlsInvertReconcile().catch((error) => {
    console.error("[ControlsInvert] Falha na reconciliacao inicial:", error);
  });

  void getControlsInvertEffectState()
    .then((effect) => {
      syncControlsInvertOverlay(effect);
    })
    .catch((error) => {
      console.error("[ControlsInvert] Falha ao sincronizar overlay da inversao de controles:", error);
    });
}

export async function shutdownControlsInvertRewardController() {
  if (controlsInvertControllerInterval) {
    clearInterval(controlsInvertControllerInterval);
    controlsInvertControllerInterval = null;
  }
}
