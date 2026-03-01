import type { Client as TMIClient } from "tmi.js";

export interface TwitchCommand {
	name: string;
	alias?: string[];
	description: string;
	run(client: TMIClient, channel: string, tags: any, args: string[]): Promise<void>;
}

const commands: Map<string, TwitchCommand> = new Map();

export function createTwitchCommand(command: TwitchCommand) {
	commands.set(command.name, command);
	if (command.alias) {
		command.alias.forEach(alias => commands.set(alias, command));
	}
	return command;
}

export function getTwitchCommands() {
	return commands;
}
