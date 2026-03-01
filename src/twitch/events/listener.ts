import { sendToChannel } from "../../services/discord.js";

const DISCORD_CHANNEL_ID = process.env.INTEGRATION_LOGS_CHANNEL_ID!;

export async function handleTwitchMessage(tags: any, message: string) {
  
    if (message.startsWith('!')) return;
  
    const discordMessage = `**${tags.username}** (Twitch): ${message}`;

  try {
    await sendToChannel(DISCORD_CHANNEL_ID, discordMessage);
  } catch (err) {
    console.error("Erro enviando mensagem para Discord:", err);
  }
}