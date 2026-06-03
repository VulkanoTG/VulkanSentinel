import { moderationService } from "../../services/moderationService.js";
import { DiscordModerationPermissionError } from "../../services/punishmentService.js";
import { sendBotChatMessage } from "../../services/twitchChat.js";
import { createTwitchCommand } from "../base.js";
import { isTwitchPointsAdmin } from "./points/shared.js";

createTwitchCommand({
  name: "warn",
  description: "Aplica warning progressivo na Twitch/Discord para usuarios vinculados",
  async run(client, channel, tags, args) {
    if (!isTwitchPointsAdmin(tags)) {
      await sendBotChatMessage(client, channel, `@${tags.username}, você não tem permissão para usar este comando.`);
      return;
    }

    if (args.length < 2) {
      await sendBotChatMessage(client, channel, `@${tags.username}, uso: !warn <nick> <motivo>`);
      return;
    }

    const [nickInput, ...reasonParts] = args;
    const reason = reasonParts.join(" ").trim();

    const target = await moderationService.resolveTwitchTarget(nickInput);
    if (!target) {
      await sendBotChatMessage(client, channel, `@${tags.username}, não consegui localizar o usuário informado.`);
      return;
    }

    let result;
    try {
      result = await moderationService.warn({
        target,
        moderator: {
          platform: "twitch",
          id: tags["user-id"],
          name: tags.username ?? "unknown",
        },
        reason,
      });
    } catch (error) {
      if (error instanceof DiscordModerationPermissionError) {
        await sendBotChatMessage(client, channel, `@${tags.username}, ${error.message}`);
        return;
      }

      throw error;
    }

    if (result.status === "unlinked_direct_punishment") {
      return;
    }

    if (result.status === "warned_and_punished") {
      await sendBotChatMessage(
        client,
        channel,
        `@${tags.username}, warning registrado e punição automática aplicada por ${result.durationLabel}. Total de punições: ${result.totalPunishments}.`
      );
      return;
    }

    await sendBotChatMessage(
      client,
      channel,
      `@${tags.username}, warning aplicado. Warns atuais: ${result.currentWarns}/${result.threshold}. Total histórico: ${result.totalWarns}.`
    );
  },
});
