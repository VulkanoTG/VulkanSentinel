import { appConfig } from "#config";
import { prisma } from "#database";

export const rewardSettingDefinitions = {
  soundalert: {
    id: "reward-soundalert",
    title: "Sound Alert da live",
    description: "Base para tocar efeitos sonoros personalizados ao vivo via resgate de firecoins.",
    defaultCost: appConfig.rewards.soundalertCost,
  },
  voicemod: {
    id: "reward-voicemod",
    title: "Troque minha voz",
    description: "Mude minha voz por uma voz do catalogo! cada resgate dura 5 minutos e pode ser extendido até o final da live!",
    defaultCost: appConfig.rewards.voicemodCost,
  },
  spotifyQueue: {
    id: "reward-spotify",
    title: "Pedido de musica no Spotify",
    description: "Escolha uma musica para ouvirmos  juntos!",
    defaultCost: appConfig.rewards.spotifyQueueCost,
  },
  chaos: {
    id: "reward-chaos",
    title: "Teclado Maluco",
    description: "Ative o teclado maluico, ative por 5 minutos um bug no meu teclado que faz com que a cada minuto as teclas de movimentação do jogo sejam trocadas, limite de 20min",
    defaultCost: appConfig.rewards.chaosCost,
  },
  mouseAxesInvert: {
    id: "reward-mouse-axes-invert",
    title: "Mouse Invertido",
    description: "De repente meu mouse ficou invertido?, mude a forma com que meu mouse se comporta ao movimentar, limite 5min",
    defaultCost: appConfig.rewards.mouseAxesInvertCost,
  },
} as const;

export type RewardSettingKey = keyof typeof rewardSettingDefinitions;

type RewardSettingRecord = {
  key: RewardSettingKey;
  cost: number;
  enabled: boolean;
};

let ensureRewardSettingsTablePromise: Promise<void> | null = null;

function isRewardSettingKey(value: string): value is RewardSettingKey {
  return value in rewardSettingDefinitions;
}

async function ensureRewardSettingsTable() {
  if (!ensureRewardSettingsTablePromise) {
    ensureRewardSettingsTablePromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "RewardSetting" (
          "id" SERIAL PRIMARY KEY,
          "key" TEXT NOT NULL UNIQUE,
          "cost" INTEGER NOT NULL,
          "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "RewardSetting"
        ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT TRUE
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "RewardSetting"
        ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "RewardSetting"
        ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "RewardSetting"
        ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "RewardSetting"
        ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP
      `);

      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION update_reward_setting_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW."updatedAt" = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql'
      `);

      await prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS "RewardSetting_set_updatedAt" ON "RewardSetting"
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER "RewardSetting_set_updatedAt"
        BEFORE UPDATE ON "RewardSetting"
        FOR EACH ROW
        EXECUTE FUNCTION update_reward_setting_updated_at()
      `);
    })().catch((error) => {
      ensureRewardSettingsTablePromise = null;
      throw error;
    });
  }

  await ensureRewardSettingsTablePromise;
}

export async function getRewardSettings() {
  await ensureRewardSettingsTable();

  const rows = await prisma.$queryRaw<Array<{ key: string; cost: number; enabled: boolean }>>`
    SELECT "key", "cost", "enabled"
    FROM "RewardSetting"
  `;

  const rewardMap = new Map<RewardSettingKey, { cost: number; enabled: boolean }>();

  for (const row of rows) {
    if (isRewardSettingKey(row.key)) {
      rewardMap.set(row.key, {
        cost: row.cost,
        enabled: row.enabled,
      });
    }
  }

  return (Object.entries(rewardSettingDefinitions) as Array<[RewardSettingKey, (typeof rewardSettingDefinitions)[RewardSettingKey]]>).map(
    ([key, definition]) => ({
      key,
      ...definition,
      cost: rewardMap.get(key)?.cost ?? definition.defaultCost,
      enabled: rewardMap.get(key)?.enabled ?? true,
    })
  );
}

export async function getRewardSetting(key: RewardSettingKey) {
  await ensureRewardSettingsTable();

  const rows = await prisma.$queryRaw<Array<{ cost: number; enabled: boolean }>>`
    SELECT "cost", "enabled"
    FROM "RewardSetting"
    WHERE "key" = ${key}
    LIMIT 1
  `;

  return {
    key,
    cost: rows[0]?.cost ?? rewardSettingDefinitions[key].defaultCost,
    enabled: rows[0]?.enabled ?? true,
  };
}

export async function getRewardPrice(key: RewardSettingKey) {
  const setting = await getRewardSetting(key);
  return setting.cost;
}

export async function updateRewardPrice(key: RewardSettingKey, cost: number): Promise<RewardSettingRecord> {
  return updateRewardSetting(key, { cost });
}

export async function updateRewardEnabled(key: RewardSettingKey, enabled: boolean): Promise<RewardSettingRecord> {
  return updateRewardSetting(key, { enabled });
}

export async function updateRewardSetting(
  key: RewardSettingKey,
  input: { cost?: number; enabled?: boolean }
): Promise<RewardSettingRecord> {
  await ensureRewardSettingsTable();

  const current = await getRewardSetting(key);
  const nextCost = input.cost ?? current.cost;
  const nextEnabled = input.enabled ?? current.enabled;

  const rows = await prisma.$queryRaw<Array<{ key: string; cost: number; enabled: boolean }>>`
    INSERT INTO "RewardSetting" ("key", "cost", "enabled", "createdAt", "updatedAt")
    VALUES (${key}, ${nextCost}, ${nextEnabled}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("key")
    DO UPDATE SET
      "cost" = EXCLUDED."cost",
      "enabled" = EXCLUDED."enabled",
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "key", "cost", "enabled"
  `;

  return {
    key,
    cost: rows[0]?.cost ?? nextCost,
    enabled: rows[0]?.enabled ?? nextEnabled,
  };
}
