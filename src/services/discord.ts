import type { Client } from "discord.js";

let discordClient: Client<boolean>;

export function setDiscordClient(client: Client<boolean>) {
	discordClient = client;
}

export function getDiscordClient() {
	if (!discordClient) {
		throw new Error("Discord client not initialized. Make sure it's set before using it.");
	}
	return discordClient;
}

export async function sendToChannel(channelId: string, message: string) {
	try {
		const channel = getDiscordClient().channels.cache.get(channelId);
		if (!channel || !channel.isTextBased() || !('send' in channel)) {
			console.error(`Channel ${channelId} not found or is not a text channel`);
			return;
		}
		await channel.send(message);
	} catch (error) {
		console.error("Error sending message to Discord:", error);
	}
}

export async function sendEmbedToChannel(channelId: string, embed: any) {
	try {
		const channel = getDiscordClient().channels.cache.get(channelId);
		if (!channel || !channel.isTextBased() || !('send' in channel)) {
			console.error(`Channel ${channelId} not found or is not a text channel`);
			return;
		}
		await channel.send({ embeds: [embed] });
	} catch (error) {
		console.error("Error sending embed to Discord:", error);
	}
}
