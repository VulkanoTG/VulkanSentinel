import { appConfig } from "#config";
import { prisma } from "#database";
import { getChannelPointBreakdown } from "../../../services/channelPoints.js";
import { sendBotChatMessage } from "../../../services/twitchChat.js";
import { createTwitchCommand } from "../../base.js";

createTwitchCommand({
  name: "pontos",
  description: "Mostra quantos Firecoins o usuário tem",
  async run(client, channel, tags) {
    const twitchId = tags["user-id"];
    const username = tags.username?.toLowerCase();

    if (!twitchId || !username) {
      await sendBotChatMessage(
        client,
        channel,
        "Não consegui identificar sua conta da Twitch agora. Tente novamente em instantes."
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
      await sendBotChatMessage(
        client,
        channel,
        `@${username}, para ganhar e consultar seus Firecoins, conecte sua conta ao Discord com /link. Entre aqui: ${appConfig.discord.inviteUrl}`
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

    await sendBotChatMessage(
      client,
      channel,
      activeBonuses
        ? `@${username}, você tem ${user.balance} Firecoins. Bônus ativos: ${activeBonuses}.`
        : `@${username}, você tem ${user.balance} Firecoins.`
    );
  },
});
