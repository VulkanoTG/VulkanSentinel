import { appConfig, env } from "#config";
import { createEmbed } from "@magicyan/discord";
import { sendEmbedToChannel } from "../../services/discord.js";
import { createTwitchCommand } from "../base.js";

createTwitchCommand({
  name: "test",
  description: "Comando de teste",
  async run(client, channel, tags) {
    client.say(channel, `@${tags.username}, teste!`);

    try {
      const embed = createEmbed({
        title: "Teste de Embed",
        description: "Comando de teste executado pela Twitch",
        color: appConfig.colors.warning,
        fields: [
          { name: "Campo", value: "Exemplo - 123", inline: true },
        ],
      });

      await sendEmbedToChannel(env.GUILD_BOT_CHANNEL_ID, embed);
    } catch (err) {
      console.error("Erro ao enviar embed para Discord:", err);
    }
  },
});
