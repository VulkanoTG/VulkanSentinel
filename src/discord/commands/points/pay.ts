import { createCommand } from "#base";
import { appConfig } from "#config";
import { transferChannelPoints } from "../../../services/channelPointTransfers.js";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";

createCommand({
  name: "pay",
  description: "Transfere firecoins para outro usuario",
  type: ApplicationCommandType.ChatInput,
  defaultMemberPermissions: PermissionFlagsBits.SendMessages,
  options: [
    {
      name: "usuario",
      description: "DiscordUser, DiscordID, TwitchID ou TwitchNickname",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: "valor",
      description: "Valor inteiro a transferir",
      type: ApplicationCommandOptionType.Integer,
      required: true,
      minValue: 1,
    },
  ],

  async run(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const targetInput = interaction.options.getString("usuario", true);
    const amount = interaction.options.getInteger("valor", true);
    const result = await transferChannelPoints({
      senderDiscordId: interaction.user.id,
      targetInput,
      amount,
    });

    if (!result.ok) {
      const messageByCode = {
        INVALID_AMOUNT: "O valor precisa ser um numero inteiro maior que 0.",
        SENDER_NOT_FOUND: "Sua conta nao foi encontrada no banco. Use /link antes de tentar transferir firecoins.",
        TARGET_NOT_FOUND: "Nao encontrei o usuario de destino no banco. Verifique se o Discord/Twitch informado esta vinculado.",
        SELF_TRANSFER: "Voce nao pode transferir firecoins para si mesmo.",
        INSUFFICIENT_BALANCE: `Saldo insuficiente. Seu saldo atual e ${appConfig.discord.profile.fireCoinsEmoji} ${result.sender?.balance ?? 0}.`,
      } as const;

      await interaction.editReply({
        content: messageByCode[result.code],
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(appConfig.discord.points.embedColor)
      .setTitle("Transferencia Concluida")
      .setDescription(
        `${appConfig.discord.profile.fireCoinsEmoji} ${result.amount} enviados para <@${result.target.discordId}>.`
      )
      .addFields(
        { name: "Remetente", value: `<@${result.sender.discordId}>`, inline: true },
        { name: "Destinatario", value: `<@${result.target.discordId}>`, inline: true },
        { name: "Valor", value: `${result.amount}`, inline: true },
        { name: "Seu saldo agora", value: `${appConfig.discord.profile.fireCoinsEmoji} ${result.senderBalanceAfter}`, inline: true },
        { name: "Saldo do destinatario", value: `${appConfig.discord.profile.fireCoinsEmoji} ${result.targetBalanceAfter}`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed],
    });
  },
});
