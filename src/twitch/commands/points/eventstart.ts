import {
  syncChannelPointsGuildEvent,
  startEventWithDuration,
} from "../../../services/channelPointsAdmin.js";
import { sendBotChatMessage } from "../../../services/twitchChat.js";
import { createTwitchCommand } from "../../base.js";
import { isTwitchPointsAdmin } from "./shared.js";

createTwitchCommand({
  name: "eventstart",
  description: "Inicia um evento de pontos",
  async run(client, channel, tags, args) {
    if (!isTwitchPointsAdmin(tags)) {
      await sendBotChatMessage(client, channel, `@${tags.username}, voce nao tem permissao para esse comando.`);
      return;
    }

    const action = args[0]?.toLowerCase();

    if (!action) {
      await sendBotChatMessage(
        client,
        channel,
        "Uso: !eventstart <tempo> <multiplicador> <nome> | <descricao opcional>"
      );
      return;
    }

    if (args.length < 3) {
      await sendBotChatMessage(client, channel, "Uso: !eventstart <tempo> <multiplicador> <nome> | <descricao opcional>");
      return;
    }

    const durationInput = args[0];
    const multiplierInput = args[1];
    const rawAfterHead = args.slice(2).join(" ");
    const rawBeforeTail = rawAfterHead.trim();

    if (!rawBeforeTail) {
      await sendBotChatMessage(client, channel, "Uso: !eventstart <tempo> <multiplicador> <nome> | <descricao opcional>");
      return;
    }

    const [eventName, eventDescription] = rawBeforeTail
      .split("|")
      .map((part) => part.trim());

    if (!eventName) {
      await sendBotChatMessage(client, channel, "Voce precisa informar o nome do evento. Exemplo: !eventstart 30m 2 Dobro de Firecoins | Evento especial da live");
      return;
    }

    const result = startEventWithDuration(
      eventName,
      durationInput,
      multiplierInput,
      eventDescription
    );

    if (result.ok) {
      await syncChannelPointsGuildEvent({
        type: "started",
        source: "twitch",
      });
    }

    await sendBotChatMessage(client, channel, result.message);
  },
});
