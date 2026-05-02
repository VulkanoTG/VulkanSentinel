import { moderationService } from "../../services/moderationService.js";
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
      await client.say(channel, `@${tags.username}, uso: !warn <usuario> <motivo>`);
      return;
    }

    const [targetInput, ...reasonParts] = args;
    const reason = reasonParts.join(" ").trim();

    const target = await moderationService.resolveTwitchTarget(targetInput);
    if (!target) {
      await client.say(channel, `@${tags.username}, nao consegui resolver o usuario informado.`);
      return;
    }

    const result = await moderationService.warn({
      target,
      moderator: {
        platform: "twitch",
        id: tags["user-id"],
        name: tags.username ?? "unknown",
      },
      reason,
    });

    if (result.status === "unlinked_direct_punishment") {
      await client.say(
        channel,
        `@${tags.username}, usuario nao vinculado. Punicao direta aplicada por ${result.durationLabel}.`
      );
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
