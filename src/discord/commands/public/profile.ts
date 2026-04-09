import { createCommand } from "#base";
import { prisma } from "#database";
import { getTwitchUserById } from "#helix";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  EmbedBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import { getChannelPointBreakdown } from "../../../services/channelPoints.js";

const FIRE_COINS_EMOJI = "<:FireCoins:1491666484039254056>";

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

    const pointsBreakdown = getChannelPointBreakdown({
      isTwitchSub: user.isTwitchSub,
      isDiscordBooster: user.isDiscordBooster,
    });

    const activeBonusText = pointsBreakdown.activeBonuses
      .filter((bonus) => bonus.value > 1)
      .map((bonus) => `${bonus.label} x${bonus.value}`)
      .join("\n") || "Nenhum bonus ativo";

    const embed = new EmbedBuilder()
      .setColor(0xff7a18)
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
        { name: "Twitch ID", value: user.twitchId ?? "Nao vinculado", inline: false },
        { name: "Moedas", value: `${FIRE_COINS_EMOJI} ${user.balance ?? 0}`, inline: true},
        { name: "Horas Assistidas", value: `${user.hoursWatched ?? 0}h`, inline: true },
        { name: "Bonus Ativos", value: activeBonusText, inline: false }
      )
      .setFooter({ text: `ID interno: ${user.id} • Vulkan Sentinel` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
});
