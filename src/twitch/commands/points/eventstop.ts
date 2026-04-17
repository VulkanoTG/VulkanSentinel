import {
  syncChannelPointsGuildEvent,
  stopEventNow,
} from "../../../services/channelPointsAdmin.js";
import { createTwitchCommand } from "../../base.js";
import { isTwitchPointsAdmin } from "./shared.js";

createTwitchCommand({
  name: "eventstop",
  description: "Encerra um evento de pontos ativo ou agendado",
  async run(client, channel, tags) {
    if (!isTwitchPointsAdmin(tags)) {
      await client.say(channel, `@${tags.username}, voce nao tem permissao para esse comando.`);
      return;
    }

    const result = stopEventNow();

    if (result.ok) {
      await syncChannelPointsGuildEvent({
        type: "stopped",
        source: "twitch",
      });
    }

    await client.say(channel, result.message);
  },
});
