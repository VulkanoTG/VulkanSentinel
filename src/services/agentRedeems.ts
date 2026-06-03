import { prisma } from "#database";

export const AGENT_REDEEM_TYPE_VOICEMOD_VOICE = "voicemod_voice";
export const AGENT_REDEEM_TYPE_VOICEMOD_SOUND = "voicemod_sounds";

type AgentRedeemRow = {
  technicalId: string;
  displayName: string;
  thumbnailUrl: string | null;
  fallbackThumbnailUrl: string | null;
  status: boolean;
  rewardType: string;
  agentId: string;
  payloadJson: string;
};

export type SyncedVoicemodRedeemVoice = {
  technicalId: string;
  displayName: string;
  thumbnailUrl: string | null;
  fallbackThumbnailUrl: string | null;
  status: boolean;
  rewardType: typeof AGENT_REDEEM_TYPE_VOICEMOD_VOICE;
  agentId: string;
  voiceId: string;
  enabled: boolean;
  isCustom: boolean;
  favorited: boolean;
  isNew: boolean;
  bitmapChecksum: string | null;
  imageCandidates: string[];
  selectedImageCandidates: string[];
};

export type SyncedVoicemodSoundAlert = {
  technicalId: string;
  displayName: string;
  thumbnailUrl: string | null;
  fallbackThumbnailUrl: string | null;
  status: boolean;
  rewardType: typeof AGENT_REDEEM_TYPE_VOICEMOD_SOUND;
  agentId: string;
  soundId: string;
  enabled: boolean;
  playbackMode: string | null;
  loop: boolean;
  muteVoice: boolean;
  stopOtherSounds: boolean;
  soundboardId: string | null;
  soundboardName: string | null;
  imageCandidates: string[];
};

type VoicemodVoiceInput = {
  id: string;
  friendlyName: string;
  enabled?: boolean;
  isCustom?: boolean;
  favorited?: boolean;
  isNew?: boolean;
  bitmapChecksum?: string | null;
  image?: string | null;
  selectedImage?: string | null;
  transparentImage?: string | null;
  thumbnailImage?: string | null;
  thumbnailSelectedImage?: string | null;
  thumbnailTransparentImage?: string | null;
};

type VoicemodSoundAlertInput = {
  id: string;
  name: string;
  enabled?: boolean;
  playbackMode?: string | null;
  loop?: boolean;
  muteVoice?: boolean;
  stopOtherSounds?: boolean;
  thumbnailImage?: string | null;
};

let ensureAgentRedeemsTablePromise: Promise<void> | null = null;

function parseVoiceRedeemRow(row: AgentRedeemRow): SyncedVoicemodRedeemVoice | null {
  if (row.rewardType !== AGENT_REDEEM_TYPE_VOICEMOD_VOICE) {
    return null;
  }

  try {
    const payload = JSON.parse(row.payloadJson) as {
      voiceId?: unknown;
      enabled?: unknown;
      isCustom?: unknown;
      favorited?: unknown;
      isNew?: unknown;
      bitmapChecksum?: unknown;
      imageCandidates?: unknown;
      selectedImageCandidates?: unknown;
    };
    const voiceId = typeof payload.voiceId === "string" ? payload.voiceId : row.technicalId;
    const imageCandidates = Array.isArray(payload.imageCandidates)
      ? payload.imageCandidates.filter((value): value is string => typeof value === "string")
      : [row.thumbnailUrl, row.fallbackThumbnailUrl].filter((value): value is string => typeof value === "string" && value.length > 0);
    const selectedImageCandidates = Array.isArray(payload.selectedImageCandidates)
      ? payload.selectedImageCandidates.filter((value): value is string => typeof value === "string")
      : [];

    return {
      technicalId: row.technicalId,
      displayName: row.displayName,
      thumbnailUrl: row.thumbnailUrl,
      fallbackThumbnailUrl: row.fallbackThumbnailUrl,
      status: Boolean(row.status),
      rewardType: AGENT_REDEEM_TYPE_VOICEMOD_VOICE,
      agentId: row.agentId,
      voiceId,
      enabled: typeof payload.enabled === "boolean" ? payload.enabled : true,
      isCustom: typeof payload.isCustom === "boolean" ? payload.isCustom : false,
      favorited: typeof payload.favorited === "boolean" ? payload.favorited : false,
      isNew: typeof payload.isNew === "boolean" ? payload.isNew : false,
      bitmapChecksum: typeof payload.bitmapChecksum === "string" ? payload.bitmapChecksum : null,
      imageCandidates,
      selectedImageCandidates,
    };
  } catch {
    return null;
  }
}

function parseSoundAlertRedeemRow(row: AgentRedeemRow): SyncedVoicemodSoundAlert | null {
  if (row.rewardType !== AGENT_REDEEM_TYPE_VOICEMOD_SOUND) {
    return null;
  }

  try {
    const payload = JSON.parse(row.payloadJson) as {
      soundId?: unknown;
      enabled?: unknown;
      playbackMode?: unknown;
      loop?: unknown;
      muteVoice?: unknown;
      stopOtherSounds?: unknown;
      soundboardId?: unknown;
      soundboardName?: unknown;
    };

    return {
      technicalId: row.technicalId,
      displayName: row.displayName,
      thumbnailUrl: row.thumbnailUrl,
      fallbackThumbnailUrl: row.fallbackThumbnailUrl,
      status: Boolean(row.status),
      rewardType: AGENT_REDEEM_TYPE_VOICEMOD_SOUND,
      agentId: row.agentId,
      soundId: typeof payload.soundId === "string" ? payload.soundId : row.technicalId,
      enabled: typeof payload.enabled === "boolean" ? payload.enabled : true,
      playbackMode: typeof payload.playbackMode === "string" ? payload.playbackMode : null,
      loop: typeof payload.loop === "boolean" ? payload.loop : false,
      muteVoice: typeof payload.muteVoice === "boolean" ? payload.muteVoice : false,
      stopOtherSounds: typeof payload.stopOtherSounds === "boolean" ? payload.stopOtherSounds : false,
      soundboardId: typeof payload.soundboardId === "string" ? payload.soundboardId : null,
      soundboardName: typeof payload.soundboardName === "string" ? payload.soundboardName : null,
      imageCandidates: Array.isArray((payload as { imageCandidates?: unknown }).imageCandidates)
        ? ((payload as { imageCandidates?: unknown[] }).imageCandidates ?? []).filter((value): value is string => typeof value === "string")
        : [row.thumbnailUrl, row.fallbackThumbnailUrl].filter((value): value is string => typeof value === "string" && value.length > 0),
    };
  } catch {
    return null;
  }
}

function normalizeVoiceImage(value: string | null | undefined) {
  const normalized = value?.trim() || null;
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("data:image/")) {
    return normalized;
  }

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }

  return null;
}

function uniqueImageCandidates(values: Array<string | null | undefined>) {
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeVoiceImage(value);
    if (normalized && !result.includes(normalized)) {
      result.push(normalized);
    }
  }
  return result;
}

async function ensureAgentRedeemsTable() {
  if (!ensureAgentRedeemsTablePromise) {
    ensureAgentRedeemsTablePromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "AgentRedeem" (
          "id" SERIAL PRIMARY KEY,
          "technicalId" TEXT NOT NULL UNIQUE,
          "displayName" TEXT NOT NULL,
          "thumbnailUrl" TEXT,
          "fallbackThumbnailUrl" TEXT,
          "status" BOOLEAN NOT NULL DEFAULT TRUE,
          "rewardType" TEXT NOT NULL,
          "agentId" TEXT NOT NULL,
          "payloadJson" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "AgentRedeem"
        ADD COLUMN IF NOT EXISTS "displayName" TEXT NOT NULL DEFAULT ''
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "AgentRedeem"
        ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "AgentRedeem"
        ADD COLUMN IF NOT EXISTS "fallbackThumbnailUrl" TEXT
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "AgentRedeem"
        ADD COLUMN IF NOT EXISTS "status" BOOLEAN
      `);

      await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'AgentRedeem'
              AND column_name = 'status'
              AND data_type <> 'boolean'
          ) THEN
            ALTER TABLE "AgentRedeem"
            ALTER COLUMN "status" DROP DEFAULT;

            ALTER TABLE "AgentRedeem"
            ALTER COLUMN "status" TYPE BOOLEAN
            USING CASE
              WHEN "status"::TEXT IN ('active', 'true', 't', '1') THEN TRUE
              ELSE FALSE
            END;
          END IF;
        END $$;
      `);

      await prisma.$executeRawUnsafe(`
        UPDATE "AgentRedeem"
        SET "status" = TRUE
        WHERE "status" IS NULL
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "AgentRedeem"
        ALTER COLUMN "status" SET DEFAULT TRUE
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "AgentRedeem"
        ALTER COLUMN "status" SET NOT NULL
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "AgentRedeem"
        ADD COLUMN IF NOT EXISTS "rewardType" TEXT NOT NULL DEFAULT '${AGENT_REDEEM_TYPE_VOICEMOD_VOICE}'
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "AgentRedeem"
        ADD COLUMN IF NOT EXISTS "agentId" TEXT NOT NULL DEFAULT ''
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "AgentRedeem"
        ADD COLUMN IF NOT EXISTS "payloadJson" TEXT NOT NULL DEFAULT '{}'
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "AgentRedeem"
        ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "AgentRedeem"
        ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      `);

      await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'AgentRedeem_technicalId_key'
          ) THEN
            ALTER TABLE "AgentRedeem" DROP CONSTRAINT "AgentRedeem_technicalId_key";
          END IF;
        END $$;
      `);

      await prisma.$executeRawUnsafe(`
        DROP INDEX IF EXISTS "AgentRedeem_technicalId_key"
      `);

      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "AgentRedeem_rewardType_technicalId_key"
        ON "AgentRedeem" ("rewardType", "technicalId")
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "AgentRedeem"
        ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "AgentRedeem"
        ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP
      `);

      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION update_agent_redeem_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW."updatedAt" = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql'
      `);

      await prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS "AgentRedeem_set_updatedAt" ON "AgentRedeem"
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER "AgentRedeem_set_updatedAt"
        BEFORE UPDATE ON "AgentRedeem"
        FOR EACH ROW
        EXECUTE FUNCTION update_agent_redeem_updated_at()
      `);
    })().catch((error) => {
      ensureAgentRedeemsTablePromise = null;
      throw error;
    });
  }

  await ensureAgentRedeemsTablePromise;
}

export async function syncVoicemodRedeemsFromAgent(input: {
  agentId: string;
  voices: VoicemodVoiceInput[];
}) {
  await ensureAgentRedeemsTable();

  const voices = input.voices
    .filter((voice) => voice.id.trim() && voice.friendlyName.trim())
    .map((voice) => ({
      imageCandidates: uniqueImageCandidates([
        voice.thumbnailImage,
        voice.thumbnailSelectedImage,
        voice.thumbnailTransparentImage,
        voice.image,
        voice.selectedImage,
        voice.transparentImage,
      ]),
      selectedImageCandidates: uniqueImageCandidates([
        voice.thumbnailSelectedImage,
        voice.selectedImage,
        voice.thumbnailImage,
        voice.thumbnailTransparentImage,
        voice.image,
        voice.transparentImage,
      ]),
      technicalId: voice.id.trim(),
      displayName: voice.friendlyName.trim(),
      thumbnailUrl: null as string | null,
      fallbackThumbnailUrl: null as string | null,
      voiceId: voice.id.trim(),
      enabled: voice.enabled ?? true,
      isCustom: voice.isCustom ?? false,
      favorited: voice.favorited ?? false,
      isNew: voice.isNew ?? false,
      bitmapChecksum: voice.bitmapChecksum?.trim() || null,
    }));

  for (const voice of voices) {
    voice.thumbnailUrl = voice.imageCandidates[0] ?? null;
    voice.fallbackThumbnailUrl = voice.imageCandidates[1] ?? null;
    if (!voice.thumbnailUrl && !voice.fallbackThumbnailUrl && voice.selectedImageCandidates.length === 0) {
      console.log(`[AgentRedeems] Voz sem imagem utilizavel: ${voice.displayName} (${voice.technicalId}).`);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "AgentRedeem"
      SET "status" = FALSE,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "rewardType" = ${AGENT_REDEEM_TYPE_VOICEMOD_VOICE}
        AND "agentId" = ${input.agentId}
    `;

    for (const voice of voices) {
      await tx.$executeRaw`
        INSERT INTO "AgentRedeem" ("technicalId", "displayName", "thumbnailUrl", "fallbackThumbnailUrl", "status", "rewardType", "agentId", "payloadJson", "createdAt", "updatedAt")
        VALUES (${voice.technicalId}, ${voice.displayName}, ${voice.thumbnailUrl}, ${voice.fallbackThumbnailUrl}, ${true}, ${AGENT_REDEEM_TYPE_VOICEMOD_VOICE}, ${input.agentId}, ${JSON.stringify({
          voiceId: voice.voiceId,
          enabled: voice.enabled,
          isCustom: voice.isCustom,
          favorited: voice.favorited,
          isNew: voice.isNew,
          bitmapChecksum: voice.bitmapChecksum,
          imageCandidates: voice.imageCandidates,
          selectedImageCandidates: voice.selectedImageCandidates,
        })}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("rewardType", "technicalId")
        DO UPDATE SET
          "displayName" = EXCLUDED."displayName",
          "thumbnailUrl" = EXCLUDED."thumbnailUrl",
          "fallbackThumbnailUrl" = EXCLUDED."fallbackThumbnailUrl",
          "status" = EXCLUDED."status",
          "rewardType" = EXCLUDED."rewardType",
          "agentId" = EXCLUDED."agentId",
          "payloadJson" = EXCLUDED."payloadJson",
          "updatedAt" = CURRENT_TIMESTAMP
      `;
    }
  });
}

export async function syncVoicemodSoundAlertsFromAgent(input: {
  agentId: string;
  soundAlerts: VoicemodSoundAlertInput[];
  soundboard?: {
    id?: string | null;
    name?: string | null;
  } | null;
}) {
  await ensureAgentRedeemsTable();

  const soundboardId = input.soundboard?.id?.trim() || null;
  const soundboardName = input.soundboard?.name?.trim() || null;
  const soundAlerts = input.soundAlerts
    .filter((soundAlert) => soundAlert.id.trim() && soundAlert.name.trim())
    .map((soundAlert) => ({
      imageCandidates: uniqueImageCandidates([
        soundAlert.thumbnailImage,
      ]),
      technicalId: soundAlert.id.trim(),
      displayName: soundAlert.name.trim(),
      thumbnailUrl: normalizeVoiceImage(soundAlert.thumbnailImage) ?? null,
      fallbackThumbnailUrl: null as string | null,
      soundId: soundAlert.id.trim(),
      enabled: soundAlert.enabled ?? true,
      playbackMode: soundAlert.playbackMode?.trim() || null,
      loop: soundAlert.loop ?? false,
      muteVoice: soundAlert.muteVoice ?? false,
      stopOtherSounds: soundAlert.stopOtherSounds ?? false,
      soundboardId,
      soundboardName,
    }));

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "AgentRedeem"
      SET "status" = FALSE,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "rewardType" = ${AGENT_REDEEM_TYPE_VOICEMOD_SOUND}
        AND "agentId" = ${input.agentId}
    `;

    for (const soundAlert of soundAlerts) {
      await tx.$executeRaw`
        INSERT INTO "AgentRedeem" ("technicalId", "displayName", "thumbnailUrl", "fallbackThumbnailUrl", "status", "rewardType", "agentId", "payloadJson", "createdAt", "updatedAt")
        VALUES (${soundAlert.technicalId}, ${soundAlert.displayName}, ${soundAlert.thumbnailUrl}, ${soundAlert.fallbackThumbnailUrl}, ${true}, ${AGENT_REDEEM_TYPE_VOICEMOD_SOUND}, ${input.agentId}, ${JSON.stringify({
          soundId: soundAlert.soundId,
          enabled: soundAlert.enabled,
          playbackMode: soundAlert.playbackMode,
          loop: soundAlert.loop,
          muteVoice: soundAlert.muteVoice,
          stopOtherSounds: soundAlert.stopOtherSounds,
          soundboardId: soundAlert.soundboardId,
          soundboardName: soundAlert.soundboardName,
          imageCandidates: soundAlert.imageCandidates,
        })}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("rewardType", "technicalId")
        DO UPDATE SET
          "displayName" = EXCLUDED."displayName",
          "thumbnailUrl" = EXCLUDED."thumbnailUrl",
          "fallbackThumbnailUrl" = EXCLUDED."fallbackThumbnailUrl",
          "status" = EXCLUDED."status",
          "rewardType" = EXCLUDED."rewardType",
          "agentId" = EXCLUDED."agentId",
          "payloadJson" = EXCLUDED."payloadJson",
          "updatedAt" = CURRENT_TIMESTAMP
      `;
    }
  });
}

export async function listVoicemodRedeems() {
  await ensureAgentRedeemsTable();

  const rows = await prisma.$queryRaw<AgentRedeemRow[]>`
    SELECT "technicalId", "displayName", "thumbnailUrl", "fallbackThumbnailUrl", "status", "rewardType", "agentId", "payloadJson"
    FROM "AgentRedeem"
    WHERE "rewardType" = ${AGENT_REDEEM_TYPE_VOICEMOD_VOICE}
      AND "status" = TRUE
    ORDER BY "displayName" ASC
  `;

  return rows
    .map(parseVoiceRedeemRow)
    .filter((row): row is SyncedVoicemodRedeemVoice => Boolean(row));
}

export async function listVoicemodSoundAlertRedeems() {
  await ensureAgentRedeemsTable();

  const rows = await prisma.$queryRaw<AgentRedeemRow[]>`
    SELECT "technicalId", "displayName", "thumbnailUrl", "fallbackThumbnailUrl", "status", "rewardType", "agentId", "payloadJson"
    FROM "AgentRedeem"
    WHERE "rewardType" = ${AGENT_REDEEM_TYPE_VOICEMOD_SOUND}
      AND "status" = TRUE
    ORDER BY "displayName" ASC
  `;

  return rows
    .map(parseSoundAlertRedeemRow)
    .filter((row): row is SyncedVoicemodSoundAlert => Boolean(row));
}

export async function findVoicemodRedeemByTechnicalId(technicalId: string) {
  await ensureAgentRedeemsTable();

  const rows = await prisma.$queryRaw<AgentRedeemRow[]>`
    SELECT "technicalId", "displayName", "thumbnailUrl", "fallbackThumbnailUrl", "status", "rewardType", "agentId", "payloadJson"
    FROM "AgentRedeem"
    WHERE "technicalId" = ${technicalId}
      AND "status" = TRUE
      AND "rewardType" = ${AGENT_REDEEM_TYPE_VOICEMOD_VOICE}
    LIMIT 1
  `;

  return rows[0] ? parseVoiceRedeemRow(rows[0]) : null;
}

export async function findVoicemodSoundAlertRedeemByTechnicalId(technicalId: string) {
  await ensureAgentRedeemsTable();

  const rows = await prisma.$queryRaw<AgentRedeemRow[]>`
    SELECT "technicalId", "displayName", "thumbnailUrl", "fallbackThumbnailUrl", "status", "rewardType", "agentId", "payloadJson"
    FROM "AgentRedeem"
    WHERE "technicalId" = ${technicalId}
      AND "status" = TRUE
      AND "rewardType" = ${AGENT_REDEEM_TYPE_VOICEMOD_SOUND}
    LIMIT 1
  `;

  return rows[0] ? parseSoundAlertRedeemRow(rows[0]) : null;
}
