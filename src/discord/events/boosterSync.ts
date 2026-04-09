import { createEvent } from "#base";
import { prisma } from "#database";
import { env } from "#env";

async function syncMemberBoosterStatus(discordId: string, isBooster: boolean) {
  await prisma.user.updateMany({
    where: { discordId },
    data: { isDiscordBooster: isBooster },
  });
}

async function syncGuildBoosters(guildId: string) {
  const guild = await (await import("../../services/discord.js")).getDiscordClient().guilds.fetch(guildId);
  const members = await guild.members.fetch();

  const memberIds = members.map((member) => member.id);
  const boosterIds = members
    .filter((member) => member.premiumSince !== null)
    .map((member) => member.id);

  if (memberIds.length > 0) {
    await prisma.user.updateMany({
      where: {
        discordId: { in: memberIds },
      },
      data: {
        isDiscordBooster: false,
      },
    });
  }

  if (boosterIds.length > 0) {
    await prisma.user.updateMany({
      where: {
        discordId: { in: boosterIds },
      },
      data: {
        isDiscordBooster: true,
      },
    });
  }

  console.log(`[Discord] Booster sync concluido. Boosters ativos: ${boosterIds.length}.`);
}

createEvent({
  name: "sync discord boosters on ready",
  event: "clientReady",
  once: true,
  async run() {
    if (!env.GUILD_ID) {
      console.warn("[Discord] GUILD_ID nao configurado. Pulando sync inicial de boosters.");
      return;
    }

    try {
      await syncGuildBoosters(env.GUILD_ID);
    } catch (error) {
      console.error("[Discord] Erro ao sincronizar boosters no startup:", error);
    }
  },
});

createEvent({
  name: "sync discord booster updates",
  event: "guildMemberUpdate",
  async run(oldMember, newMember) {
    const oldIsBooster = oldMember.premiumSince !== null;
    const newIsBooster = newMember.premiumSince !== null;

    if (oldIsBooster === newIsBooster) {
      return;
    }

    try {
      await syncMemberBoosterStatus(newMember.id, newIsBooster);
      console.log(
        `[Discord] Booster ${newIsBooster ? "ativado" : "removido"} para ${newMember.user.tag}.`
      );
    } catch (error) {
      console.error("[Discord] Erro ao sincronizar alteracao de booster:", error);
    }
  },
});
