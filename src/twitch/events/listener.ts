import { env } from "#config";
import { sendToChannel } from "../../services/discord.js";
import { isModuleEnabled } from "../../services/moduleSettings.js";
import { isIgnoredTwitchUser } from "../shared.js";

const DISCORD_CHANNEL_ID = env.INTEGRATION_LOGS_CHANNEL_ID!;

export async function handleTwitchMessage(tags: any, message: string) {
  if (message.startsWith("!")) return;
  if (isIgnoredTwitchUser(tags.username)) return;
  if (!(await isModuleEnabled("twitchChatDiscordRelay"))) return;

  const discordMessage = `**${tags.username}** (Twitch): ${message}`;

  try {
    await sendToChannel(DISCORD_CHANNEL_ID, discordMessage);
  } catch (err) {
    console.error("Erro enviando mensagem para Discord:", err);
  }
}
