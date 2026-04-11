import { appConfig } from "#config";
import { createTwitchCommand } from "../base.js";

createTwitchCommand({
  name: "discord",
  description: "Envia o link do canal do Discord no Chat",
  async run(client, channel) {
    client.say(channel, `Link para participar do nosso Discord: ${appConfig.discord.inviteUrl}`);
  }
});
