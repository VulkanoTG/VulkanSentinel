import { appConfig } from "#config";
import { prisma } from "#database";
import { getUserId as getTwitchUserIdByLogin } from "#helix";
import { EmbedBuilder } from "discord.js";
import { sendEmbedToChannel } from "./discord.js";

const CHANNEL_POINT_TRANSFER_LOG_CHANNEL_ID = "1494451413068157039";

export type TransferUser = {
  id: number;
  discordId: string;
  twitchId: string | null;
  balance: number;
};

export type TransferResult =
  | {
      ok: true;
      sender: TransferUser;
      target: TransferUser;
      amount: number;
      senderBalanceAfter: number;
      targetBalanceAfter: number;
    }
  | { ok: false; code: "INVALID_AMOUNT" | "SENDER_NOT_FOUND" | "TARGET_NOT_FOUND" | "SELF_TRANSFER" | "INSUFFICIENT_BALANCE"; sender?: TransferUser; amount?: number };

async function findUserByPaymentInput(input: string) {
  const cleaned = input.replace(/[<@!>]/g, "").trim();

  let user = await prisma.user.findUnique({
    where: { discordId: cleaned },
    select: {
      id: true,
      discordId: true,
      twitchId: true,
      balance: true,
    },
  });

  if (user) {
    return user;
  }

  user = await prisma.user.findFirst({
    where: { twitchId: cleaned },
    select: {
      id: true,
      discordId: true,
      twitchId: true,
      balance: true,
    },
  });

  if (user) {
    return user;
  }

  const twitchUserId = await getTwitchUserIdByLogin(cleaned);

  if (!twitchUserId) {
    return null;
  }

  return prisma.user.findFirst({
    where: { twitchId: twitchUserId },
    select: {
      id: true,
      discordId: true,
      twitchId: true,
      balance: true,
    },
  });
}

export async function transferChannelPoints(params: {
  senderDiscordId?: string;
  senderTwitchId?: string;
  targetInput: string;
  amount: number;
}): Promise<TransferResult> {
  const { senderDiscordId, senderTwitchId, targetInput, amount } = params;

  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, code: "INVALID_AMOUNT" };
  }

  const sender = senderDiscordId
    ? await prisma.user.findUnique({
        where: { discordId: senderDiscordId },
        select: {
          id: true,
          discordId: true,
          twitchId: true,
          balance: true,
        },
      })
    : senderTwitchId
      ? await prisma.user.findUnique({
          where: { twitchId: senderTwitchId },
          select: {
            id: true,
            discordId: true,
            twitchId: true,
            balance: true,
          },
        })
      : null;

  if (!sender) {
    return { ok: false, code: "SENDER_NOT_FOUND" };
  }

  const target = await findUserByPaymentInput(targetInput);

  if (!target) {
    return { ok: false, code: "TARGET_NOT_FOUND", sender, amount };
  }

  if (target.id === sender.id) {
    return { ok: false, code: "SELF_TRANSFER", sender, amount };
  }

  if (sender.balance < amount) {
    return { ok: false, code: "INSUFFICIENT_BALANCE", sender, amount };
  }

  const [updatedSender, updatedTarget] = await prisma.$transaction([
    prisma.user.update({
      where: { id: sender.id },
      data: {
        balance: { decrement: amount },
      },
      select: {
        balance: true,
      },
    }),
    prisma.user.update({
      where: { id: target.id },
      data: {
        balance: { increment: amount },
      },
      select: {
        balance: true,
      },
    }),
  ]);

  console.log(
    `[ChannelPoints] Transferencia realizada: ${amount} firecoins de discord:${sender.discordId} (twitch:${sender.twitchId ?? "nao-vinculado"}) para discord:${target.discordId} (twitch:${target.twitchId ?? "nao-vinculado"}).`
  );

  const source = senderDiscordId ? "Discord" : "Twitch";
  const auditEmbed = new EmbedBuilder()
    .setColor(appConfig.discord.points.auditEmbedColor)
    .setTitle("Log de Transferencia")
    .setDescription(`${appConfig.discord.profile.fireCoinsEmoji} ${amount} transferidos com sucesso.`)
    .addFields(
      { name: "Origem", value: source, inline: true },
      { name: "Valor", value: `${amount}`, inline: true },
      { name: "Alvo informado", value: targetInput, inline: true },
      {
        name: "Remetente",
        value: `<@${sender.discordId}>\nDiscord ID: ${sender.discordId}\nTwitch ID: ${sender.twitchId ?? "Nao vinculado"}`,
        inline: false,
      },
      {
        name: "Destinatario",
        value: `<@${target.discordId}>\nDiscord ID: ${target.discordId}\nTwitch ID: ${target.twitchId ?? "Nao vinculado"}`,
        inline: false,
      },
      {
        name: "Saldo remetente",
        value: `${sender.balance} -> ${updatedSender.balance}`,
        inline: true,
      },
      {
        name: "Saldo destinatario",
        value: `${target.balance} -> ${updatedTarget.balance}`,
        inline: true,
      }
    )
    .setFooter({ text: "Vulkan Sentinel - Auditoria de Firecoins" })
    .setTimestamp();

  void sendEmbedToChannel(CHANNEL_POINT_TRANSFER_LOG_CHANNEL_ID, auditEmbed);

  return {
    ok: true,
    sender,
    target,
    amount,
    senderBalanceAfter: updatedSender.balance,
    targetBalanceAfter: updatedTarget.balance,
  };
}
