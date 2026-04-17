import { createEvent } from "#base";
import { GuildScheduledEventStatus } from "discord.js";
import {
  isManagedChannelPointsGuildEvent,
  shouldSuppressChannelPointsGuildEventSync,
} from "../../services/channelPointGuildEvent.js";
import { stopTimedEventFromDiscord } from "../../services/channelPoints.js";

createEvent({
  name: "sync manual channel points guild event stop",
  event: "guildScheduledEventUpdate",
  async run(oldEvent, newEvent) {
    if (!isManagedChannelPointsGuildEvent(newEvent)) {
      return;
    }

    if (shouldSuppressChannelPointsGuildEventSync()) {
      return;
    }

    const endedStatuses = new Set([
      GuildScheduledEventStatus.Canceled,
      GuildScheduledEventStatus.Completed,
    ]);
    const oldStatus = oldEvent?.status ?? null;
    const newStatus = newEvent.status ?? null;

    if (!newStatus || endedStatuses.has(oldStatus as GuildScheduledEventStatus) || !endedStatuses.has(newStatus)) {
      return;
    }

    stopTimedEventFromDiscord();
  },
});
