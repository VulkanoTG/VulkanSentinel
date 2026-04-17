import { createCommand } from "#base";
import { appConfig } from "#config";
import {
  ApplicationCommandType,
  EmbedBuilder,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";

const RULES_CHANNEL_ID = "1418983148716556368";

async function clearChannelMessages(channel: TextChannel) {
  let before: string | undefined;

  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, before });

    if (batch.size === 0) {
      break;
    }

    const messages = Array.from(batch.values());
    const newerThan14Days = messages.filter((message) => {
      return Date.now() - message.createdTimestamp < 14 * 24 * 60 * 60 * 1000;
    });
    const olderThan14Days = messages.filter((message) => {
      return Date.now() - message.createdTimestamp >= 14 * 24 * 60 * 60 * 1000;
    });

    if (newerThan14Days.length > 0) {
      await channel.bulkDelete(newerThan14Days.map((message) => message.id), true).catch(() => null);
    }

    for (const message of olderThan14Days) {
      await message.delete().catch(() => null);
    }

    before = messages.at(-1)?.id;
  }
}

function buildRulesEmbeds() {
  return [
    new EmbedBuilder()
      .setTitle("🎮・REGRAS DO SERVIDOR")
      .setDescription(
        "💬 Seja bem-vindo(a) à comunidade!\nAntes de interagir, leia atentamente as regras abaixo.\nNosso objetivo é manter um ambiente divertido, respeitoso e seguro para todos."
      )
      .setColor(0xff4500)
      .setImage("https://cdn.discordapp.com/attachments/1460106701502939419/1494491153859477574/Regras.png?ex=69e2ccd9&is=69e17b59&hm=f98ab7cd2c140021cc87dd67d893a03eeb019e890989890c7b2e21fd678bad58&"),
    new EmbedBuilder()
      .setTitle("🧠・REGRAS GERAIS")
      .setDescription(
        "**1. RESPEITO É A BASE DE TUDO**\nTrate todos com respeito. Não será tolerado: ofensas, preconceito, assédio ou ataques pessoais.\n\n**2. SEM SPAM OU DIVULGAÇÃO**\nProibido flood, spam ou links fora de contexto. Divulgação só com autorização.\n\n**3. USE OS CANAIS CORRETOS**\nEvite mensagens fora do tema. Leia a descrição dos canais.\n\n**4. CONTEÚDO IMPRÓPRIO**\nProibido NSFW, nudez ou conteúdo sensível, inclusive piadas."
      )
      .setColor(0xff8a42),
    new EmbedBuilder()
      .setTitle("🎧・COMUNIDADE")
      .setDescription(
        "**5. RESPEITE A STAFF**\nDesrespeito ou tentativa de burlar decisões não será tolerado.\n\n**6. EVITE DISCUSSÕES POLÊMICAS**\nNada de política, religião ou temas que gerem conflito.\n\n**7. PARTICIPE**\nInteraja, jogue e fortaleça a comunidade."
      )
      .setColor(0xe4ff00),
    new EmbedBuilder()
      .setTitle("📜・INFORMAÇÕES IMPORTANTES")
      .setDescription(
        "**8. TERMOS DO DISCORD**\nhttps://discord.com/terms\nhttps://discord.com/guidelines\n\n**9. DECISÕES DA STAFF**\nSão finais. Discussões públicas não serão permitidas.\n\n**10. PUNIÇÕES**\n• Advertência\n• Mute\n• Kick\n• Ban\n\nCasos graves podem resultar em ban imediato."
      )
      .setColor(0xff3300)
      .setFooter({ text: "Divirta-se e respeite a comunidade 🎮" }),
  ];
}

createCommand({
  name: "regras",
  description: "Limpa e republica as regras no canal oficial",
  type: ApplicationCommandType.ChatInput,
  defaultMemberPermissions: PermissionFlagsBits.Administrator,

  async run(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const channel = await interaction.client.channels.fetch(RULES_CHANNEL_ID).catch(() => null);

    if (!(channel instanceof TextChannel)) {
      await interaction.editReply({
        content: "Nao consegui acessar o canal de regras configurado.",
      });
      return;
    }

    await clearChannelMessages(channel);

    for (const embed of buildRulesEmbeds()) {
      await channel.send({ embeds: [embed] });
    }

    await channel.send({
      content: `Link do servidor do Discord: ${appConfig.discord.inviteUrl}`,
    });

    await interaction.editReply({
      content: `Regras reenviadas com sucesso em <#${RULES_CHANNEL_ID}>.`,
    });
  },
});
