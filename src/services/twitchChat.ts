import { env } from "#config";
import type { Client as TMIClient } from "tmi.js";
import { getTwitchClient, hasTwitchClient } from "./twitch.js";
import { sendTwitchChatMessage } from "./twitchHelix.js";

export async function sendBotChatMessage(
  client: TMIClient,
  channel: string,
  message: string
) {
  try {
    await sendTwitchChatMessage({
      broadcasterId: env.TWITCH_BROADCASTER_ID,
      senderId: env.TWITCH_BOT_ID,
      message,
      forSourceOnly: true,
    });
    return;
  } catch (error) {
    console.error("[TwitchChat] Falha ao enviar mensagem via Helix:", error);
  }

  await client.say(channel, message);
}

export async function sendSystemChatMessage(message: string) {
  if (!hasTwitchClient()) {
    console.warn("[TwitchChat] Cliente da Twitch indisponivel para aviso:", message);
    return;
  }

  await sendBotChatMessage(getTwitchClient(), env.TWITCH_CHANNEL, message);
}
