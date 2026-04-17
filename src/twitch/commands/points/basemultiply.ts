import { updateBaseMultiplier } from "../../../services/channelPointsAdmin.js";
import { createTwitchCommand } from "../../base.js";
import { isTwitchPointsAdmin } from "./shared.js";

createTwitchCommand({
  name: "basemultiply",
  description: "Atualiza o base multiply dos pontos",
  async run(client, channel, tags, args) {
    if (!isTwitchPointsAdmin(tags)) {
      await client.say(channel, `@${tags.username}, voce nao tem permissao para esse comando.`);
      return;
    }

    const input = args[0];

    if (!input) {
      await client.say(channel, "Uso: !basemultiply <valor>");
      return;
    }

    const result = updateBaseMultiplier(input);
    await client.say(channel, result.message);
  },
});
