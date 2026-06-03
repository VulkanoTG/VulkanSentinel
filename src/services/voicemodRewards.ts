import { env } from "#config";
import { prisma } from "#database";
import { dispatchAgentJob, isAgentConnected } from "./agentHub.js";
import {
  findVoicemodRedeemByTechnicalId,
  findVoicemodSoundAlertRedeemByTechnicalId,
  listVoicemodRedeems,
  listVoicemodSoundAlertRedeems,
} from "./agentRedeems.js";
import { publishRewardOverlayMessage } from "./chatOverlay.js";
import { getRewardSetting } from "./rewardSettings.js";
import { sendSystemChatMessage } from "./twitchChat.js";

const VOICEMOD_REWARD_DURATION_MS = 5 * 60 * 1000;
const VOICEMOD_REWARD_POLL_MS = 15_000;
const VOICEMOD_SOUND_ALERT_QUEUE_GAP_MS = 1_500;

type RewardUser = {
  id: number;
  discordId: string;
  twitchId: string | null;
  balance: number;
};

type VoicemodQueueStatus = "PENDING" | "ACTIVE" | "PAUSED" | "COMPLETED";
type VoicemodSoundAlertQueueStatus = "PENDING" | "ACTIVE" | "COMPLETED";

type VoicemodQueueRow = {
  id: number;
  userId: number;
  agentId: string;
  voiceId: string;
  technicalId: string;
  displayName: string;
  requesterName: string | null;
  status: VoicemodQueueStatus;
  startedAt: Date | null;
  expiresAt: Date | null;
  completedAt: Date | null;
  remainingMs: number | null;
  createdAt: Date;
  updatedAt: Date;
};

type VoicemodSoundAlertQueueRow = {
  id: number;
  userId: number;
  agentId: string;
  soundId: string;
  technicalId: string;
  displayName: string;
  requesterName: string | null;
  status: VoicemodSoundAlertQueueStatus;
  startedAt: Date | null;
  releaseAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ActiveVoicemodRewardState = {
  queueId: number;
  userId: number;
  agentId: string;
  voiceId: string;
  technicalId: string;
  displayName: string;
  startedAt: string;
  expiresAt: string;
  remainingMs: number;
};

export type VoicemodQueueItem = {
  queueId: number;
  userId: number;
  technicalId: string;
  displayName: string;
  createdAt: string;
  position: number;
};

type VoicemodRewardResult =
  | {
      ok: true;
      user: RewardUser;
      chargedAmount: number;
      balanceAfter: number;
      redeem: {
        id: string;
        title: string;
        voiceId: string;
        startedAt: string | null;
        expiresAt: string | null;
        status: "active" | "queued";
        queuePosition: number;
      };
    }
  | {
      ok: false;
      code:
        | "USER_NOT_FOUND"
        | "REWARD_NOT_FOUND"
        | "REWARD_DISABLED"
        | "AGENT_OFFLINE"
        | "INSUFFICIENT_BALANCE"
        | "AGENT_ERROR";
      chargedAmount?: number;
      user?: RewardUser;
      message: string;
    };

type VoicemodSoundAlertTestResult =
  | {
      ok: true;
      soundAlert: {
        id: string;
        title: string;
        soundId: string;
        soundboardId: string | null;
        soundboardName: string | null;
      };
    }
  | {
      ok: false;
      code: "REWARD_NOT_FOUND" | "AGENT_OFFLINE" | "AGENT_ERROR";
      message: string;
    };

type VoicemodSoundAlertRewardResult =
  | {
      ok: true;
      user: RewardUser;
      chargedAmount: number;
      balanceAfter: number;
      soundAlert: {
        id: string;
        title: string;
        soundId: string;
        soundboardId: string | null;
        soundboardName: string | null;
        startedAt: string | null;
        status: "active" | "queued";
        queuePosition: number;
      };
    }
  | {
      ok: false;
      code: "USER_NOT_FOUND" | "REWARD_NOT_FOUND" | "REWARD_DISABLED" | "AGENT_OFFLINE" | "INSUFFICIENT_BALANCE" | "AGENT_ERROR";
      chargedAmount?: number;
      user?: RewardUser;
      message: string;
    };

let voicemodRewardControllerInterval: NodeJS.Timeout | null = null;
let voicemodRewardControllerInFlight = false;
let ensureVoicemodQueueProgressPromise: Promise<void> | null = null;
let ensureVoicemodSoundAlertQueueProgressPromise: Promise<void> | null = null;
let voicemodSoundAlertQueueTimer: NodeJS.Timeout | null = null;

let nextQueueId = 1;
let activeRewardRow: VoicemodQueueRow | null = null;
let pausedRewardRow: VoicemodQueueRow | null = null;
const pendingRewardRows: VoicemodQueueRow[] = [];
let nextSoundAlertQueueId = 1;
let activeSoundAlertRow: VoicemodSoundAlertQueueRow | null = null;
const pendingSoundAlertRows: VoicemodSoundAlertQueueRow[] = [];

function cloneQueueRow(row: VoicemodQueueRow | null) {
  if (!row) {
    return null;
  }

  return {
    ...row,
    startedAt: row.startedAt ? new Date(row.startedAt) : null,
    expiresAt: row.expiresAt ? new Date(row.expiresAt) : null,
    completedAt: row.completedAt ? new Date(row.completedAt) : null,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function updateQueueRow(row: VoicemodQueueRow, patch: Partial<VoicemodQueueRow>) {
  Object.assign(row, patch, { updatedAt: new Date() });
  return row;
}

function cloneSoundAlertQueueRow(row: VoicemodSoundAlertQueueRow | null) {
  if (!row) {
    return null;
  }

  return {
    ...row,
    startedAt: row.startedAt ? new Date(row.startedAt) : null,
    releaseAt: row.releaseAt ? new Date(row.releaseAt) : null,
    completedAt: row.completedAt ? new Date(row.completedAt) : null,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function updateSoundAlertQueueRow(row: VoicemodSoundAlertQueueRow, patch: Partial<VoicemodSoundAlertQueueRow>) {
  Object.assign(row, patch, { updatedAt: new Date() });
  return row;
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

function mapActiveReward(row: VoicemodQueueRow): ActiveVoicemodRewardState | null {
  if (!row.startedAt || !row.expiresAt) {
    return null;
  }

  return {
    queueId: row.id,
    userId: row.userId,
    agentId: row.agentId,
    voiceId: row.voiceId,
    technicalId: row.technicalId,
    displayName: row.displayName,
    startedAt: row.startedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    remainingMs: Math.max(0, row.expiresAt.getTime() - Date.now()),
  };
}

function mapQueueItem(row: VoicemodQueueRow, position: number): VoicemodQueueItem {
  return {
    queueId: row.id,
    userId: row.userId,
    technicalId: row.technicalId,
    displayName: row.displayName,
    createdAt: row.createdAt.toISOString(),
    position,
  };
}

async function loadActiveVoicemodQueueRow() {
  return cloneQueueRow(activeRewardRow);
}

async function loadPausedVoicemodQueueRow() {
  return cloneQueueRow(pausedRewardRow);
}

async function loadPendingVoicemodQueueRows() {
  return pendingRewardRows.map((row) => cloneQueueRow(row)).filter((row): row is VoicemodQueueRow => Boolean(row));
}

async function loadQueueRowById(queueId: number) {
  if (activeRewardRow?.id === queueId) {
    return cloneQueueRow(activeRewardRow);
  }

  if (pausedRewardRow?.id === queueId) {
    return cloneQueueRow(pausedRewardRow);
  }

  const pendingRow = pendingRewardRows.find((row) => row.id === queueId) ?? null;
  return cloneQueueRow(pendingRow);
}

async function loadPendingVoicemodSoundAlertQueueRows() {
  return pendingSoundAlertRows
    .map((row) => cloneSoundAlertQueueRow(row))
    .filter((row): row is VoicemodSoundAlertQueueRow => Boolean(row));
}

async function loadVoicemodSoundAlertQueueRowById(queueId: number) {
  if (activeSoundAlertRow?.id === queueId) {
    return cloneSoundAlertQueueRow(activeSoundAlertRow);
  }

  const pendingRow = pendingSoundAlertRows.find((row) => row.id === queueId) ?? null;
  return cloneSoundAlertQueueRow(pendingRow);
}

async function markQueueRowCompleted(queueId: number) {
  const completedAt = new Date();

  if (activeRewardRow?.id === queueId) {
    updateQueueRow(activeRewardRow, {
      status: "COMPLETED",
      completedAt,
      remainingMs: null,
      expiresAt: activeRewardRow.expiresAt,
    });
    activeRewardRow = null;
    return;
  }

  if (pausedRewardRow?.id === queueId) {
    updateQueueRow(pausedRewardRow, {
      status: "COMPLETED",
      completedAt,
      remainingMs: pausedRewardRow.remainingMs,
      expiresAt: null,
    });
    pausedRewardRow = null;
    return;
  }

  const pendingIndex = pendingRewardRows.findIndex((row) => row.id === queueId);
  if (pendingIndex >= 0) {
    const [row] = pendingRewardRows.splice(pendingIndex, 1);
    updateQueueRow(row, {
      status: "COMPLETED",
      completedAt,
      remainingMs: null,
      expiresAt: null,
    });
  }
}

async function markVoicemodSoundAlertQueueRowCompleted(queueId: number) {
  const completedAt = new Date();

  if (activeSoundAlertRow?.id === queueId) {
    updateSoundAlertQueueRow(activeSoundAlertRow, {
      status: "COMPLETED",
      completedAt,
      releaseAt: activeSoundAlertRow.releaseAt,
    });
    activeSoundAlertRow = null;
    return;
  }

  const pendingIndex = pendingSoundAlertRows.findIndex((row) => row.id === queueId);
  if (pendingIndex >= 0) {
    const [row] = pendingSoundAlertRows.splice(pendingIndex, 1);
    updateSoundAlertQueueRow(row, {
      status: "COMPLETED",
      completedAt,
      releaseAt: null,
    });
  }
}

async function enqueueVoicemodReward(input: {
  userId: number;
  agentId: string;
  voiceId: string;
  technicalId: string;
  displayName: string;
  requesterName?: string | null;
}) {
  const now = new Date();
  const row: VoicemodQueueRow = {
    id: nextQueueId++,
    userId: input.userId,
    agentId: input.agentId,
    voiceId: input.voiceId,
    technicalId: input.technicalId,
    displayName: input.displayName,
    requesterName: input.requesterName ?? null,
    status: "PENDING",
    startedAt: null,
    expiresAt: null,
    completedAt: null,
    remainingMs: null,
    createdAt: now,
    updatedAt: now,
  };

  pendingRewardRows.push(row);
  return cloneQueueRow(row) as VoicemodQueueRow;
}

async function enqueueVoicemodSoundAlertReward(input: {
  userId: number;
  agentId: string;
  soundId: string;
  technicalId: string;
  displayName: string;
  requesterName?: string | null;
}) {
  const now = new Date();
  const row: VoicemodSoundAlertQueueRow = {
    id: nextSoundAlertQueueId++,
    userId: input.userId,
    agentId: input.agentId,
    soundId: input.soundId,
    technicalId: input.technicalId,
    displayName: input.displayName,
    requesterName: input.requesterName ?? null,
    status: "PENDING",
    startedAt: null,
    releaseAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  pendingSoundAlertRows.push(row);
  return cloneSoundAlertQueueRow(row) as VoicemodSoundAlertQueueRow;
}

async function activateQueueRow(row: VoicemodQueueRow) {
  if (!isAgentConnected(row.agentId)) {
    return false;
  }

  const result = await dispatchAgentJob({
    agentId: row.agentId,
    action: "voicemod.loadVoice",
    payload: {
      voiceId: row.voiceId,
    },
    timeoutMs: 30_000,
  });

  if (!result.result.ok) {
    console.error("[VoicemodReward] Falha ao ativar item da fila:", result.result.error);
    return false;
  }

  const pendingIndex = pendingRewardRows.findIndex((item) => item.id === row.id);
  const targetRow = pendingIndex >= 0 ? pendingRewardRows.splice(pendingIndex, 1)[0] : row;
  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + VOICEMOD_REWARD_DURATION_MS);

  updateQueueRow(targetRow, {
    status: "ACTIVE",
    startedAt,
    expiresAt,
    completedAt: null,
    remainingMs: null,
  });
  activeRewardRow = targetRow;

  if (targetRow.requesterName) {
    const announcement = `${targetRow.requesterName} resgatou a voz ${targetRow.displayName}`;

    await sendSystemChatMessage(announcement).catch((error) => {
      console.error("[VoicemodReward] Falha ao avisar ativacao no chat da Twitch:", error);
    });
  }

  return true;
}

async function activateVoicemodSoundAlertQueueRow(row: VoicemodSoundAlertQueueRow) {
  if (!isAgentConnected(row.agentId)) {
    return false;
  }

  const result = await dispatchAgentJob({
    agentId: row.agentId,
    action: "voicemod.playSound",
    payload: {
      soundId: row.soundId,
    },
    timeoutMs: 30_000,
  });

  if (!result.result.ok) {
    console.error("[VoicemodReward] Falha ao ativar sound alert da fila:", result.result.error);
    return false;
  }

  const pendingIndex = pendingSoundAlertRows.findIndex((item) => item.id === row.id);
  const targetRow = pendingIndex >= 0 ? pendingSoundAlertRows.splice(pendingIndex, 1)[0] : row;
  const startedAt = new Date();
  const releaseAt = new Date(startedAt.getTime() + VOICEMOD_SOUND_ALERT_QUEUE_GAP_MS);

  updateSoundAlertQueueRow(targetRow, {
    status: "ACTIVE",
    startedAt,
    releaseAt,
    completedAt: null,
  });
  activeSoundAlertRow = targetRow;

  if (targetRow.requesterName) {
    const announcement = `${targetRow.requesterName} resgatou o alerta ${targetRow.displayName}`;
    await sendSystemChatMessage(announcement).catch((error) => {
      console.error("[VoicemodReward] Falha ao avisar sound alert no chat da Twitch:", error);
    });
  }

  publishRewardOverlayMessage({
    username: "Vulkan Sentinel",
    message: `${targetRow.requesterName ?? "Alguem"} resgatou o alerta ${targetRow.displayName}`,
    icon: "SFX",
  });

  if (voicemodSoundAlertQueueTimer) {
    clearTimeout(voicemodSoundAlertQueueTimer);
  }
  voicemodSoundAlertQueueTimer = setTimeout(() => {
    void ensureVoicemodSoundAlertQueueProgress().catch((error) => {
      console.error("[VoicemodReward] Falha ao avancar fila de sound alerts:", error);
    });
  }, VOICEMOD_SOUND_ALERT_QUEUE_GAP_MS + 25);

  return true;
}

async function tryResetDefaultVoice(agentId: string) {
  const defaultVoiceId = env.VOICEMOD_DEFAULT_VOICE_ID?.trim();
  if (!defaultVoiceId || !isAgentConnected(agentId)) {
    return;
  }

  try {
    const result = await dispatchAgentJob({
      agentId,
      action: "voicemod.loadVoice",
      payload: {
        voiceId: defaultVoiceId,
      },
      timeoutMs: 30_000,
    });

    if (!result.result.ok) {
      console.error("[VoicemodReward] Falha ao restaurar voz padrao:", result.result.error);
    }
  } catch (error) {
    console.error("[VoicemodReward] Erro ao restaurar voz padrao:", error);
  }
}

async function activatePausedQueueRow(row: VoicemodQueueRow) {
  if (!isAgentConnected(row.agentId)) {
    return false;
  }

  const result = await dispatchAgentJob({
    agentId: row.agentId,
    action: "voicemod.loadVoice",
    payload: {
      voiceId: row.voiceId,
    },
    timeoutMs: 30_000,
  });

  if (!result.result.ok) {
    console.error("[VoicemodReward] Falha ao reativar item pausado:", result.result.error);
    return false;
  }

  const remainingMs = Math.max(1_000, row.remainingMs ?? VOICEMOD_REWARD_DURATION_MS);
  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + remainingMs);
  const targetRow = pausedRewardRow?.id === row.id ? pausedRewardRow : row;

  updateQueueRow(targetRow, {
    status: "ACTIVE",
    startedAt,
    expiresAt,
    remainingMs: null,
    completedAt: null,
  });
  pausedRewardRow = null;
  activeRewardRow = targetRow;

  return true;
}

async function ensureVoicemodQueueProgressInternal() {
  if (pausedRewardRow) {
    return;
  }

  if (activeRewardRow && activeRewardRow.expiresAt && activeRewardRow.expiresAt.getTime() > Date.now()) {
    return;
  }

  const expiredActive = activeRewardRow;
  if (expiredActive) {
    await markQueueRowCompleted(expiredActive.id);
  }

  const next = pendingRewardRows[0] ?? null;
  if (next) {
    const activated = await activateQueueRow(next);
    if (!activated) {
      return;
    }
    return;
  }

  if (expiredActive) {
    await tryResetDefaultVoice(expiredActive.agentId);
  }
}

async function ensureVoicemodQueueProgress() {
  if (!ensureVoicemodQueueProgressPromise) {
    ensureVoicemodQueueProgressPromise = ensureVoicemodQueueProgressInternal()
      .finally(() => {
        ensureVoicemodQueueProgressPromise = null;
      });
  }

  await ensureVoicemodQueueProgressPromise;
}

async function ensureVoicemodSoundAlertQueueProgressInternal() {
  if (activeSoundAlertRow && activeSoundAlertRow.releaseAt && activeSoundAlertRow.releaseAt.getTime() > Date.now()) {
    return;
  }

  const expiredActive = activeSoundAlertRow;
  if (expiredActive) {
    await markVoicemodSoundAlertQueueRowCompleted(expiredActive.id);
  }

  const next = pendingSoundAlertRows[0] ?? null;
  if (!next) {
    return;
  }

  const activated = await activateVoicemodSoundAlertQueueRow(next);
  if (!activated) {
    return;
  }
}

async function ensureVoicemodSoundAlertQueueProgress() {
  if (!ensureVoicemodSoundAlertQueueProgressPromise) {
    ensureVoicemodSoundAlertQueueProgressPromise = ensureVoicemodSoundAlertQueueProgressInternal()
      .finally(() => {
        ensureVoicemodSoundAlertQueueProgressPromise = null;
      });
  }

  await ensureVoicemodSoundAlertQueueProgressPromise;
}

export async function skipVoicemodActiveReward() {
  const current = (await loadActiveVoicemodQueueRow()) ?? (await loadPausedVoicemodQueueRow());
  if (!current) {
    return { ok: false as const, code: "NO_ACTIVE_REWARD", message: "Nenhuma voz ativa ou pausada no momento." };
  }

  await markQueueRowCompleted(current.id);
  await tryResetDefaultVoice(current.agentId);
  await ensureVoicemodQueueProgress();

  return { ok: true as const };
}

export async function clearVoicemodPendingQueue() {
  const clearedCount = pendingRewardRows.length;
  pendingRewardRows.length = 0;

  return {
    ok: true as const,
    clearedCount,
  };
}

export async function toggleVoicemodQueuePause() {
  const paused = await loadPausedVoicemodQueueRow();
  if (paused) {
    const resumed = await activatePausedQueueRow(paused);
    if (!resumed) {
      return { ok: false as const, code: "RESUME_FAILED", message: "Nao foi possivel retomar a voz pausada." };
    }

    return { ok: true as const, paused: false };
  }

  const active = await loadActiveVoicemodQueueRow();
  if (!active || !active.expiresAt) {
    return { ok: false as const, code: "NO_ACTIVE_REWARD", message: "Nenhuma voz ativa para pausar." };
  }

  const remainingMs = Math.max(1_000, active.expiresAt.getTime() - Date.now());
  if (!activeRewardRow || activeRewardRow.id !== active.id) {
    return { ok: false as const, code: "NO_ACTIVE_REWARD", message: "Nenhuma voz ativa para pausar." };
  }

  updateQueueRow(activeRewardRow, {
    status: "PAUSED",
    expiresAt: null,
    remainingMs,
  });
  pausedRewardRow = activeRewardRow;
  activeRewardRow = null;

  await tryResetDefaultVoice(active.agentId);
  return { ok: true as const, paused: true };
}

export async function getVoicemodModerationSnapshot() {
  await ensureVoicemodQueueProgress();

  const [active, paused, pendingRows] = await Promise.all([
    loadActiveVoicemodQueueRow(),
    loadPausedVoicemodQueueRow(),
    loadPendingVoicemodQueueRows(),
  ]);

  const activeRemainingMs = active?.expiresAt ? Math.max(0, active.expiresAt.getTime() - Date.now()) : null;

  return {
    activeDisplayName: active?.displayName ?? paused?.displayName ?? null,
    pendingCount: pendingRows.length,
    paused: Boolean(paused),
    remainingMs: paused?.remainingMs ?? activeRemainingMs,
  };
}

export async function getActiveVoicemodRewardState() {
  await ensureVoicemodQueueProgress();

  const active = await loadActiveVoicemodQueueRow();
  return active ? mapActiveReward(active) : null;
}

export async function listVoicemodQueueItems() {
  await ensureVoicemodQueueProgress();

  const pendingRows = await loadPendingVoicemodQueueRows();
  return pendingRows.map((row, index) => mapQueueItem(row, index + 1));
}

export function initializeVoicemodRewardController() {
  if (voicemodRewardControllerInterval) {
    return;
  }

  voicemodRewardControllerInterval = setInterval(() => {
    if (voicemodRewardControllerInFlight) {
      return;
    }

    voicemodRewardControllerInFlight = true;
    void Promise.all([
      ensureVoicemodQueueProgress(),
      ensureVoicemodSoundAlertQueueProgress(),
    ])
      .catch((error) => {
        console.error("[VoicemodReward] Erro no controlador das filas:", error);
      })
      .finally(() => {
        voicemodRewardControllerInFlight = false;
      });
  }, VOICEMOD_REWARD_POLL_MS);
}

export async function shutdownVoicemodRewardController() {
  if (voicemodRewardControllerInterval) {
    clearInterval(voicemodRewardControllerInterval);
    voicemodRewardControllerInterval = null;
  }

  if (voicemodSoundAlertQueueTimer) {
    clearTimeout(voicemodSoundAlertQueueTimer);
    voicemodSoundAlertQueueTimer = null;
  }
}

export async function listVoicemodVoiceChoices() {
  const [voices, activeReward, queuedItems] = await Promise.all([
    listVoicemodRedeems(),
    getActiveVoicemodRewardState(),
    listVoicemodQueueItems(),
  ]);

  const queuedByTechnicalId = new Set(queuedItems.map((item) => item.technicalId));

  return voices.map((voice) => ({
    id: voice.technicalId,
    title: voice.displayName,
    thumbnailUrl: voice.thumbnailUrl,
    fallbackThumbnailUrl: voice.fallbackThumbnailUrl,
    selectedThumbnailUrl: voice.selectedImageCandidates[0] ?? null,
    imageCandidates: voice.imageCandidates,
    selectedImageCandidates: voice.selectedImageCandidates,
    voiceId: voice.voiceId,
    agentId: voice.agentId,
    enabled: voice.enabled,
    isCustom: voice.isCustom,
    favorited: voice.favorited,
    isNew: voice.isNew,
    bitmapChecksum: voice.bitmapChecksum,
    isActive: activeReward?.technicalId === voice.technicalId,
    isQueued: queuedByTechnicalId.has(voice.technicalId),
  }));
}

export async function getVoicemodSoundCatalog() {
  const soundAlerts = await listVoicemodSoundAlertRedeems();
  const uniqueSoundboards = new Map<string, { id: string | null; name: string | null }>();

  for (const soundAlert of soundAlerts) {
    const key = `${soundAlert.soundboardId ?? ""}:${soundAlert.soundboardName ?? ""}`;
    if (!uniqueSoundboards.has(key)) {
      uniqueSoundboards.set(key, {
        id: soundAlert.soundboardId,
        name: soundAlert.soundboardName,
      });
    }
  }

  const soundboard = uniqueSoundboards.size === 1
    ? Array.from(uniqueSoundboards.values())[0] ?? null
    : null;

  return {
    soundboard,
    soundAlerts: soundAlerts.map((soundAlert) => ({
      id: soundAlert.technicalId,
      title: soundAlert.displayName,
      thumbnailUrl: soundAlert.thumbnailUrl,
      fallbackThumbnailUrl: soundAlert.fallbackThumbnailUrl,
      imageCandidates: soundAlert.imageCandidates,
      soundId: soundAlert.soundId,
      agentId: soundAlert.agentId,
      enabled: soundAlert.enabled,
      playbackMode: soundAlert.playbackMode,
      loop: soundAlert.loop,
      muteVoice: soundAlert.muteVoice,
      stopOtherSounds: soundAlert.stopOtherSounds,
      soundboardId: soundAlert.soundboardId,
      soundboardName: soundAlert.soundboardName,
    })),
  };
}

export async function testVoicemodSoundAlert(input: {
  technicalId: string;
}): Promise<VoicemodSoundAlertTestResult> {
  const soundAlert = await findVoicemodSoundAlertRedeemByTechnicalId(input.technicalId);
  if (!soundAlert) {
    return {
      ok: false,
      code: "REWARD_NOT_FOUND",
      message: "Esse sound alert nao esta disponivel no momento.",
    };
  }

  if (!isAgentConnected(soundAlert.agentId)) {
    return {
      ok: false,
      code: "AGENT_OFFLINE",
      message: "O agent responsavel pelos sound alerts nao esta conectado agora.",
    };
  }

  try {
    const result = await dispatchAgentJob({
      agentId: soundAlert.agentId,
      action: "voicemod.playSound",
      payload: {
        soundId: soundAlert.soundId,
      },
      timeoutMs: 30_000,
    });

    if (!result.result.ok) {
      console.error("[VoicemodReward] Falha ao testar sound alert:", result.result.error);
      return {
        ok: false,
        code: "AGENT_ERROR",
        message: "Falha ao tocar o sound alert no agent.",
      };
    }

    return {
      ok: true,
      soundAlert: {
        id: soundAlert.technicalId,
        title: soundAlert.displayName,
        soundId: soundAlert.soundId,
        soundboardId: soundAlert.soundboardId,
        soundboardName: soundAlert.soundboardName,
      },
    };
  } catch (error) {
    console.error("[VoicemodReward] Erro ao testar sound alert:", error);
    return {
      ok: false,
      code: "AGENT_ERROR",
      message: "Falha ao tocar o sound alert no agent.",
    };
  }
}

export async function requestVoicemodSoundAlertReward(input: {
  technicalId: string;
  twitchId?: string;
  discordId?: string;
  requesterName?: string;
}): Promise<VoicemodSoundAlertRewardResult> {
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

  const soundAlert = await findVoicemodSoundAlertRedeemByTechnicalId(input.technicalId);
  if (!soundAlert) {
    return {
      ok: false,
      code: "REWARD_NOT_FOUND",
      user,
      message: "Esse sound alert nao esta disponivel no momento.",
    };
  }

  const rewardSetting = await getRewardSetting("soundalert");
  if (!rewardSetting.enabled) {
    return {
      ok: false,
      code: "REWARD_DISABLED",
      user,
      message: "Os sound alerts estao desativados no momento.",
    };
  }

  if (!isAgentConnected(soundAlert.agentId)) {
    return {
      ok: false,
      code: "AGENT_OFFLINE",
      user,
      message: "O agent responsavel pelos sound alerts nao esta conectado agora.",
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
  let queueRowId: number | null = null;

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

    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        balance: true,
      },
    });

    if (!updatedUser) {
      throw new Error("USER_NOT_FOUND_AFTER_CHARGE");
    }

    const queueRow = await enqueueVoicemodSoundAlertReward({
      userId: user.id,
      agentId: soundAlert.agentId,
      soundId: soundAlert.soundId,
      technicalId: soundAlert.technicalId,
      displayName: soundAlert.displayName,
      requesterName: input.requesterName ?? null,
    });
    queueRowId = queueRow.id;

    await ensureVoicemodSoundAlertQueueProgress();

    const updatedQueueRow = await loadVoicemodSoundAlertQueueRowById(queueRow.id);
    if (!updatedQueueRow) {
      throw new Error("QUEUE_ROW_NOT_FOUND_AFTER_ENQUEUE");
    }

    if (updatedQueueRow.status === "ACTIVE") {
      return {
        ok: true,
        user,
        chargedAmount,
        balanceAfter: updatedUser.balance,
        soundAlert: {
          id: soundAlert.technicalId,
          title: soundAlert.displayName,
          soundId: soundAlert.soundId,
          soundboardId: soundAlert.soundboardId,
          soundboardName: soundAlert.soundboardName,
          startedAt: updatedQueueRow.startedAt?.toISOString() ?? null,
          status: "active",
          queuePosition: 0,
        },
      };
    }

    const pendingRows = await loadPendingVoicemodSoundAlertQueueRows();
    const queuePosition = pendingRows.findIndex((row) => row.id === updatedQueueRow.id) + 1;

    return {
      ok: true,
      user,
      chargedAmount,
      balanceAfter: updatedUser.balance,
      soundAlert: {
        id: soundAlert.technicalId,
        title: soundAlert.displayName,
        soundId: soundAlert.soundId,
        soundboardId: soundAlert.soundboardId,
        soundboardName: soundAlert.soundboardName,
        startedAt: null,
        status: "queued",
        queuePosition: Math.max(queuePosition, 1),
      },
    };
  } catch (error) {
    if (charged) {
      if (queueRowId) {
        await markVoicemodSoundAlertQueueRowCompleted(queueRowId).catch(() => {
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          balance: { increment: chargedAmount },
        },
      }).catch((refundError) => {
        console.error("[VoicemodReward] Falha ao estornar Firecoins do sound alert:", refundError);
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

    console.error("[VoicemodReward] Falha ao processar sound alert:", error);
    return {
      ok: false,
      code: "AGENT_ERROR",
      chargedAmount,
      user,
      message: "Falha ao colocar o sound alert na fila. Se houve cobranca parcial, o sistema tentou estornar automaticamente.",
    };
  }
}

export async function requestVoicemodVoiceReward(input: {
  technicalId: string;
  twitchId?: string;
  discordId?: string;
  requesterName?: string;
}): Promise<VoicemodRewardResult> {
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

  const redeem = await findVoicemodRedeemByTechnicalId(input.technicalId);
  if (!redeem) {
    return {
      ok: false,
      code: "REWARD_NOT_FOUND",
      user,
      message: "Essa voz nao esta disponivel no momento.",
    };
  }

  const rewardSetting = await getRewardSetting("voicemod");
  if (!rewardSetting.enabled) {
    return {
      ok: false,
      code: "REWARD_DISABLED",
      user,
      message: "A troca de voz esta desativada no momento.",
    };
  }

  if (!isAgentConnected(redeem.agentId)) {
    return {
      ok: false,
      code: "AGENT_OFFLINE",
      user,
      message: "O agent responsavel pelas vozes nao esta conectado agora.",
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
  let queueRowId: number | null = null;

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

    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        balance: true,
      },
    });

    if (!updatedUser) {
      throw new Error("USER_NOT_FOUND_AFTER_CHARGE");
    }

    const queueRow = await enqueueVoicemodReward({
      userId: user.id,
      agentId: redeem.agentId,
      voiceId: redeem.voiceId,
      technicalId: redeem.technicalId,
      displayName: redeem.displayName,
      requesterName: input.requesterName ?? null,
    });
    queueRowId = queueRow.id;

    await ensureVoicemodQueueProgress();

    const updatedQueueRow = await loadQueueRowById(queueRow.id);
    if (!updatedQueueRow) {
      throw new Error("QUEUE_ROW_NOT_FOUND_AFTER_ENQUEUE");
    }

    if (updatedQueueRow.status === "ACTIVE") {
      publishRewardOverlayMessage({
        username: "Vulkan Sentinel",
        message: `${input.requesterName ?? "Alguem"} resgatou a voz ${redeem.displayName}`,
        icon: "VOX",
      });

      return {
        ok: true,
        user,
        chargedAmount,
        balanceAfter: updatedUser.balance,
        redeem: {
          id: redeem.technicalId,
          title: redeem.displayName,
          voiceId: redeem.voiceId,
          startedAt: updatedQueueRow.startedAt?.toISOString() ?? null,
          expiresAt: updatedQueueRow.expiresAt?.toISOString() ?? null,
          status: "active",
          queuePosition: 0,
        },
      };
    }

    const pendingRows = await loadPendingVoicemodQueueRows();
    const queuePosition = pendingRows.findIndex((row) => row.id === updatedQueueRow.id) + 1;

    publishRewardOverlayMessage({
      username: "Vulkan Sentinel",
      message: `${input.requesterName ?? "Alguem"} resgatou a voz ${redeem.displayName}`,
      icon: "VOX",
    });

    return {
      ok: true,
      user,
      chargedAmount,
      balanceAfter: updatedUser.balance,
      redeem: {
        id: redeem.technicalId,
        title: redeem.displayName,
        voiceId: redeem.voiceId,
        startedAt: null,
        expiresAt: null,
        status: "queued",
        queuePosition: Math.max(queuePosition, 1),
      },
    };
  } catch (error) {
    if (charged) {
      if (queueRowId) {
        await markQueueRowCompleted(queueRowId).catch(() => {
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          balance: { increment: chargedAmount },
        },
      }).catch((refundError) => {
        console.error("[VoicemodReward] Falha ao estornar Firecoins:", refundError);
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

    console.error("[VoicemodReward] Falha ao processar troca de voz:", error);
    return {
      ok: false,
      code: "AGENT_ERROR",
      chargedAmount,
      user,
      message: "Falha ao colocar a voz na fila. Se houve cobranca parcial, o sistema tentou estornar automaticamente.",
    };
  }
}
