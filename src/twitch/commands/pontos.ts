import { appConfig } from "#config";
import { prisma } from "#database";
import { createTwitchCommand } from "../base.js";

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
      select: { balance: true },
    });

    if (!user) {
      await client.say(
        channel,
        `@${username}, para ganhar e consultar seus firecoins, conecte sua conta no Discord com /link. Entre aqui: ${appConfig.discord.inviteUrl}`
      );
      return;
    }

    await client.say(
      channel,
      `@${username}, voce tem ${user.balance} firecoins.`
    );
  },
});
