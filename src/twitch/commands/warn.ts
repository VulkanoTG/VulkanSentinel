import { moderationService } from "../../services/moderationService.js";
import { DiscordModerationPermissionError } from "../../services/punishmentService.js";
import { createTwitchCommand } from "../base.js";
import { isTwitchPointsAdmin } from "./points/shared.js";

createTwitchCommand({
  name: "warn",
  description: "Aplica warning progressivo na Twitch/Discord para usuarios vinculados",
  async run(client, channel, tags, args) {
    if (!isTwitchPointsAdmin(tags)) {
      await client.say(channel, `@${tags.username}, voce nao tem permissao para usar este comando.`);
      return;
    }

    if (args.length < 2) {
      await client.say(channel, `@${tags.username}, uso: !warn <nick> <motivo>`);
      return;
    }

    const [nickInput, ...reasonParts] = args;
    const reason = reasonParts.join(" ").trim();

    const target = await moderationService.resolveTwitchTarget(nickInput);
    if (!target) {
      await client.say(channel, `@${tags.username}, nao consegui resolver o usuario informado.`);
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
        await client.say(channel, `@${tags.username}, ${error.message}`);
        return;
      }

      throw error;
    }

    if (result.status === "unlinked_direct_punishment") {
      return;
    }

    if (result.status === "warned_and_punished") {
      await client.say(
        channel,
        `@${tags.username}, warning registrado e punicao automatica aplicada por ${result.durationLabel}. Total de punicoes: ${result.totalPunishments}.`
      );
      return;
    }

    await client.say(
      channel,
      `@${tags.username}, warning aplicado. Warns atuais: ${result.currentWarns}/${result.threshold}. Total historico: ${result.totalWarns}.`
    );
  },
});
