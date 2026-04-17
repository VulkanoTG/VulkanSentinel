import { appConfig } from "#config";
import { prisma } from "#database";
import { getChannelPointBreakdown } from "../../../services/channelPoints.js";
import { createTwitchCommand } from "../../base.js";

createTwitchCommand({
  name: "pontos",
  description: "Mostra quantos firecoins o usuario tem",
  async run(client, channel, tags) {
    const twitchId = tags["user-id"];
    const username = tags.username?.toLowerCase();

    if (!twitchId || !username) {
      await client.say(
        channel,
        "Nao consegui identificar sua conta da Twitch agora. Tente novamente em instantes."
      );
      return;
    }

    const user = await prisma.user.findUnique({
      where: { twitchId },
      select: {
        balance: true,
        isTwitchSub: true,
        isDiscordBooster: true,
        balancemultiplier: true,
      },
    });

    if (!user) {
      await client.say(
        channel,
        `@${username}, para ganhar e consultar seus firecoins, conecte sua conta no Discord com /link. Entre aqui: ${appConfig.discord.inviteUrl}`
      );
      return;
    }

    const breakdown = getChannelPointBreakdown({
      isTwitchSub: user.isTwitchSub,
      isDiscordBooster: user.isDiscordBooster,
      balanceMultiplier: user.balancemultiplier,
    });

    const activeBonuses = breakdown.activeBonuses
      .filter((bonus) => bonus.value > 1)
      .map((bonus) => `${bonus.label} x${bonus.value}`)
      .join(", ");

    await client.say(
      channel,
      activeBonuses
        ? `@${username}, voce tem ${user.balance} firecoins. Bonus ativos: ${activeBonuses}.`
        : `@${username}, voce tem ${user.balance} firecoins.`
    );
  },
});
