import "./shared/consoleLogger.js";
import { env } from "#config";
import { bootstrap } from "@constatic/base";
import { hasDiscordClient, getDiscordClient, setDiscordClient } from "./services/discord.js";
import { prisma } from "#database";
import { hasTwitchClient, getTwitchClient } from "./services/twitch.js";
import { shutdownAgentHub } from "./services/agentHub.js";
import {
	initializeSentinelCalloutScheduler,
	shutdownSentinelCalloutScheduler,
} from "./services/sentinelCalloutOverlay.js";
import {
	initializeControlsInvertRewardController,
	shutdownControlsInvertRewardController,
} from "./services/controlsInvertReward.js";
import {
	initializeMouseAxesInvertRewardController,
	shutdownMouseAxesInvertRewardController,
} from "./services/mouseAxesInvertReward.js";
import { ensureEventSubSubscriptions } from "./services/twitchEventSub.js";
import { initializeVoicemodRewardController, shutdownVoicemodRewardController } from "./services/voicemodRewards.js";
import { startEmbeddedWebServer } from "./services/webServer.js";
import "./twitch/index.js";

let isShuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
	if (isShuttingDown) {
		return;
	}

	isShuttingDown = true;
	console.log(`[App] Sinal ${signal} recebido. Iniciando shutdown gracioso...`);

	if (hasTwitchClient()) {
		try {
			await getTwitchClient().disconnect();
			console.log("[App] Cliente Twitch desconectado.");
		} catch (error) {
			console.error("[App] Erro ao desconectar cliente Twitch:", error);
		}
	}

	if (hasDiscordClient()) {
		try {
			getDiscordClient().destroy();
			console.log("[App] Cliente Discord encerrado.");
		} catch (error) {
			console.error("[App] Erro ao encerrar cliente Discord:", error);
		}
	}

	try {
		await shutdownAgentHub();
		console.log("[App] Agent hub encerrado.");
	} catch (error) {
		console.error("[App] Erro ao encerrar agent hub:", error);
	}

	try {
		await shutdownVoicemodRewardController();
		console.log("[App] Controlador de vozes Voicemod encerrado.");
	} catch (error) {
		console.error("[App] Erro ao encerrar controlador de vozes Voicemod:", error);
	}

	try {
		await shutdownControlsInvertRewardController();
		console.log("[App] Controlador de inversao de controles encerrado.");
	} catch (error) {
		console.error("[App] Erro ao encerrar controlador de inversao de controles:", error);
	}

	try {
		await shutdownMouseAxesInvertRewardController();
		console.log("[App] Controlador de inversao de eixos do mouse encerrado.");
	} catch (error) {
		console.error("[App] Erro ao encerrar controlador de inversao de eixos do mouse:", error);
	}

	try {
		shutdownSentinelCalloutScheduler();
		console.log("[App] Scheduler de callout da Sentinela encerrado.");
	} catch (error) {
		console.error("[App] Erro ao encerrar scheduler de callout da Sentinela:", error);
	}

	try {
		await prisma.$disconnect();
		console.log("[App] Prisma desconectado.");
	} catch (error) {
		console.error("[App] Erro ao desconectar Prisma:", error);
	}

	process.exit(0);
}

process.on("SIGINT", () => {
	void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
	void shutdown("SIGTERM");
});

await startEmbeddedWebServer();
initializeVoicemodRewardController();
initializeControlsInvertRewardController();
initializeMouseAxesInvertRewardController();
initializeSentinelCalloutScheduler();

await bootstrap({ 
	meta: import.meta, 
	env,
	beforeLoad: async (client) => {
		setDiscordClient(client);
	}
});

ensureEventSubSubscriptions().catch((error) => {
	console.error("[EventSub] Falha ao garantir subscriptions:", error);
});
