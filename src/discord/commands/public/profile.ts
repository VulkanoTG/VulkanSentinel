import { createCommand } from "#base";
import { appConfig, env } from "#config";
import { prisma } from "#database";
import { getTwitchUserById } from "#helix";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  EmbedBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import { listUserBadges } from "../../../services/badges.js";
import { getChannelPointBreakdown } from "../../../services/channelPoints.js";

function formatWatchedHours(hoursWatched: number | null | undefined) {
  const totalMinutes = Math.max(0, Math.round((hoursWatched ?? 0) * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}:${minutes.toString().padStart(2, "0")}`;
}

function getDashboardUrl() {
  try {
    const redirectUrl = new URL(env.TWITCH_REDIRECT_URI);
    return new URL("/perfil", redirectUrl).toString();
  } catch {
    return null;
  }
}

async function findUserByProfileInput(
  interaction: ChatInputCommandInteraction,
  input: string
) {
  const cleaned = input.replace(/[<@!>]/g, "").trim();

  let user = await prisma.user.findUnique({
    where: { discordId: cleaned },
  });

  if (user) return user;

  user = await prisma.user.findFirst({
    where: { twitchId: cleaned },
  });

  if (user) return user;

  if (!interaction.guild) return null;

  const members = await interaction.guild.members.fetch();
  const normalizedInput = cleaned.toLowerCase();

  const member = members.find((candidate) => {
    return (
      candidate.nickname?.toLowerCase() === normalizedInput ||
      candidate.displayName.toLowerCase() === normalizedInput ||
      candidate.user.username.toLowerCase() === normalizedInput ||
      candidate.user.globalName?.toLowerCase() === normalizedInput
    );
  });

  if (!member) return null;

  return prisma.user.findUnique({
    where: { discordId: member.id },
  });
}

createCommand({
  name: "profile",
  description: "Mostra o perfil de um usuario",
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: "user",
      description: "Discord ID, mencao, nick, username ou Twitch ID",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  ],

  async run(interaction) {
    const isAdmin =
      interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
    const input = interaction.options.getString("user");

    if (!isAdmin && input) {
      await interaction.reply({
        content: "Voce so pode consultar o seu proprio perfil.",
        ephemeral: true,
      });
      return;
    }

    const user = isAdmin && input
      ? await findUserByProfileInput(interaction, input)
      : await prisma.user.findUnique({
          where: { discordId: interaction.user.id },
        });

    if (!user) {
      await interaction.reply({
        content: isAdmin && input
          ? "Usuario nao encontrado no banco."
          : "Seu perfil ainda nao foi encontrado no banco.",
        ephemeral: true,
      });
      return;
    }

    let twitchDisplayName = "Nao vinculado";
    const guildMember = interaction.guild
      ? await interaction.guild.members.fetch(user.discordId).catch(() => null)
      : null;
    const profileName =
      guildMember?.displayName ??
      guildMember?.user.globalName ??
      guildMember?.user.username ??
      interaction.user.displayName;

    if (user.twitchId) {
      const twitchData = await getTwitchUserById(user.twitchId);

      if (twitchData) {
        twitchDisplayName = twitchData.display_name;
      }
    }

    const [pointsBreakdown, badges] = await Promise.all([
      Promise.resolve(
        getChannelPointBreakdown({
          isTwitchSub: user.isTwitchSub,
          isDiscordBooster: user.isDiscordBooster,
          balanceMultiplier: user.balancemultiplier,
        })
      ),
      listUserBadges(user.id),
    ]);

    const activeBonusText = pointsBreakdown.activeBonuses
      .filter((bonus: { value: number }) => bonus.value > 1)
      .map((bonus: { label: string; value: number }) => `${bonus.label} x${bonus.value}`)
      .join("\n") || "Nenhum bonus ativo";
    const badgeText = badges.length
      ? badges
          .map((badge) => `${badge.equipped ? "•" : "◦"} ${badge.name}`)
          .join("\n")
      : "Nenhuma badge";
    const dashboardUrl = getDashboardUrl();

    const embed = new EmbedBuilder()
      .setColor(appConfig.discord.profile.embedColor)
      .setTitle(`Perfil de ${profileName}`)
      .setDescription(
        guildMember
          ? `${guildMember} aqui estao os dados atuais da conta vinculada.`
          : "Aqui estao os dados atuais da conta vinculada."
      )
      .setThumbnail(guildMember?.displayAvatarURL() ?? interaction.user.displayAvatarURL())
      .addFields(
        { name: "Discord", value: `<@${user.discordId}>`, inline: true },
        { name: "Twitch", value: twitchDisplayName, inline: true },
        { name: "Firecoins", value: `${appConfig.discord.profile.fireCoinsEmoji} ${user.balance ?? 0}`, inline: true },
        { name: "Horas Assistidas", value: `${formatWatchedHours(user.hoursWatched)}h`, inline: true },
        { name: "Warns Atuais", value: `${user.currentWarns ?? 0}`, inline: true },
        { name: "Warns Totais", value: `${user.totalWarns ?? 0}`, inline: true },
        { name: "Punicoes", value: `${user.totalPunishments ?? 0}`, inline: true },
        { name: "Badges", value: badgeText, inline: false },
        { name: "Bonus Ativos", value: activeBonusText, inline: false },
        ...(isAdmin && user.twitchId
          ? [{ name: "Twitch ID tecnico", value: user.twitchId, inline: false as const }]
          : []),
        ...(dashboardUrl
          ? [{ name: "Dashboard", value: `[Abrir perfil web](${dashboardUrl})`, inline: false as const }]
          : [])
      )
      .setFooter({ text: "Vulkan Sentinel" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
});
