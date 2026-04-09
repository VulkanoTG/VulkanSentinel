import { createCommand } from "#base";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import { readTicketMetadata, updateTicketMetadata } from "../../../services/tickets.js";

createCommand({
  name: "transferir",
  description: "Transfere um ticket para outro administrador",
  type: ApplicationCommandType.ChatInput,
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
  options: [
    {
      name: "admin",
      description: "Mencao, ID, nick ou username do administrador",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],

  async run(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: "Esse comando precisa ser usado no servidor.",
        ephemeral: true,
      });
      return;
    }

    if (!(interaction.channel instanceof TextChannel)) {
      await interaction.reply({
        content: "Esse comando so funciona em um canal de ticket.",
        ephemeral: true,
      });
      return;
    }

    const metadata = readTicketMetadata(interaction.channel);
    if (!metadata) {
      await interaction.reply({
        content: "Esse canal nao parece ser um ticket valido.",
        ephemeral: true,
      });
      return;
    }

    const input = interaction.options.getString("admin", true).replace(/[<@!>]/g, "").trim().toLowerCase();
    const members = await interaction.guild.members.fetch();

    const targetMember = members.find((member) => {
      return (
        member.id === input ||
        member.nickname?.toLowerCase() === input ||
        member.displayName.toLowerCase() === input ||
        member.user.username.toLowerCase() === input ||
        member.user.globalName?.toLowerCase() === input
      );
    });

    if (!targetMember) {
      await interaction.reply({
        content: "Administrador nao encontrado.",
        ephemeral: true,
      });
      return;
    }

    if (!targetMember.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: "O usuario encontrado nao tem permissao de administrador.",
        ephemeral: true,
      });
      return;
    }

    await updateTicketMetadata(interaction.channel, {
      acceptedById: targetMember.id,
      status: "accepted",
    });

    await interaction.reply({
      content: `Ticket #${metadata.ticketId} transferido para ${targetMember}.`,
    });
  },
});
