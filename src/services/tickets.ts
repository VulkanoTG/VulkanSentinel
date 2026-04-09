import { getDiscordClient } from "./discord.js";
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
  type CacheType,
  type ButtonInteraction,
  type ModalSubmitInteraction,
} from "discord.js";

export const TICKET_PANEL_CHANNEL_ID = "1460105384667779075";
export const TICKET_TRANSCRIPTS_CHANNEL_ID = "1491673864223199252";
export const TICKET_CATEGORY_ID = "1419136780354977802";

const TICKET_TOPIC_PREFIX = "ticket-meta:";

export type TicketMetadata = {
  ticketId: string;
  ownerId: string;
  ownerTag: string;
  acceptedById?: string;
  status: "open" | "accepted" | "awaiting_rating";
  transcriptMessageId?: string;
};

export function isDiscordAdmin(
  interaction: ButtonInteraction<CacheType> | ModalSubmitInteraction<CacheType>
) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
}

export function buildTicketPanelEmbed() {
  return new EmbedBuilder()
    .setColor(0xff7a18)
    .setTitle("Central de Tickets")
    .setDescription(
      "Clique no botao abaixo para abrir um ticket.\n\nVoce vai preencher um modal com o tipo do problema e uma descricao breve."
    )
    .setFooter({ text: "Vulkan Sentinel • Suporte" });
}

export function buildTicketPanelRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("/ticket/open")
      .setLabel("Abrir Ticket")
      .setStyle(ButtonStyle.Primary)
  );
}

export function buildTicketModal() {
  return new ModalBuilder()
    .setCustomId("/ticket/open")
    .setTitle("Abrir Ticket")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("problem_type")
          .setLabel("Tipo de problema")
          .setPlaceholder("Ex: duvida, bug, pagamento, conta")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(80)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("problem_description")
          .setLabel("Descricao breve")
          .setPlaceholder("Explique brevemente o que aconteceu")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000)
      )
    );
}

export function generateTicketId() {
  return Date.now().toString().slice(-6);
}

function sanitizeChannelPart(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20) || "ticket";
}

export function buildTicketChannelName(username: string, ticketId: string) {
  return `${sanitizeChannelPart(username)}-${ticketId}`;
}

export function createTicketMetadata(metadata: TicketMetadata) {
  return `${TICKET_TOPIC_PREFIX}${JSON.stringify(metadata)}`;
}

export function readTicketMetadata(channel: TextChannel) {
  const topic = channel.topic ?? "";
  if (!topic.startsWith(TICKET_TOPIC_PREFIX)) return null;

  try {
    return JSON.parse(topic.slice(TICKET_TOPIC_PREFIX.length)) as TicketMetadata;
  } catch {
    return null;
  }
}

export async function updateTicketMetadata(
  channel: TextChannel,
  patch: Partial<TicketMetadata>
) {
  const current = readTicketMetadata(channel);
  if (!current) return null;

  const next = { ...current, ...patch };
  await channel.setTopic(createTicketMetadata(next));
  return next;
}

export function buildTicketEmbed(params: {
  ticketId: string;
  ownerId: string;
  ownerTag: string;
  type: string;
  description: string;
}) {
  return new EmbedBuilder()
    .setColor(0xff7a18)
    .setTitle(`Ticket #${params.ticketId}`)
    .setDescription(params.description)
    .addFields(
      { name: "Usuario", value: `<@${params.ownerId}>`, inline: true },
      { name: "Nick", value: params.ownerTag, inline: true },
      { name: "Tipo", value: params.type, inline: true }
    )
    .setFooter({ text: `ID do Ticket: ${params.ticketId}` })
    .setTimestamp();
}

export function buildTicketActionRow(options?: {
  acceptDisabled?: boolean;
  rejectDisabled?: boolean;
  closeDisabled?: boolean;
}) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("/ticket/accept")
      .setLabel("Aceitar Ticket")
      .setStyle(ButtonStyle.Success)
      .setDisabled(options?.acceptDisabled ?? false),
    new ButtonBuilder()
      .setCustomId("/ticket/reject")
      .setLabel("Recusar Ticket")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(options?.rejectDisabled ?? false),
    new ButtonBuilder()
      .setCustomId("/ticket/close")
      .setLabel("Fechar Ticket")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(options?.closeDisabled ?? false)
  );
}

export function buildRatingRows(adminId: string) {
  const buttons = [1, 2, 3, 4, 5].map((stars) =>
    new ButtonBuilder()
      .setCustomId(`/ticket/rate/${stars}/${adminId}`)
      .setLabel(`${stars} estrela${stars === 1 ? "" : "s"}`)
      .setEmoji("⭐")
      .setStyle(ButtonStyle.Secondary)
  );

  return [new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons)];
}

export async function ensureTicketPanelMessage() {
  const client = getDiscordClient();
  const channel = await client.channels.fetch(TICKET_PANEL_CHANNEL_ID);

  if (!channel || !channel.isTextBased() || channel.isDMBased()) {
    throw new Error("Canal de tickets nao encontrado ou nao e texto.");
  }

  const messages = await channel.messages.fetch({ limit: 20 });
  const existing = messages.find((message) =>
    message.author.id === client.user?.id &&
    message.components.some((row) =>
      "components" in row &&
      row.components.some((component) =>
        "customId" in component && component.customId === "/ticket/open"
      )
    )
  );

  if (existing) return;

  await channel.send({
    embeds: [buildTicketPanelEmbed()],
    components: [buildTicketPanelRow()],
  });
}

export async function createTicketChannel(params: {
  guildId: string;
  parentId?: string | null;
  ownerId: string;
  ownerUsername: string;
  ownerTag: string;
  type: string;
  description: string;
}) {
  const client = getDiscordClient();
  const guild = await client.guilds.fetch(params.guildId);
  const ticketId = generateTicketId();
  const channelName = buildTicketChannelName(params.ownerUsername, ticketId);

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    ...(params.parentId ? { parent: params.parentId } : {}),
    topic: createTicketMetadata({
      ticketId,
      ownerId: params.ownerId,
      ownerTag: params.ownerTag,
      status: "open",
    }),
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: client.user!.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ],
  });

  if (!(channel instanceof TextChannel)) {
    throw new Error("Falha ao criar canal de ticket em formato texto.");
  }

  await channel.send({
    content: `Ticket criado por <@${params.ownerId}>.`,
    embeds: [
      buildTicketEmbed({
        ticketId,
        ownerId: params.ownerId,
        ownerTag: params.ownerTag,
        type: params.type,
        description: params.description,
      }),
    ],
    components: [buildTicketActionRow()],
  });

  return { channel, ticketId };
}

export async function fetchAllChannelMessages(channel: TextChannel) {
  const messages = [];
  let before: string | undefined;

  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (batch.size === 0) break;

    messages.push(...batch.values());
    before = batch.last()?.id;
  }

  return messages.reverse();
}

export async function createTranscriptAttachment(channel: TextChannel) {
  const messages = await fetchAllChannelMessages(channel);

  const lines = messages.map((message) => {
    const timestamp = message.createdAt.toISOString();
    const attachments = message.attachments.map((attachment) => attachment.url).join(" ");
    const content = [message.content, attachments].filter(Boolean).join(" ").trim() || "[sem texto]";
    return `[${timestamp}] ${message.author.tag}: ${content}`;
  });

  const content = lines.join("\n");
  return new AttachmentBuilder(Buffer.from(content, "utf8"), {
    name: `${channel.name}-transcript.txt`,
  });
}

export async function sendUserDm(userId: string, content: string) {
  const client = getDiscordClient();
  const user = await client.users.fetch(userId).catch(() => null);
  if (!user) return;
  await user.send({ content }).catch(() => null);
}

export async function sendTranscriptLog(params: {
  ticketId: string;
  ownerId: string;
  ownerTag: string;
  acceptedById?: string;
  attachment: AttachmentBuilder;
}) {
  const client = getDiscordClient();
  const channel = await client.channels.fetch(TICKET_TRANSCRIPTS_CHANNEL_ID);

  if (!channel || !channel.isTextBased() || channel.isDMBased()) {
    throw new Error("Canal de transcripts nao encontrado.");
  }

  return channel.send({
    content: [
      `Transcript do ticket #${params.ticketId}`,
      `Usuario: <@${params.ownerId}> (${params.ownerTag})`,
      params.acceptedById ? `Staff: <@${params.acceptedById}>` : "Staff: nao definido",
    ].join("\n"),
    files: [params.attachment],
  });
}
