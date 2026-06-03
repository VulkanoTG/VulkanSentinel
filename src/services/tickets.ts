import { appConfig, env } from "#config";
import {
  LabelBuilder,
  ModalBuilder as BuildersModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder as BuildersTextInputBuilder,
} from "@discordjs/builders";
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  Message,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  TextChannel,
  TextInputStyle,
  type ButtonInteraction,
  type CacheType,
} from "discord.js";
import { getDiscordClient } from "./discord.js";

export const TICKET_PANEL_CHANNEL_ID = appConfig.discord.tickets.panelChannelId;
export const TICKET_TRANSCRIPTS_CHANNEL_ID = appConfig.discord.tickets.transcriptsChannelId;
export const TICKET_TRANSCRIPT_ARCHIVE_CHANNEL_ID = appConfig.discord.tickets.transcriptArchiveChannelId;
export const TICKET_CATEGORY_ID = appConfig.discord.tickets.categoryId;

const TICKET_TOPIC_PREFIX = "ticket-meta:";
const TICKET_LOGO_URL =
  "https://cdn.discordapp.com/attachments/1460106701502939419/1491716866173829220/ChatGPT_Image_30_de_set._de_2025_23_14_43.png?ex=69d8b517&is=69d76397&hm=1a64a724355dee745b6291fdd6429954e962d38f290c05b686edcac0139b3efc&";
const TICKET_TRANSCRIPT_EMBED_COLOR = 0xffcc00;
const DISCORD_OP_TIMEOUT_MS = 15_000;

type TicketStatus = "open" | "accepted" | "awaiting_rating" | "rated";

export interface TicketMetadata {
  ticketId: string;
  ownerId: string;
  ownerTag: string;
  problemType: string;
  problemDescription: string;
  status: TicketStatus;
  acceptedById?: string;
  closedById?: string;
  transcriptMessageId?: string;
  transcriptArchiveMessageId?: string;
}

interface TicketCategory {
  id: string;
  label: string;
  emoji: string;
}

type DiscordEmojiOption = {
  id?: string;
  name: string;
};

interface CreateTicketChannelParams {
  guildId: string;
  parentId?: string;
  ownerId: string;
  ownerUsername: string;
  ownerTag: string;
  type: string;
  description: string;
}

interface TicketEmbedParams {
  ticketId: string;
  ownerId: string;
  ownerTag: string;
  type: string;
  description: string;
}

interface SendTranscriptArchiveParams {
  ticketId: string;
  attachment: AttachmentBuilder;
}

interface FinalizeTranscriptLogParams {
  guildId: string;
  ticketId: string;
  ownerId: string;
  problemType?: string;
  problemDescription?: string;
  acceptedById?: string;
  closedById?: string;
  transcriptArchiveMessageId: string;
  stars?: number;
}

interface ClosedDmParams {
  ticketId: string;
  problemType?: string;
  problemDescription?: string;
  ratingText: string;
}

async function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = DISCORD_OP_TIMEOUT_MS) {
  return await Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`[Tickets] Timeout em ${label} apos ${timeoutMs}ms.`)), timeoutMs);
    }),
  ]);
}

export function isDiscordAdmin(
  interaction: ButtonInteraction<CacheType> | ModalSubmitInteraction<CacheType>
) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
}

export function buildTicketPanelEmbed() {
  return new EmbedBuilder()
    .setColor(appConfig.discord.tickets.embedColor)
    .setTitle("Central de Tickets")
    .setDescription(
      "Clique no botão abaixo para abrir um ticket.\n\nVocê vai escolher uma categoria predefinida e depois descrever o problema."
    )
    .setFooter({ text: appConfig.discord.tickets.footerText });
}

export function buildTicketPanelRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("/ticket/open")
      .setLabel("Abrir Ticket")
      .setStyle(ButtonStyle.Primary)
  );
}

export function getTicketCategories(): TicketCategory[] {
  return appConfig.discord.tickets.categories.map((category) => ({
    id: category.id,
    label: category.label,
    emoji: category.emoji,
  }));
}

export function getTicketCategoryById(categoryId: string) {
  return getTicketCategories().find((category) => category.id === categoryId) ?? null;
}

function parseDiscordEmoji(emoji: string): DiscordEmojiOption {
  const customEmojiMatch = emoji.match(/^<a?:([^:]+):(\d+)>$/);

  if (customEmojiMatch) {
    return {
      name: customEmojiMatch[1],
      id: customEmojiMatch[2],
    };
  }

  return { name: emoji };
}

export function buildTicketModal() {
  const categoryOptions = getTicketCategories().map((category) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(category.label)
      .setValue(category.id)
      .setEmoji(parseDiscordEmoji(category.emoji))
  );

  return new BuildersModalBuilder()
    .setCustomId("/ticket/open")
    .setTitle("Abrir Ticket")
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Categoria")
        .setDescription("Selecione a categoria do atendimento.")
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId("problem_type")
            .setPlaceholder("Escolha uma categoria")
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(categoryOptions)
        ),
      new LabelBuilder()
        .setLabel("Descrição breve")
        .setDescription("Explique brevemente o que aconteceu.")
        .setTextInputComponent(
          new BuildersTextInputBuilder()
            .setCustomId("problem_description")
            .setPlaceholder("Descreva o problema")
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
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 20) || "ticket"
  );
}

export function buildTicketChannelName(username: string, ticketId: string) {
  return `${sanitizeChannelPart(username)}-${ticketId}`;
}

export function createTicketMetadata(metadata: TicketMetadata) {
  return `${TICKET_TOPIC_PREFIX}${JSON.stringify(metadata)}`;
}

export function readTicketMetadata(channel: TextChannel) {
  const topic = channel.topic ?? "";

  if (!topic.startsWith(TICKET_TOPIC_PREFIX)) {
    return null;
  }

  try {
    return JSON.parse(topic.slice(TICKET_TOPIC_PREFIX.length)) as TicketMetadata;
  } catch {
    return null;
  }
}

export async function updateTicketMetadata(channel: TextChannel, patch: Partial<TicketMetadata>) {
  const current = readTicketMetadata(channel);
  if (!current) {
    return null;
  }

  const next = { ...current, ...patch };
  console.log(`[Tickets] updateTicketMetadata iniciada no canal ${channel.id} para ticket #${current.ticketId}.`);
  await withTimeout(
    channel.setTopic(createTicketMetadata(next)),
    `setTopic do canal ${channel.id} para ticket #${current.ticketId}`
  );
  console.log(`[Tickets] updateTicketMetadata concluida no canal ${channel.id} para ticket #${current.ticketId}.`);
  return next;
}

export function buildTicketEmbed(params: TicketEmbedParams) {
  return new EmbedBuilder()
    .setColor(appConfig.discord.tickets.embedColor)
    .setTitle(`Ticket #${params.ticketId}`)
    .setDescription(params.description)
    .addFields(
      { name: "Usuário", value: `<@${params.ownerId}>`, inline: true },
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

export function buildRatingRows(adminId: string, archiveMessageId: string, closedById: string) {
  const buttons = appConfig.discord.tickets.ratingStars.map((stars) =>
    new ButtonBuilder()
      .setCustomId(`/ticket/rate/${stars}/${adminId}/${archiveMessageId}/${closedById}`)
      .setLabel(`${stars} estrela${stars === 1 ? "" : "s"}`)
      .setEmoji("⭐")
      .setStyle(ButtonStyle.Secondary)
  );

  return [new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons)];
}

export function formatTicketRating(stars?: number) {
  if (!stars || stars < 1) {
    return "Pendente";
  }

  return "⭐".repeat(Math.min(stars, 5));
}

export async function ensureTicketPanelMessage() {
  const client = getDiscordClient();
  const channel = await client.channels.fetch(TICKET_PANEL_CHANNEL_ID);

  if (!channel || !channel.isTextBased() || channel.isDMBased()) {
    throw new Error("Canal de tickets não encontrado ou não é texto.");
  }

  const messages = await channel.messages.fetch({ limit: 20 });
  const existing = messages.find(
    (message) =>
      message.author.id === client.user?.id &&
      message.components.some(
        (row) =>
          "components" in row &&
          row.components.some(
            (component) => "customId" in component && component.customId === "/ticket/open"
          )
      )
  );

  if (existing) {
    return;
  }

  await channel.send({
    embeds: [buildTicketPanelEmbed()],
    components: [buildTicketPanelRow()],
  });
}

export async function createTicketChannel(params: CreateTicketChannelParams) {
  const client = getDiscordClient();
  if (!client.user) {
    throw new Error("Discord client user not initialized.");
  }

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
      problemType: params.type,
      problemDescription: params.description,
      status: "open",
    }),
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: client.user.id,
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
  const messages: Message[] = [];
  let before: string | undefined;

  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (batch.size === 0) {
      break;
    }

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

  return new AttachmentBuilder(Buffer.from(lines.join("\n"), "utf8"), {
    name: `${channel.name}-transcript.txt`,
  });
}

export async function sendUserDm(userId: string, content: string) {
  const client = getDiscordClient();
  const user = await client.users.fetch(userId).catch(() => null);

  if (!user) {
    return false;
  }

  return user
    .send({ content })
    .then(() => true)
    .catch((error) => {
      console.error(`[Tickets] Não foi possível enviar DM para ${userId}:`, error);
      return false;
    });
}

export function buildTicketClosedDm(params: ClosedDmParams) {
  return [
    "Seu ticket foi fechado.",
    `ID: #${params.ticketId}`,
    `Assunto: ${params.problemType ?? "Não informado"}`,
    `Descrição: ${params.problemDescription ?? "Não informada"}`,
    `Avaliação: ${params.ratingText}`,
  ].join("\n");
}

export function formatFinalTicketRating(stars?: number) {
  if (!stars || stars < 1) {
    return "Não avaliado";
  }

  return formatTicketRating(stars);
}

export async function sendTranscriptArchive(params: SendTranscriptArchiveParams) {
  const client = getDiscordClient();
  const fileChannel = await client.channels.fetch(TICKET_TRANSCRIPTS_CHANNEL_ID);

  if (!fileChannel || !fileChannel.isTextBased() || fileChannel.isDMBased()) {
    throw new Error("Canal do arquivo de transcript não encontrado.");
  }

  const attachmentName = params.attachment.name ?? `${params.ticketId}-transcript.txt`;
  const archiveMessage = await fileChannel.send({
    content: `#${params.ticketId}\nArquivo do transcript: ${attachmentName}\nEmbed do log: aguardando avaliação`,
    files: [params.attachment],
  });

  return {
    archiveMessage,
    attachmentName,
  };
}

export async function finalizeTranscriptLog(params: FinalizeTranscriptLogParams) {
  const client = getDiscordClient();
  console.log(`[Tickets] finalizeTranscriptLog iniciado para ticket #${params.ticketId}.`);

  const fileChannel = await withTimeout(
    client.channels.fetch(TICKET_TRANSCRIPTS_CHANNEL_ID),
    `fetch do canal de transcripts ${TICKET_TRANSCRIPTS_CHANNEL_ID}`
  );
  console.log(`[Tickets] Canal de transcripts carregado para ticket #${params.ticketId}.`);

  const embedChannel = await withTimeout(
    client.channels.fetch(TICKET_TRANSCRIPT_ARCHIVE_CHANNEL_ID),
    `fetch do canal de embeds ${TICKET_TRANSCRIPT_ARCHIVE_CHANNEL_ID}`
  );
  console.log(`[Tickets] Canal de embeds carregado para ticket #${params.ticketId}.`);

  if (!fileChannel || !fileChannel.isTextBased() || fileChannel.isDMBased() || !("messages" in fileChannel)) {
    throw new Error("Canal do arquivo de transcript não encontrado.");
  }

  if (!embedChannel || !embedChannel.isTextBased() || embedChannel.isDMBased()) {
    throw new Error("Canal do embed de transcript não encontrado.");
  }

  const archiveMessage = await withTimeout(
    fileChannel.messages.fetch(params.transcriptArchiveMessageId),
    `fetch da mensagem de transcript ${params.transcriptArchiveMessageId}`
  );
  console.log(`[Tickets] Mensagem de transcript carregada para ticket #${params.ticketId}.`);
  const attachmentName =
    archiveMessage.content
      .split("\n")
      .find((line) => line.startsWith("Arquivo do transcript: "))
      ?.replace("Arquivo do transcript: ", "")
      .trim() || "Transcript anexado";

  const archiveUrl = `https://discord.com/channels/${params.guildId}/${archiveMessage.channelId}/${archiveMessage.id}`;

  const embed = new EmbedBuilder()
    .setColor(TICKET_TRANSCRIPT_EMBED_COLOR)
    .setAuthor({
      name: "Vulkan Sentinel - Ticket",
      iconURL: TICKET_LOGO_URL,
    })
    .setTitle(`Assunto: ${params.problemType ?? "Não informado"}`)
    .setDescription(`Descrição: ${params.problemDescription ?? "Não informada"}`)
    .addFields(
      { name: "Requisitante", value: `<@${params.ownerId}>`, inline: true },
      { name: "Staff", value: params.acceptedById ? `<@${params.acceptedById}>` : "Não definido", inline: true },
      { name: "Fechado por", value: params.closedById ? `<@${params.closedById}>` : "Não definido", inline: true },
      { name: "Avaliação", value: formatFinalTicketRating(params.stars), inline: true },
      { name: "Transcript archive", value: `[${attachmentName}](${archiveUrl})`, inline: false }
    )
    .setFooter({
      text: "Sistema de Tickets Interno - Vulkan Sentinel",
      iconURL: TICKET_LOGO_URL,
    });

  const embedMessage = await withTimeout(
    embedChannel.send({
      content: `#${params.ticketId}`,
      embeds: [embed],
    }),
    `envio da embed final do ticket #${params.ticketId}`
  );
  console.log(`[Tickets] Embed final enviada para ticket #${params.ticketId}.`);

  const embedUrl = `https://discord.com/channels/${params.guildId}/${embedMessage.channelId}/${embedMessage.id}`;
  const nextArchiveContent = archiveMessage.content
    .split("\n")
    .map((line) => (line.startsWith("Embed do log: ") ? `Embed do log: ${embedUrl}` : line))
    .join("\n");

  if (nextArchiveContent !== archiveMessage.content) {
    await withTimeout(
      archiveMessage.edit({ content: nextArchiveContent }),
      `edicao da mensagem de transcript ${archiveMessage.id}`
    );
    console.log(`[Tickets] Mensagem de transcript atualizada para ticket #${params.ticketId}.`);
  }

  return {
    embedMessage,
    archiveMessage,
  };
}

async function pruneChannelMessages(channelId: string, cutoff: number) {
  const client = getDiscordClient();
  const channel = await client.channels.fetch(channelId).catch(() => null);

  if (!channel || !channel.isTextBased() || channel.isDMBased() || !("messages" in channel)) {
    return 0;
  }

  let removed = 0;
  let before: string | undefined;

  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (batch.size === 0) {
      break;
    }

    const messages = Array.from(batch.values());
    for (const message of messages) {
      if (message.createdTimestamp >= cutoff) {
        continue;
      }

      await message.delete().catch(() => null);
      removed += 1;
    }

    before = messages.at(-1)?.id;
  }

  return removed;
}

export async function pruneTicketArchives() {
  const retentionDays = env.TICKET_TRANSCRIPT_RETENTION_DAYS;
  if (!retentionDays) {
    return;
  }

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const [transcriptMessages, archiveMessages] = await Promise.all([
    pruneChannelMessages(TICKET_TRANSCRIPTS_CHANNEL_ID, cutoff),
    pruneChannelMessages(TICKET_TRANSCRIPT_ARCHIVE_CHANNEL_ID, cutoff),
  ]);

  console.log(
    `[Tickets] Retencao LGPD executada. ${transcriptMessages} mensagens removidas do arquivo e ${archiveMessages} do log final.`
  );
}
