import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "#database";

type JsonRow = Record<string, unknown>;

type ImportTarget =
  | "user"
  | "reward-setting"
  | "modules"
  | "badge"
  | "user-badge"
  | "agent-redeem";

const supportedTargets = new Set<ImportTarget>([
  "user",
  "reward-setting",
  "modules",
  "badge",
  "user-badge",
  "agent-redeem",
]);

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) {
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      throw new Error(`Parametro sem valor: ${current}`);
    }

    args.set(current.slice(2), next);
    index += 1;
  }

  return args;
}

function toDate(value: unknown) {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return undefined;
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "t", "1", "yes", "y", "active"].includes(normalized)) {
      return true;
    }
    if (["false", "f", "0", "no", "n", "inactive"].includes(normalized)) {
      return false;
    }
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  return fallback;
}

function normalizeRows(input: unknown) {
  if (Array.isArray(input)) {
    return input as JsonRow[];
  }

  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    if (Array.isArray(record.rows)) {
      return record.rows as JsonRow[];
    }
    if (Array.isArray(record.data)) {
      return record.data as JsonRow[];
    }
  }

  throw new Error("JSON invalido. Use um arquivo com array de objetos ou { rows: [...] }.");
}

async function readJsonRows(filePath: string) {
  const absolutePath = resolve(filePath);
  const content = await readFile(absolutePath, "utf8");
  return normalizeRows(JSON.parse(content));
}

async function ensureAgentRedeemTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AgentRedeem" (
      "id" SERIAL PRIMARY KEY,
      "technicalId" TEXT NOT NULL,
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
}

async function importUsers(rows: JsonRow[]) {
  for (const row of rows) {
    const id = toNumber(row.id);
    await prisma.user.upsert({
      where: { id },
      update: {
        discordId: String(row.discordId ?? ""),
        twitchId: row.twitchId ? String(row.twitchId) : null,
        currentWarns: toNumber(row.currentWarns),
        totalWarns: toNumber(row.totalWarns),
        totalPunishments: toNumber(row.totalPunishments),
        isTwitchSub: toBoolean(row.isTwitchSub),
        isDiscordBooster: toBoolean(row.isDiscordBooster),
        isModerator: toBoolean(row.isModerator),
        hoursWatched: toNumber(row.hoursWatched),
        balance: toNumber(row.balance, 100),
        balancemultiplier: toNumber(row.balancemultiplier, 1),
        lastSeenInChat: toDate(row.lastSeenInChat) ?? null,
        createdAt: toDate(row.createdAt),
        updatedAt: toDate(row.updatedAt),
      },
      create: {
        id,
        discordId: String(row.discordId ?? ""),
        twitchId: row.twitchId ? String(row.twitchId) : null,
        currentWarns: toNumber(row.currentWarns),
        totalWarns: toNumber(row.totalWarns),
        totalPunishments: toNumber(row.totalPunishments),
        isTwitchSub: toBoolean(row.isTwitchSub),
        isDiscordBooster: toBoolean(row.isDiscordBooster),
        isModerator: toBoolean(row.isModerator),
        hoursWatched: toNumber(row.hoursWatched),
        balance: toNumber(row.balance, 100),
        balancemultiplier: toNumber(row.balancemultiplier, 1),
        lastSeenInChat: toDate(row.lastSeenInChat) ?? null,
        createdAt: toDate(row.createdAt),
        updatedAt: toDate(row.updatedAt),
      },
    });
  }
}

async function importRewardSettings(rows: JsonRow[]) {
  for (const row of rows) {
    const id = toNumber(row.id);
    await prisma.rewardSetting.upsert({
      where: { id },
      update: {
        key: String(row.key ?? ""),
        cost: toNumber(row.cost),
        enabled: toBoolean(row.enabled, true),
        createdAt: toDate(row.createdAt),
        updatedAt: toDate(row.updatedAt),
      },
      create: {
        id,
        key: String(row.key ?? ""),
        cost: toNumber(row.cost),
        enabled: toBoolean(row.enabled, true),
        createdAt: toDate(row.createdAt),
        updatedAt: toDate(row.updatedAt),
      },
    });
  }
}

async function importModules(rows: JsonRow[]) {
  for (const row of rows) {
    const id = toNumber(row.id);
    await prisma.modules.upsert({
      where: { id },
      update: {
        key: String(row.key ?? ""),
        enabled: toBoolean(row.enabled, true),
        createdAt: toDate(row.createdAt),
        updatedAt: toDate(row.updatedAt),
      },
      create: {
        id,
        key: String(row.key ?? ""),
        enabled: toBoolean(row.enabled, true),
        createdAt: toDate(row.createdAt),
        updatedAt: toDate(row.updatedAt),
      },
    });
  }
}

async function importBadges(rows: JsonRow[]) {
  for (const row of rows) {
    const id = toNumber(row.id);
    await prisma.badge.upsert({
      where: { id },
      update: {
        key: String(row.key ?? ""),
        name: String(row.name ?? ""),
        description: row.description ? String(row.description) : null,
        iconUrl: row.iconUrl ? String(row.iconUrl) : null,
        active: toBoolean(row.active, true),
        createdAt: toDate(row.createdAt),
        updatedAt: toDate(row.updatedAt),
      },
      create: {
        id,
        key: String(row.key ?? ""),
        name: String(row.name ?? ""),
        description: row.description ? String(row.description) : null,
        iconUrl: row.iconUrl ? String(row.iconUrl) : null,
        active: toBoolean(row.active, true),
        createdAt: toDate(row.createdAt),
        updatedAt: toDate(row.updatedAt),
      },
    });
  }
}

async function importUserBadges(rows: JsonRow[]) {
  for (const row of rows) {
    const id = toNumber(row.id);
    await prisma.userBadge.upsert({
      where: { id },
      update: {
        userId: toNumber(row.userId),
        badgeId: toNumber(row.badgeId),
        equipped: toBoolean(row.equipped),
        displayOrder: toNumber(row.displayOrder),
        source: row.source ? String(row.source) : null,
        note: row.note ? String(row.note) : null,
        acquiredAt: toDate(row.acquiredAt),
        createdAt: toDate(row.createdAt),
        updatedAt: toDate(row.updatedAt),
      },
      create: {
        id,
        userId: toNumber(row.userId),
        badgeId: toNumber(row.badgeId),
        equipped: toBoolean(row.equipped),
        displayOrder: toNumber(row.displayOrder),
        source: row.source ? String(row.source) : null,
        note: row.note ? String(row.note) : null,
        acquiredAt: toDate(row.acquiredAt),
        createdAt: toDate(row.createdAt),
        updatedAt: toDate(row.updatedAt),
      },
    });
  }
}

async function importAgentRedeems(rows: JsonRow[]) {
  await ensureAgentRedeemTable();

  for (const row of rows) {
    const technicalId = String(row.technicalId ?? "");
    if (!technicalId) {
      continue;
    }

    await prisma.$executeRaw`
      INSERT INTO "AgentRedeem" ("technicalId", "displayName", "thumbnailUrl", "fallbackThumbnailUrl", "status", "rewardType", "agentId", "payloadJson", "createdAt", "updatedAt")
      VALUES (
        ${technicalId},
        ${String(row.displayName ?? "")},
        ${row.thumbnailUrl ? String(row.thumbnailUrl) : null},
        ${row.fallbackThumbnailUrl ? String(row.fallbackThumbnailUrl) : null},
        ${toBoolean(row.status, true)},
        ${String(row.rewardType ?? "voicemod_voice")},
        ${String(row.agentId ?? "")},
        ${typeof row.payloadJson === "string" ? row.payloadJson : JSON.stringify(row.payloadJson ?? {})},
        ${toDate(row.createdAt) ?? new Date()},
        ${toDate(row.updatedAt) ?? new Date()}
      )
      ON CONFLICT ("rewardType", "technicalId")
      DO UPDATE SET
        "displayName" = EXCLUDED."displayName",
        "thumbnailUrl" = EXCLUDED."thumbnailUrl",
        "fallbackThumbnailUrl" = EXCLUDED."fallbackThumbnailUrl",
        "status" = EXCLUDED."status",
        "rewardType" = EXCLUDED."rewardType",
        "agentId" = EXCLUDED."agentId",
        "payloadJson" = EXCLUDED."payloadJson",
        "updatedAt" = EXCLUDED."updatedAt"
    `;
  }
}

async function resetSequences() {
  await prisma.$executeRawUnsafe(`
    SELECT setval(pg_get_serial_sequence('"User"', 'id'), COALESCE((SELECT MAX("id") FROM "User"), 1), true)
  `).catch(() => {});

  await prisma.$executeRawUnsafe(`
    SELECT setval(pg_get_serial_sequence('"RewardSetting"', 'id'), COALESCE((SELECT MAX("id") FROM "RewardSetting"), 1), true)
  `).catch(() => {});

  await prisma.$executeRawUnsafe(`
    SELECT setval(pg_get_serial_sequence('"Modules"', 'id'), COALESCE((SELECT MAX("id") FROM "Modules"), 1), true)
  `).catch(() => {});

  await prisma.$executeRawUnsafe(`
    SELECT setval(pg_get_serial_sequence('"Badge"', 'id'), COALESCE((SELECT MAX("id") FROM "Badge"), 1), true)
  `).catch(() => {});

  await prisma.$executeRawUnsafe(`
    SELECT setval(pg_get_serial_sequence('"UserBadge"', 'id'), COALESCE((SELECT MAX("id") FROM "UserBadge"), 1), true)
  `).catch(() => {});

  await prisma.$executeRawUnsafe(`
    SELECT setval(pg_get_serial_sequence('"AgentRedeem"', 'id'), COALESCE((SELECT MAX("id") FROM "AgentRedeem"), 1), true)
  `).catch(() => {});
}

async function runImport(target: ImportTarget, filePath: string) {
  const rows = await readJsonRows(filePath);

  switch (target) {
    case "user":
      await importUsers(rows);
      break;
    case "reward-setting":
      await importRewardSettings(rows);
      break;
    case "modules":
      await importModules(rows);
      break;
    case "badge":
      await importBadges(rows);
      break;
    case "user-badge":
      await importUserBadges(rows);
      break;
    case "agent-redeem":
      await importAgentRedeems(rows);
      break;
    default:
      throw new Error(`Target nao suportado: ${target}`);
  }

  console.log(`[import] ${target}: ${rows.length} registro(s) processados de ${filePath}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const importPairs = [...args.entries()]
    .filter(([key]) => supportedTargets.has(key as ImportTarget))
    .map(([key, value]) => [key as ImportTarget, value] as const);

  if (importPairs.length === 0) {
    console.log("Uso:");
    console.log('npm run db:import-json -- --user ".\\\\export\\\\User.json" --reward-setting ".\\\\export\\\\RewardSetting.json" --modules ".\\\\export\\\\Modules.json"');
    console.log('Opcional: --badge ".\\\\export\\\\Badge.json" --user-badge ".\\\\export\\\\UserBadge.json" --agent-redeem ".\\\\export\\\\AgentRedeem.json"');
    return;
  }

  for (const [target, filePath] of importPairs) {
    await runImport(target, filePath);
  }

  await resetSequences();
  console.log("[import] sequences ajustadas");
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
