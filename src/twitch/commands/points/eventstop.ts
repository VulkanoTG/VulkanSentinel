import {
  syncChannelPointsGuildEvent,
  stopEventNow,
} from "../../../services/channelPointsAdmin.js";
import { sendBotChatMessage } from "../../../services/twitchChat.js";
import { createTwitchCommand } from "../../base.js";
import { isTwitchPointsAdmin } from "./shared.js";

createTwitchCommand({
  name: "eventstop",
  description: "Encerra um evento de pontos ativo ou agendado",
  async run(client, channel, tags) {
    if (!isTwitchPointsAdmin(tags)) {
      await sendBotChatMessage(client, channel, `@${tags.username}, voce nao tem permissao para esse comando.`);
      return;
    }

    const result = stopEventNow();

    if (result.ok) {
      await syncChannelPointsGuildEvent({
        type: "stopped",
        source: "twitch",
      });
    }

    await sendBotChatMessage(client, channel, result.message);
  },
});
