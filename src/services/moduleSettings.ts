import { prisma } from "#database";

export const moduleDefinitions = {
  partnerNotifier: {
    key: "partnerNotifier",
    title: "Partner Notifier",
    description: "Controla o envio de alertas de live dos parceiros para o Discord.",
  },
  sentinelCalloutOverlay: {
    key: "sentinelCalloutOverlay",
    title: "Sentinel Callout Overlay",
    description: "Controla o overlay de callouts automaticos da Sentinela.",
  },
  controlsInvertOverlay: {
    key: "controlsInvertOverlay",
    title: "Controls Invert Overlay",
    description: "Controla o overlay com contador da inversao de controles.",
  },
  mouseAxesInvertOverlay: {
    key: "mouseAxesInvertOverlay",
    title: "Mouse Axes Invert Overlay",
    description: "Controla o overlay com contador da inversao dos eixos do mouse.",
  },
  twitchChatDiscordRelay: {
    key: "twitchChatDiscordRelay",
    title: "Twitch Chat -> Discord",
    description: "Controla o espelhamento do chat da Twitch para o canal do Discord.",
  },
} as const;

export type ModuleKey = keyof typeof moduleDefinitions;

type ModuleSettingRecord = {
  key: ModuleKey;
  enabled: boolean;
};

let ensureModulesTablePromise: Promise<void> | null = null;
let moduleStateCache: Partial<Record<ModuleKey, boolean>> | null = null;

function isModuleKey(value: string): value is ModuleKey {
  return value in moduleDefinitions;
}

async function ensureModulesTable() {
  if (!ensureModulesTablePromise) {
    ensureModulesTablePromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Modules" (
          "id" SERIAL PRIMARY KEY,
          "key" TEXT NOT NULL UNIQUE,
          "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Modules"
        ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT TRUE
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Modules"
        ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Modules"
        ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Modules"
        ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Modules"
        ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP
      `);

      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION update_modules_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW."updatedAt" = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql'
      `);

      await prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS "Modules_set_updatedAt" ON "Modules"
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER "Modules_set_updatedAt"
        BEFORE UPDATE ON "Modules"
        FOR EACH ROW
        EXECUTE FUNCTION update_modules_updated_at()
      `);
    })().catch((error) => {
      ensureModulesTablePromise = null;
      throw error;
    });
  }

  await ensureModulesTablePromise;
}

async function seedMissingModules() {
  await ensureModulesTable();

  const keys = Object.keys(moduleDefinitions) as ModuleKey[];
  for (const key of keys) {
    await prisma.$executeRaw`
      INSERT INTO "Modules" ("key", "enabled", "createdAt", "updatedAt")
      VALUES (${key}, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("key") DO NOTHING
    `;
  }
}

async function loadModuleStateCache(force = false) {
  if (moduleStateCache && !force) {
    return moduleStateCache;
  }

  await seedMissingModules();

  const rows = await prisma.$queryRaw<Array<{ key: string; enabled: boolean }>>`
    SELECT "key", "enabled"
    FROM "Modules"
  `;

  const nextCache: Partial<Record<ModuleKey, boolean>> = {};

  for (const row of rows) {
    if (isModuleKey(row.key)) {
      nextCache[row.key] = row.enabled;
    }
  }

  for (const key of Object.keys(moduleDefinitions) as ModuleKey[]) {
    if (typeof nextCache[key] !== "boolean") {
      nextCache[key] = true;
    }
  }

  moduleStateCache = nextCache;
  return nextCache;
}

export async function getModuleSettings() {
  const cache = await loadModuleStateCache();

  return (Object.entries(moduleDefinitions) as Array<[ModuleKey, (typeof moduleDefinitions)[ModuleKey]]>).map(
    ([key, definition]) => ({
      ...definition,
      enabled: cache[key] ?? true,
    })
  );
}

export async function getModuleSetting(key: ModuleKey): Promise<ModuleSettingRecord> {
  const cache = await loadModuleStateCache();

  return {
    key,
    enabled: cache[key] ?? true,
  };
}

export async function isModuleEnabled(key: ModuleKey) {
  const setting = await getModuleSetting(key);
  return setting.enabled;
}

export async function updateModuleEnabled(key: ModuleKey, enabled: boolean): Promise<ModuleSettingRecord> {
  await ensureModulesTable();

  const rows = await prisma.$queryRaw<Array<{ key: string; enabled: boolean }>>`
    INSERT INTO "Modules" ("key", "enabled", "createdAt", "updatedAt")
    VALUES (${key}, ${enabled}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("key")
    DO UPDATE SET
      "enabled" = EXCLUDED."enabled",
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "key", "enabled"
  `;

  if (!moduleStateCache) {
    moduleStateCache = {};
  }

  moduleStateCache[key] = rows[0]?.enabled ?? enabled;

  return {
    key,
    enabled: rows[0]?.enabled ?? enabled,
  };
}
