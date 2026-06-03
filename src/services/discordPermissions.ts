import {
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type PermissionsBitField,
} from "discord.js";

export function hasDiscordModeratorAccess(
  memberPermissions: Readonly<PermissionsBitField> | null | undefined
) {
  return (
    memberPermissions?.has(PermissionFlagsBits.Administrator) === true ||
    memberPermissions?.has(PermissionFlagsBits.ModerateMembers) === true
  );
}

export async function ensureDiscordModeratorAccess(
  interaction: ChatInputCommandInteraction,
  deniedMessage = "Apenas administradores ou moderadores podem usar este comando."
) {
  if (hasDiscordModeratorAccess(interaction.memberPermissions)) {
    return true;
  }

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ content: deniedMessage });
  } else {
    await interaction.reply({ content: deniedMessage, ephemeral: true });
  }

  return false;
}
