import { appConfig } from "#config";
import { sendBotChatMessage } from "../../services/twitchChat.js";
import { createTwitchCommand } from "../base.js";

createTwitchCommand({
  name: "site",
  alias: ["recompensa"],
  description: "Envia o link do site oficial no chat",
  async run(client, channel) {
    await sendBotChatMessage(
      client,
      channel,
      `Acesse o site oficial para acompanhar a live e as recompensas: ${appConfig.web.siteUrl}`
    );
  },
});
