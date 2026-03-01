import { createCommand } from "#base";
import { prisma } from "#database";
import { ApplicationCommandType } from "discord.js";

const devMode = true; // Defina como true para exibir a URL completa em vez de um link clicável

createCommand({
  name: "link",
  description: "Vincula sua conta da Twitch com Discord",
  type: ApplicationCommandType.ChatInput,

  async run(interaction) {
    const discordId = interaction.user.id;


    const user = await prisma.user.findUnique({
      where: { discordId }
    });


    if (user?.twitchId) {
      await interaction.reply({
        content: "Sua conta da Twitch já está vinculada.",
        ephemeral: true
      });
      return;
    }

    const twitchAuthUrl =
      `https://id.twitch.tv/oauth2/authorize` +
      `?client_id=${process.env.TWITCH_CLIENT_ID}` +
      `&redirect_uri=${process.env.TWITCH_REDIRECT_URI}` +
      `&response_type=code` +
      `&scope=` +
      `&state=${discordId}`;


    if (devMode) {
      await interaction.reply({
        content: `Clique aqui para vincular sua conta do Discord na Twitch\n${twitchAuthUrl}`,
        ephemeral: true,
    });
    } else {
      await interaction.reply({
        content: `[Clique aqui para vincular sua conta do Discord na Twitch](${twitchAuthUrl})`,
        ephemeral: true,      
      });
    }

  },
});