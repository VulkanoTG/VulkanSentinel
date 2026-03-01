import { createCommand } from "#base";
import { prisma } from "#database";
import { getTwitchUserById } from "#helix";
import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    EmbedBuilder,
    PermissionFlagsBits
} from "discord.js";

createCommand({
  name: "profile",
  description: "Mostra o perfil de um usuário",
  type: ApplicationCommandType.ChatInput,
defaultMemberPermissions: PermissionFlagsBits.ManageMessages,
  options: [
    {
      name: "user",
      description: "Discord User, Discord ID ou Twitch ID",
      type: ApplicationCommandOptionType.String,
      required: true
    }
  ],

  async run(interaction) {
    const input = interaction.options.getString("user", true);

    //Limpa formatação do nome de usuário
    const cleaned = input.replace(/[<@!>]/g, "");

    let user = await prisma.user.findUnique({
      where: { discordId: cleaned }
    });

    if (!user) {
      user = await prisma.user.findFirst({
        where: { twitchId: cleaned }
      });
    }

    if (!user) {
      await interaction.reply({
        content: "Usuário não encontrado no banco.",
        ephemeral: true
      });
      return;
    }

    let twitchDisplayName = "Não vinculado";
    //let twitchAvatar: string | null = null;

    if (user.twitchId) {
      const twitchData = await getTwitchUserById(user.twitchId);

      if (twitchData) {
        twitchDisplayName = twitchData.display_name;
        //twitchAvatar = twitchData.profile_image_url;
      }
    }
    const embed = new EmbedBuilder()
      .setTitle("Perfil do Usuário")
      .addFields(
        { name: "Discord ID", value: user.discordId, inline: false },
        { name: "Twitch ID", value: user.twitchId ?? "Não vinculado", inline: false },
        { name: "Twitch Name", value: twitchDisplayName, inline: true },
        { name: "Saldo", value: String(user.balance ?? 0), inline: true },
        { name: "Horas Assistidas", value: String(user.hoursWatched ?? 0), inline: true }
      )
      .setFooter({ text: `ID interno: ${user.id}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
});