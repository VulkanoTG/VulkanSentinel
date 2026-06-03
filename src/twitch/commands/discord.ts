import { appConfig } from "#config";
import { sendBotChatMessage } from "../../services/twitchChat.js";
import { createTwitchCommand } from "../base.js";

createTwitchCommand({
  name: "discord",
  description: "Envia o link do canal do Discord no Chat",
  async run(client, channel) {
    await sendBotChatMessage(client, channel, `Link para participar do nosso Discord: ${appConfig.discord.inviteUrl}`);
  }
});
