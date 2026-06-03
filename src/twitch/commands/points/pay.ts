import { appConfig } from "#config";
import { getTwitchUserById } from "#helix";
import { transferChannelPoints } from "../../../services/channelPointTransfers.js";
import { sendBotChatMessage } from "../../../services/twitchChat.js";
import { createTwitchCommand } from "../../base.js";

createTwitchCommand({
  name: "pay",
  description: "Transfere Firecoins para outro usuário",
  async run(client, channel, tags, args) {
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

    const targetInput = args[0];
    const amountInput = args[1];

    if (!targetInput || !amountInput) {
      await sendBotChatMessage(client, channel, `@${username}, uso: !pay <DiscordUser|DiscordID|TwitchID|TwitchNickname> <valor>`);
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
        INVALID_AMOUNT: `@${username}, o valor precisa ser um número inteiro maior que 0.`,
        SENDER_NOT_FOUND: `@${username}, sua conta não foi encontrada no banco. Vincule sua conta ao Discord com /link: ${appConfig.discord.inviteUrl}`,
        TARGET_NOT_FOUND: `@${username}, não encontrei o usuário de destino. Verifique se ele já está vinculado ao nosso Discord.`,
        SELF_TRANSFER: `@${username}, você não pode transferir Firecoins para si mesmo.`,
        INSUFFICIENT_BALANCE: `@${username}, saldo insuficiente. Seu saldo atual é ${result.sender?.balance ?? 0} Firecoins.`,
      } as const;

      await sendBotChatMessage(client, channel, messageByCode[result.code]);
      return;
    }

    const targetTwitchUser = result.target.twitchId
      ? await getTwitchUserById(result.target.twitchId)
      : null;
    const targetLabel = targetTwitchUser?.login
      ? `@${targetTwitchUser.login}`
      : "o usuário vinculado";

    await sendBotChatMessage(
      client,
      channel,
      `@${username}, transferência concluída. ${result.amount} Firecoins enviados para ${targetLabel}.`
    );
  },
});
