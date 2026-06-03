import { createCommand } from "#base";
import { appConfig } from "#config";
import { clearChannelMessages } from "../../../services/discordChannelCleanup.js";
import {
  ApplicationCommandType,
  EmbedBuilder,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import { ensureDiscordModeratorAccess } from "../../../services/discordPermissions.js";
import { punishmentService } from "../../../services/punishmentService.js";

function buildModerationRulesEmbeds() {
  const directPunishment = punishmentService.getDirectUnlinkedPunishmentPlan();
  const thresholdPunishment = punishmentService.getThresholdPunishmentPlan();

  return [
    new EmbedBuilder()
      .setTitle("REGRAS DA MODERACAO")
      .setDescription(
        "Este canal concentra as diretrizes internas da staff.\nToda acao deve buscar consistencia, clareza no motivo e seguranca para a comunidade."
      )
      .setColor(appConfig.colors.warning)
      .setImage("https://cdn.discordapp.com/attachments/1460106701502939419/1494491153859477574/Regras.png?ex=69e2ccd9&is=69e17b59&hm=f98ab7cd2c140021cc87dd67d893a03eeb019e890989890c7b2e21fd678bad58&"),
    new EmbedBuilder()
      .setTitle("CONDUTA DA STAFF")
      .setDescription(
        "**1. RESPEITO E IMPARCIALIDADE**\nModere sem provocacao, ironia ou seletividade.\n\n**2. MOTIVO CLARO**\nToda acao deve ter justificativa objetiva e facil de entender.\n\n**3. FOCO NO AMBIENTE**\nA moderacao existe para proteger a comunidade e a live, nao para vencer discussao."
      )
      .setColor(0xff8a42),
    new EmbedBuilder()
      .setTitle("FLUXO OPERACIONAL")
      .setDescription(
        `**4. USE O /warn COMO PADRAO**\nO \`/warn\` registra a advertencia e mantem o historico consistente.\n\n**5. USUARIO VINCULADO**\nAo atingir **${appConfig.moderation.warningThreshold} warns**, o bot aplica timeout automatico de **${thresholdPunishment.label}** e zera os warns atuais.\n\n**6. USUARIO NAO VINCULADO**\nSe o alvo nao estiver vinculado, o bot aplica punicao direta de **${directPunishment.label}**.`
      )
      .setColor(0xe4ff00),
    new EmbedBuilder()
      .setTitle("BOAS PRATICAS")
      .setDescription(
        "**7. CONFIRME O ALVO**\nAntes de punir, verifique nick, mencao, Discord ID ou login da Twitch.\n\n**8. EVITE EXCESSO PUBLICO**\nQuando o contexto pedir, resolva com firmeza sem prolongar discussao no chat.\n\n**9. ESCALONE COM CRITERIO**\nCasos graves, reincidencia ou abuso de staff devem ser levados para administracao."
      )
      .setColor(0xff3300),
    new EmbedBuilder()
      .setTitle("COMANDOS INTERNOS")
      .setDescription(
        "Painel rapido de referencia para a staff."
      )
      .addFields(
        {
          name: "Moderacao",
          value: "`/warn` para advertencia progressiva.\n`/regrasmoderacao` para republicar este painel.\n`/transferir` para mover responsabilidade de ticket.",
        },
        {
          name: "Operacao",
          value: "`/live` para conferir status da stream.\n`/comandosstaff` para listar atalhos internos.\n`/regras` para republicar as regras publicas.",
        }
      )
      .setColor(0x00b894)
      .setFooter({ text: "Estas regras valem para toda a staff do Vulkan Sentinel" }),
  ];
}

createCommand({
  name: "regrasmoderacao",
  description: "Limpa o canal atual e republica as regras internas de moderacao",
  type: ApplicationCommandType.ChatInput,
  defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,

  async run(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.guild) {
      await interaction.editReply({
        content: "Esse comando precisa ser usado dentro do servidor.",
      });
      return;
    }

    if (!(await ensureDiscordModeratorAccess(interaction))) {
      return;
    }

    if (!(interaction.channel instanceof TextChannel)) {
      await interaction.editReply({
        content: "Esse comando precisa ser usado em um canal de texto do servidor.",
      });
      return;
    }

    await clearChannelMessages(interaction.channel);

    for (const embed of buildModerationRulesEmbeds()) {
      await interaction.channel.send({ embeds: [embed] });
    }

    await interaction.editReply({
      content: `Regras de moderacao reenviadas com sucesso em <#${interaction.channel.id}>.`,
    });
  },
});
