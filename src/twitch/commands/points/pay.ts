import { appConfig } from "#config";
import { getTwitchUserById } from "#helix";
import { transferChannelPoints } from "../../../services/channelPointTransfers.js";
import { createTwitchCommand } from "../../base.js";

createTwitchCommand({
  name: "pay",
  description: "Transfere firecoins para outro usuario",
  async run(client, channel, tags, args) {
    const twitchId = tags["user-id"];
    const username = tags.username?.toLowerCase();

    if (!twitchId || !username) {
      await client.say(
        channel,
        "Nao consegui identificar sua conta da Twitch agora. Tente novamente em instantes."
      );
      return;
    }

    const targetInput = args[0];
    const amountInput = args[1];

    if (!targetInput || !amountInput) {
      await client.say(channel, `@${username}, uso: !pay <DiscordUser|DiscordID|TwitchID|TwitchNickname> <valor>`);
      return;
    }

    const amount = Number(amountInput);
    const result = await transferChannelPoints({
      senderTwitchId: twitchId,
      targetInput,
      amount,
    });

    if (!result.ok) {
      const messageByCode = {
        INVALID_AMOUNT: `@${username}, o valor precisa ser um numero inteiro maior que 0.`,
        SENDER_NOT_FOUND: `@${username}, sua conta nao foi encontrada no banco. Vincule sua conta no Discord com /link: ${appConfig.discord.inviteUrl}`,
        TARGET_NOT_FOUND: `@${username}, nao encontrei o usuario de destino. Verifique se o usuario já está vinculado ao nosso discord.`,
        SELF_TRANSFER: `@${username}, voce nao pode transferir firecoins para si mesmo.`,
        INSUFFICIENT_BALANCE: `@${username}, saldo insuficiente. Seu saldo atual e ${result.sender?.balance ?? 0} firecoins.`,
      } as const;

      await client.say(channel, messageByCode[result.code]);
      return;
    }

    const targetTwitchUser = result.target.twitchId
      ? await getTwitchUserById(result.target.twitchId)
      : null;
    const targetLabel = targetTwitchUser?.login
      ? `@${targetTwitchUser.login}`
      : "o usuario vinculado";

    await client.say(
      channel,
      `@${username}, transferencia concluida. ${result.amount} firecoins enviados para ${targetLabel}.`
    );
  },
});
