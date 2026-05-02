import { prisma } from "#database";

export type LinkedUserLookup = {
  discordId?: string;
  twitchId?: string;
};

function buildLinkedUserLookupWhere(lookup: LinkedUserLookup) {
  const or = [
    lookup.discordId ? { discordId: lookup.discordId } : null,
    lookup.twitchId ? { twitchId: lookup.twitchId } : null,
  ].filter((entry): entry is { discordId: string } | { twitchId: string } => entry !== null);

  if (or.length === 0) {
    return null;
  }

  return { OR: or };
}

export class WarningService {
  async findLinkedUser(lookup: LinkedUserLookup) {
    const where = buildLinkedUserLookupWhere(lookup);
    if (!where) {
      return null;
    }

    return prisma.user.findFirst({ where });
  }

  async incrementWarning(userId: number) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        currentWarns: { increment: 1 },
        totalWarns: { increment: 1 },
      },
    });
  }

  async registerPunishmentAndResetWarns(userId: number) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        currentWarns: 0,
        totalPunishments: { increment: 1 },
      },
    });
  }
}

export const warningService = new WarningService();
