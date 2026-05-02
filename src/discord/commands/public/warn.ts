import { createCommand } from "#base";
import { moderationService } from "../../../services/moderationService.js";
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
      name: "usuario",
      description: "Selecione o usuario do Discord",
      type: ApplicationCommandOptionType.User,
      required: false,
    },
    {
      name: "alvo",
      description: "Discord ID, mencao, nick, Twitch login ou Twitch ID",
      type: ApplicationCommandOptionType.String,
      required: false,
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

    const selectedUser = interaction.options.getUser("usuario");
    const targetText = interaction.options.getString("alvo");
    const reason = interaction.options.getString("motivo", true).trim();

    if (!selectedUser && !targetText) {
      await interaction.editReply({
        content: "Informe um usuario do Discord ou um alvo em texto.",
      });
      return;
    }

    const target = await moderationService.resolveDiscordTarget({
      guild: interaction.guild,
      selectedDiscordUserId: selectedUser?.id,
      searchText: targetText,
    });

    if (!target) {
      await interaction.editReply({
        content: "Nao consegui resolver o usuario informado no Discord ou na Twitch.",
      });
      return;
    }

    const result = await moderationService.warn({
      target,
      moderator: {
        platform: "discord",
        id: interaction.user.id,
        name: interaction.user.username,
      },
      reason,
    });

    if (result.status === "unlinked_direct_punishment") {
      await interaction.editReply({
        content: `Usuario nao vinculado. Punicao direta aplicada por ${result.durationLabel}.`,
      });
      return;
    }

    if (result.status === "warned_and_punished") {
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
