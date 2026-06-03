import { appConfig, env } from "#config";
import { prisma } from "#database";
import { AttachmentBuilder, EmbedBuilder, type User as DiscordUser } from "discord.js";
import crypto from "node:crypto";
import { sendEmbedToChannel } from "./discord.js";

const PRIVACY_NOTICE_VERSION = "2026-05-14";
const DISCORD_LINK_STATE_MAX_AGE_MS = 15 * 60 * 1000;

type PrivacyRequestType =
  | "access"
  | "correction"
  | "erasure"
  | "revocation";

function getPrivacyLogChannelId() {
  return (
    appConfig.moderation.logsChannelId ??
    env.INTEGRATION_LOGS_CHANNEL_ID ??
    env.GUILD_BOT_CHANNEL_ID
  );
}

function getPrivacyStateSecret() {
  return env.WEB_SESSION_SECRET ?? env.TWITCH_EVENTSUB_SECRET ?? env.BOT_TOKEN;
}

function signPrivacyValue(value: string) {
  return crypto
    .createHmac("sha256", getPrivacyStateSecret())
    .update(value)
    .digest("hex");
}

export function getPrivacyNoticeVersion() {
  return PRIVACY_NOTICE_VERSION;
}

export function getPrivacyContactEmail() {
  return env.PRIVACY_CONTACT_EMAIL ?? null;
}

export function getPrivacyPolicyUrl() {
  if (env.PRIVACY_POLICY_URL) {
    return env.PRIVACY_POLICY_URL;
  }

  try {
    const redirectUrl = new URL(env.TWITCH_REDIRECT_URI);
    return new URL("/privacidade", redirectUrl).toString();
  } catch {
    return null;
  }
}

export function createDiscordLinkState(discordId: string) {
  const issuedAt = Date.now();
  const nonce = crypto.randomBytes(12).toString("hex");
  const payload = `${discordId}.${issuedAt}.${nonce}`;
  const signature = signPrivacyValue(payload);

  return `discord:${payload}.${signature}`;
}

export function readDiscordLinkState(state: string) {
  if (!state.startsWith("discord:")) {
    return null;
  }

  const raw = state.slice("discord:".length);
  const parts = raw.split(".");
  if (parts.length !== 4) {
    return null;
  }

  const [discordId, issuedAtRaw, nonce, signature] = parts;
  if (!discordId || !issuedAtRaw || !nonce || !signature) {
    return null;
  }

  const payload = `${discordId}.${issuedAtRaw}.${nonce}`;
  const expectedSignature = signPrivacyValue(payload);
  if (signature !== expectedSignature) {
    return null;
  }

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) {
    return null;
  }

  if (Date.now() - issuedAt > DISCORD_LINK_STATE_MAX_AGE_MS) {
    return null;
  }

  return { discordId, issuedAt };
}

export function buildPrivacySummaryLines() {
  const policyUrl = getPrivacyPolicyUrl();
  const contactEmail = getPrivacyContactEmail();

  return [
    "Dados tratados: IDs do Discord/Twitch, saldo, horas assistidas, status de sub/booster, warns e registros operacionais estritamente necessarios.",
    "Finalidades: integração de contas, operação do sistema de pontos, moderação, tickets e segurança da comunidade.",
    "Compartilhamento: Discord, Twitch, PostgreSQL e infraestrutura usada pelo proprio projeto.",
    `Versão do aviso: ${getPrivacyNoticeVersion()}.`,
    policyUrl ? `Politica/aviso: ${policyUrl}` : "Politica/aviso: configure PRIVACY_POLICY_URL ou a rota /privacidade.",
    contactEmail ? `Canal do encarregado/controlador: ${contactEmail}` : "Canal LGPD: configure PRIVACY_CONTACT_EMAIL.",
  ];
}

export async function createPrivacyExportAttachment(discordId: string) {
  const user = await prisma.user.findUnique({
    where: { discordId },
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    noticeVersion: getPrivacyNoticeVersion(),
    policyUrl: getPrivacyPolicyUrl(),
    contactEmail: getPrivacyContactEmail(),
    rights: [
      "confirmação da existencia de tratamento",
      "acesso aos dados",
      "correção",
      "anonimização, bloqueio ou eliminação quando aplicavel",
      "revogação do consentimento quando essa for a base legal",
    ],
    user,
  };

  return new AttachmentBuilder(
    Buffer.from(JSON.stringify(payload, null, 2), "utf8"),
    { name: `meus-dados-${discordId}.json` }
  );
}

export async function registerPrivacyRequest(input: {
  type: PrivacyRequestType;
  user: DiscordUser;
  note?: string | null;
}) {
  const embed = new EmbedBuilder()
    .setColor(appConfig.colors.primary)
    .setTitle("Solicitacao LGPD")
    .addFields(
      { name: "Tipo", value: input.type, inline: true },
      { name: "Usuario", value: `<@${input.user.id}>`, inline: true },
      { name: "Discord ID", value: input.user.id, inline: false },
      { name: "Observacao", value: input.note?.trim() || "Sem observações.", inline: false },
      { name: "Canal de retorno", value: getPrivacyContactEmail() ?? "Configure PRIVACY_CONTACT_EMAIL", inline: false }
    )
    .setFooter({ text: `Aviso ${getPrivacyNoticeVersion()}` })
    .setTimestamp();

  await sendEmbedToChannel(getPrivacyLogChannelId(), embed);
}
