import { createCommand } from "#base";
import { moderationService } from "../../../services/moderationService.js";
import { DiscordModerationPermissionError } from "../../../services/punishmentService.js";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  PermissionFlagsBits,
} from "discord.js";

createCommand({
  name: "warn",
  description: "Aplica um warning progressivo ou punicao direta em usuario nao vinculado",
  type: ApplicationCommandType.ChatInput,
  defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
  options: [
    {
      name: "nick",
      description: "Nick, mencao, ID do Discord, login da Twitch ou Twitch ID",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: "motivo",
      description: "Motivo do warning",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],

  async run(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.guild) {
      await interaction.editReply({
        content: "Esse comando precisa ser usado dentro do servidor.",
      });
      return;
    }

    const targetText = interaction.options.getString("nick", true);
    const reason = interaction.options.getString("motivo", true).trim();

    const target = await moderationService.resolveDiscordTarget({
      guild: interaction.guild,
      searchText: targetText,
    });

    if (!target) {
      await interaction.editReply({
        content: "Nao consegui resolver o usuario informado no Discord ou na Twitch.",
      });
      return;
    }

    let result;
    try {
      result = await moderationService.warn({
        target,
        moderator: {
          platform: "discord",
          id: interaction.user.id,
          name: interaction.user.username,
        },
        reason,
      });
    } catch (error) {
      if (error instanceof DiscordModerationPermissionError) {
        await interaction.editReply({
          content: error.message,
        });
        return;
      }

      throw error;
    }

    if (result.status === "unlinked_direct_punishment") {
      if (target.discordId) {
        await interaction.channel?.send({
          content: `<@${target.discordId}> esta tomando punicao direta por nao ter a conta vinculada. Aplicado: ${result.durationLabel}.`,
        }).catch(() => null);
      }

      await interaction.editReply({
        content: `Usuario nao vinculado. Punicao direta aplicada por ${result.durationLabel}.`,
      });
      return;
    }

    if (result.status === "warned_and_punished") {
      if (target.discordId) {
        await interaction.channel?.send({
          content: `<@${target.discordId}> atingiu o limite de warns e recebeu punicao automatica por ${result.durationLabel}.`,
        }).catch(() => null);
      }

      await interaction.editReply({
        content: `Warning registrado e limite de ${result.threshold} warns atingido. Punicao automatica aplicada por ${result.durationLabel}. Total de punicoes: ${result.totalPunishments}.`,
      });
      return;
    }

    await interaction.editReply({
      content: `Warning aplicado com sucesso. Warns atuais: ${result.currentWarns}/${result.threshold}. Total historico: ${result.totalWarns}.`,
    });
  },
});
