import { createCommand } from "#base";
import { appConfig, env } from "#config";
import { prisma } from "#database";
import { ApplicationCommandType } from "discord.js";
import {
  createDiscordLinkState,
  getPrivacyNoticeVersion,
  getPrivacyPolicyUrl,
} from "../../../services/privacyService.js";

const TWITCH_LINK_SCOPES = [
  "user:read:subscriptions",
] as const;

createCommand({
  name: "link",
  description: "Vincula sua conta da Twitch com Discord",
  type: ApplicationCommandType.ChatInput,

  async run(interaction) {
    const discordId = interaction.user.id;

    const user = await prisma.user.findUnique({
      where: { discordId },
    });

    const state = createDiscordLinkState(discordId);
    const twitchAuthUrl = `https://id.twitch.tv/oauth2/authorize?${new URLSearchParams({
      client_id: env.TWITCH_CLIENT_ID ?? "",
      redirect_uri: env.TWITCH_REDIRECT_URI,
      response_type: "code",
      force_verify: "true",
      scope: TWITCH_LINK_SCOPES.join(" "),
      state,
    }).toString()}`;
    const privacyUrl = getPrivacyPolicyUrl();
    const privacyNotice = [
      "Ao vincular a conta, o bot trata IDs de Discord/Twitch, saldo, horas assistidas e dados operacionais minimos para integracao, moderacao e beneficios.",
      `Aviso de privacidade: versao ${getPrivacyNoticeVersion()}.`,
      privacyUrl ? `Mais detalhes: ${privacyUrl}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const content = user?.twitchId
      ? `Sua conta ja esta vinculada. Use este link para atualizar as permissoes da Twitch:\n${twitchAuthUrl}`
      : `Clique aqui para vincular sua conta do Discord na Twitch\n${twitchAuthUrl}\n\n${privacyNotice}`;

    if (appConfig.discord.linkAccount.devMode) {
      await interaction.reply({
        content,
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: user?.twitchId
          ? `[Clique aqui para atualizar as permissoes da Twitch](${twitchAuthUrl})`
          : `[Clique aqui para vincular sua conta do Discord na Twitch](${twitchAuthUrl})`,
        ephemeral: true,
      });
    }
  },
});
