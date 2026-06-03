import { prisma } from "#database";

const DEFAULT_EQUIPPED_BADGES_LIMIT = 3;

export type UserBadgeView = {
  key: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  active: boolean;
  equipped: boolean;
  displayOrder: number;
  source: string | null;
  note: string | null;
  acquiredAt: string;
};

function normalizeBadgeKey(key: string) {
  return key.trim().toLowerCase();
}

function mapUserBadge(
  row: {
    equipped: boolean;
    displayOrder: number;
    source: string | null;
    note: string | null;
    acquiredAt: Date;
    badge: {
      key: string;
      name: string;
      description: string | null;
      iconUrl: string | null;
      active: boolean;
    };
  }
): UserBadgeView {
  return {
    key: row.badge.key,
    name: row.badge.name,
    description: row.badge.description,
    iconUrl: row.badge.iconUrl,
    active: row.badge.active,
    equipped: row.equipped,
    displayOrder: row.displayOrder,
    source: row.source,
    note: row.note,
    acquiredAt: row.acquiredAt.toISOString(),
  };
}

export async function ensureBadgeCatalogEntry(input: {
  key: string;
  name: string;
  description?: string | null;
  iconUrl?: string | null;
  active?: boolean;
}) {
  const key = normalizeBadgeKey(input.key);

  return prisma.badge.upsert({
    where: { key },
    update: {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      iconUrl: input.iconUrl?.trim() || null,
      active: input.active ?? true,
    },
    create: {
      key,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      iconUrl: input.iconUrl?.trim() || null,
      active: input.active ?? true,
    },
  });
}

export async function listBadgeCatalog() {
  return prisma.badge.findMany({
    orderBy: [
      { active: "desc" },
      { name: "asc" },
    ],
  });
}

export async function listUserBadges(userId: number, input?: { equippedOnly?: boolean }) {
  const rows = await prisma.userBadge.findMany({
    where: {
      userId,
      ...(input?.equippedOnly ? { equipped: true } : {}),
    },
    include: {
      badge: true,
    },
    orderBy: [
      { equipped: "desc" },
      { displayOrder: "asc" },
      { acquiredAt: "asc" },
    ],
  });

  return rows.map(mapUserBadge);
}

export async function awardBadgeToUser(input: {
  userId: number;
  badgeKey: string;
  source?: string | null;
  note?: string | null;
  equipped?: boolean;
  displayOrder?: number;
}) {
  const badge = await prisma.badge.findUnique({
    where: { key: normalizeBadgeKey(input.badgeKey) },
  });

  if (!badge) {
    throw new Error(`Badge ${input.badgeKey} nao encontrada no catalogo.`);
  }

  const userBadge = await prisma.userBadge.upsert({
    where: {
      userId_badgeId: {
        userId: input.userId,
        badgeId: badge.id,
      },
    },
    update: {
      source: input.source?.trim() || undefined,
      note: input.note?.trim() || undefined,
      ...(typeof input.equipped === "boolean" ? { equipped: input.equipped } : {}),
      ...(typeof input.displayOrder === "number" ? { displayOrder: input.displayOrder } : {}),
    },
    create: {
      userId: input.userId,
      badgeId: badge.id,
      source: input.source?.trim() || null,
      note: input.note?.trim() || null,
      equipped: input.equipped ?? false,
      displayOrder: input.displayOrder ?? 0,
    },
    include: {
      badge: true,
    },
  });

  return mapUserBadge(userBadge);
}

export async function revokeBadgeFromUser(input: {
  userId: number;
  badgeKey: string;
}) {
  const badge = await prisma.badge.findUnique({
    where: { key: normalizeBadgeKey(input.badgeKey) },
    select: { id: true },
  });

  if (!badge) {
    return false;
  }

  const result = await prisma.userBadge.deleteMany({
    where: {
      userId: input.userId,
      badgeId: badge.id,
    },
  });

  return result.count > 0;
}

export async function setEquippedBadges(input: {
  userId: number;
  badgeKeys: string[];
  limit?: number;
}) {
  const limit = Math.max(1, input.limit ?? DEFAULT_EQUIPPED_BADGES_LIMIT);
  const normalizedKeys = Array.from(
    new Set(input.badgeKeys.map(normalizeBadgeKey))
  ).slice(0, limit);

  const ownedBadges = await prisma.userBadge.findMany({
    where: { userId: input.userId },
    include: { badge: true },
  });

  const ownedByKey = new Map<string, (typeof ownedBadges)[number]>(
    ownedBadges.map((row) => [row.badge.key, row])
  );
  for (const key of normalizedKeys) {
    if (!ownedByKey.has(key)) {
      throw new Error(`Usuario nao possui a badge ${key}.`);
    }
  }

  await prisma.$transaction([
    prisma.userBadge.updateMany({
      where: { userId: input.userId },
      data: {
        equipped: false,
        displayOrder: 0,
      },
    }),
    ...normalizedKeys.map((key, index) =>
      prisma.userBadge.update({
        where: {
          id: ownedByKey.get(key)!.id,
        },
        data: {
          equipped: true,
          displayOrder: index,
        },
      })
    ),
  ]);

  return listUserBadges(input.userId, { equippedOnly: true });
}
