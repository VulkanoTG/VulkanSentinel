import { createCommand } from "#base";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  GuildMember,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import { readTicketMetadata, updateTicketMetadata } from "../../../services/tickets.js";

async function resolveTargetAdmin(channel: TextChannel, input: string) {
  const normalizedInput = input.replace(/[<@!>]/g, "").trim().toLowerCase();

  if (/^\d+$/.test(normalizedInput)) {
    const member = await channel.guild.members.fetch(normalizedInput).catch(() => null);
    if (member) return member;
  }

  const cachedMember =
    channel.guild.members.cache.find((member) => {
      return (
        member.nickname?.toLowerCase() === normalizedInput ||
        member.displayName.toLowerCase() === normalizedInput ||
        member.user.username.toLowerCase() === normalizedInput ||
        member.user.globalName?.toLowerCase() === normalizedInput
      );
    }) ?? null;

  if (cachedMember) return cachedMember;

  const [searchByUsername, searchByNickname] = await Promise.all([
    channel.guild.members.search({ query: normalizedInput, limit: 10 }).catch(() => null),
    channel.guild.members.fetch({ query: normalizedInput, limit: 10 }).catch(() => null),
  ]);

  return (
    searchByUsername?.find((member) => {
      return (
        member.nickname?.toLowerCase() === normalizedInput ||
        member.displayName.toLowerCase() === normalizedInput ||
        member.user.username.toLowerCase() === normalizedInput ||
        member.user.globalName?.toLowerCase() === normalizedInput
      );
    }) ??
    Array.from(searchByNickname?.values() ?? []).find((member: GuildMember) => {
      return (
        member.nickname?.toLowerCase() === normalizedInput ||
        member.displayName.toLowerCase() === normalizedInput ||
        member.user.username.toLowerCase() === normalizedInput ||
        member.user.globalName?.toLowerCase() === normalizedInput
      );
    }) ??
    null
  );
}

createCommand({
  name: "transferir",
  description: "Transfere um ticket para outro administrador",
  type: ApplicationCommandType.ChatInput,
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
  options: [
    {
      name: "admin",
      description: "Menção, ID, nick ou username do administrador",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],

  async run(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.guild) {
      await interaction.editReply({
        content: "Esse comando precisa ser usado no servidor.",
      });
      return;
    }

    if (!(interaction.channel instanceof TextChannel)) {
      await interaction.editReply({
        content: "Esse comando so funciona em um canal de ticket.",
      });
      return;
    }

    const metadata = readTicketMetadata(interaction.channel);
    if (!metadata) {
      await interaction.editReply({
        content: "Esse canal nao parece ser um ticket valido.",
      });
      return;
    }

    if (metadata.status !== "accepted" || !metadata.acceptedById) {
      await interaction.editReply({
        content: "Esse ticket precisa ser aceito por um staff antes de ser transferido.",
      });
      return;
    }

    const input = interaction.options.getString("admin", true);
    const targetMember = await resolveTargetAdmin(interaction.channel, input);

    if (!targetMember) {
      await interaction.editReply({
        content: "Administrador nao encontrado.",
      });
      return;
    }

    if (!targetMember.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.editReply({
        content: "O usuario encontrado nao tem permissao de administrador.",
      });
      return;
    }

    const updatedMetadata = await updateTicketMetadata(interaction.channel, {
      acceptedById: targetMember.id,
      status: "accepted",
    });

    if (!updatedMetadata) {
      await interaction.editReply({
        content: "Nao foi possivel atualizar os dados do ticket.",
      });
      return;
    }

    await interaction.editReply({
      content: `Ticket #${updatedMetadata.ticketId} transferido para ${targetMember}.`,
    });

    await interaction.channel.send({
      content: `Responsavel atual do ticket #${updatedMetadata.ticketId}: ${targetMember}.`,
    }).catch(() => null);
  },
});
