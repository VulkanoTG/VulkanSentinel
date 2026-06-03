import type { TextChannel } from "discord.js";

export async function clearChannelMessages(channel: TextChannel) {
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
