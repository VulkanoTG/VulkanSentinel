import { appConfig } from "#config";
import { EmbedBuilder } from "discord.js";
import type { AgentControllerButtonMessage, ControllerMarkerCategory } from "./schemas.js";
import { sendEmbedToChannel } from "../../../services/discord.js";
import { getLiveStatusSnapshot } from "../../../services/liveStatus.js";

type AgentConnectionContext = {
  connectionId: string;
  agentId: string;
};

type MarkerCategoryPresentation = {
  color: number;
  label: string;
  emoji: string;
};

const MARKER_CATEGORY_PRESENTATION: Record<ControllerMarkerCategory, MarkerCategoryPresentation> = {
  funny: {
    color: appConfig.colors.yellow,
    label: "Funny",
    emoji: "😂",
  },
  hype: {
    color: 0xff8a3d,
    label: "Hype",
    emoji: "🔥",
  },
  rage: {
    color: appConfig.colors.danger,
    label: "Rage",
    emoji: "💀",
  },
};

function getControllerButtonLogChannelId() {
  return appConfig.discord.controllerMarkers.channelId;
}

function formatDurationFromMs(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function formatCompactDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function getLiveUptime() {
  const liveSnapshot = getLiveStatusSnapshot();
  const startedAt = liveSnapshot.stream?.started_at;

  if (!startedAt) {
    return {
      compact: "indisponivel",
      formatted: "Live offline ou duracao indisponivel",
      startedAt: null,
    };
  }

  const startedAtDate = new Date(startedAt);
  const uptimeMs = Math.max(0, Date.now() - startedAtDate.getTime());

  return {
    compact: formatCompactDuration(uptimeMs),
    formatted: formatDurationFromMs(uptimeMs),
    startedAt,
  };
}

async function dispatchMarkerCreateEvent(
  context: AgentConnectionContext,
  message: AgentControllerButtonMessage,
) {
  const markerPayload = message.payload.payload;
  const categoryPresentation = MARKER_CATEGORY_PRESENTATION[markerPayload.category];
  const liveUptime = getLiveUptime();

  const embed = new EmbedBuilder()
    .setColor(categoryPresentation.color)
    .setTitle("🎬 Novo marcador criado")
    .addFields(
      {
        name: "⏱️ Tempo da live:",
        value: liveUptime.formatted,
        inline: false,
      },
      {
        name: "🎮 Categoria:",
        value: categoryPresentation.label,
        inline: false,
      },
    )
    .setFooter({
      text: `Job ${message.payload.jobId} • ${context.agentId} • ${markerPayload.source}`,
    })
    .setTimestamp(new Date(message.payload.sentAt));

  await sendEmbedToChannel(getControllerButtonLogChannelId(), embed);

  console.log(
    `[AgentHub] agent.controllerButton despachado connection=${context.connectionId} agent=${context.agentId} jobId=${message.payload.jobId} action=${message.payload.action} source=${message.payload.source} category=${markerPayload.category} uptime=${liveUptime.compact} embed=${categoryPresentation.emoji}`,
  );
}

export async function handleAgentControllerButtonMessage(
  context: AgentConnectionContext,
  message: AgentControllerButtonMessage,
) {
  const category =
    message.payload.payload.type === "marker:create"
      ? message.payload.payload.category
      : undefined;

  console.log(
    `[AgentHub] agent.controllerButton validado connection=${context.connectionId} agent=${context.agentId} jobId=${message.payload.jobId} action=${message.payload.action} source=${message.payload.source}${category ? ` category=${category}` : ""}`,
  );

  switch (message.payload.action) {
    case "marker:create":
      await dispatchMarkerCreateEvent(context, message);
      return;
    default:
      console.error(
        `[AgentHub] agent.controllerButton recebeu action sem handler connection=${context.connectionId} agent=${context.agentId} jobId=${message.payload.jobId} action=${message.payload.action}`,
      );
  }
}
