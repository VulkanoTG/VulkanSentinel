import { createCommand } from "#base";
import { appConfig } from "#config";
import { buildPrivacySummaryLines } from "../../../services/privacyService.js";
import { clearChannelMessages } from "../../../services/discordChannelCleanup.js";
import {
  ApplicationCommandType,
  EmbedBuilder,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";

const RULES_CHANNEL_ID = "1418983148716556368";

function buildRulesEmbeds() {
  const privacySummary = buildPrivacySummaryLines()
    .map((line) => `- ${line}`)
    .join("\n");

  return [
    new EmbedBuilder()
      .setTitle("REGRAS DO SERVIDOR")
      .setDescription(
        "Seja bem-vindo(a) a comunidade.\nAntes de interagir, leia atentamente as regras abaixo.\nNosso objetivo e manter um ambiente divertido, respeitoso e seguro para todos."
      )
      .setColor(0xff4500)
      .setImage("https://cdn.discordapp.com/attachments/1460106701502939419/1494491153859477574/Regras.png?ex=69e2ccd9&is=69e17b59&hm=f98ab7cd2c140021cc87dd67d893a03eeb019e890989890c7b2e21fd678bad58&"),
    new EmbedBuilder()
      .setTitle("REGRAS GERAIS")
      .setDescription(
        "**1. RESPEITO E A BASE DE TUDO**\nTrate todos com respeito. Nao sera tolerado: ofensas, preconceito, assedio ou ataques pessoais.\n\n**2. SEM SPAM OU DIVULGACAO**\nProibido flood, spam ou links fora de contexto. Divulgacao so com autorizacao.\n\n**3. USE OS CANAIS CORRETOS**\nEvite mensagens fora do tema. Leia a descricao dos canais.\n\n**4. CONTEUDO IMPROPRIO**\nProibido NSFW, nudez ou conteudo sensivel, inclusive piadas."
      )
      .setColor(0xff8a42),
    new EmbedBuilder()
      .setTitle("COMUNIDADE")
      .setDescription(
        "**5. RESPEITE A STAFF**\nDesrespeito ou tentativa de burlar decisoes nao sera tolerado.\n\n**6. EVITE DISCUSSOES POLEMICAS**\nNada de politica, religiao ou temas que gerem conflito.\n\n**7. PARTICIPE**\nInteraja, jogue e fortalezca a comunidade."
      )
      .setColor(0xe4ff00),
    new EmbedBuilder()
      .setTitle("INFORMACOES IMPORTANTES")
      .setDescription(
        "**8. TERMOS DO DISCORD**\nhttps://discord.com/terms\nhttps://discord.com/guidelines\n\n**9. DECISOES DA STAFF**\nSao finais. Discussoes publicas nao serao permitidas.\n\n**10. PUNICOES**\n- Advertencia\n- Mute\n- Kick\n- Ban\n\nCasos graves podem resultar em ban imediato."
      )
      .setColor(0xff3300)
      .setFooter({ text: "Divirta-se e respeite a comunidade" }),
    new EmbedBuilder()
      .setTitle("PRIVACIDADE E LGPD")
      .setDescription(
        "Resumo do tratamento de dados da comunidade.\nUse `/lgpd` para consultar direitos, exportar seus dados ou abrir uma solicitacao."
      )
      .addFields({
        name: "Resumo rapido",
        value: privacySummary,
      })
      .setColor(0x00b894),
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
