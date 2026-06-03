import { createCommand } from "#base";
import { appConfig } from "#config";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  EmbedBuilder,
} from "discord.js";
import {
  buildPrivacySummaryLines,
  createPrivacyExportAttachment,
  getPrivacyContactEmail,
  getPrivacyNoticeVersion,
  getPrivacyPolicyUrl,
  registerPrivacyRequest,
} from "../../../services/privacyService.js";

createCommand({
  name: "lgpd",
  description: "Consulta privacidade, exporta seus dados ou abre uma solicitacao LGPD",
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: "acao",
      description: "Escolha a acao desejada",
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        { name: "Resumo de privacidade", value: "summary" },
        { name: "Exportar meus dados", value: "export" },
        { name: "Solicitar exclusao", value: "erasure" },
        { name: "Solicitar correcao", value: "correction" },
        { name: "Revogar consentimento", value: "revocation" },
      ],
    },
    {
      name: "observacao",
      description: "Detalhes adicionais para a equipe",
      type: ApplicationCommandOptionType.String,
      required: false,
      maxLength: 500,
    },
  ],

  async run(interaction) {
    const action = interaction.options.getString("acao", true);
    const note = interaction.options.getString("observacao");

    if (action === "summary") {
      const embed = new EmbedBuilder()
        .setColor(appConfig.colors.primary)
        .setTitle("Privacidade e LGPD")
        .setDescription(buildPrivacySummaryLines().join("\n"))
        .addFields(
          {
            name: "Direitos",
            value: [
              "confirmacao e acesso",
              "correcao",
              "anonimizacao, bloqueio ou eliminacao quando aplicavel",
              "revogacao do consentimento quando cabivel",
            ].join("\n"),
            inline: false,
          },
          {
            name: "Contato",
            value: getPrivacyContactEmail() ?? "Configure PRIVACY_CONTACT_EMAIL",
            inline: false,
          }
        )
        .setFooter({ text: `Aviso ${getPrivacyNoticeVersion()}` });

      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
      return;
    }

    if (action === "export") {
      const attachment = await createPrivacyExportAttachment(interaction.user.id);
      await interaction.reply({
        content: [
          "Segue a exportacao dos dados atualmente associados ao seu Discord no bot.",
          getPrivacyPolicyUrl() ? `Aviso completo: ${getPrivacyPolicyUrl()}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        files: [attachment],
        ephemeral: true,
      });
      return;
    }

    const type =
      action === "erasure"
        ? "erasure"
        : action === "correction"
          ? "correction"
          : "revocation";

    await registerPrivacyRequest({
      type,
      user: interaction.user,
      note,
    });

    await interaction.reply({
      content: [
        "Sua solicitacao foi registrada para analise.",
        getPrivacyContactEmail()
          ? `Canal de retorno configurado: ${getPrivacyContactEmail()}`
          : "Defina PRIVACY_CONTACT_EMAIL para expor um canal formal ao titular.",
      ].join("\n"),
      ephemeral: true,
    });
  },
});
