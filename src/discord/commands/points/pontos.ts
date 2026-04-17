import { createCommand } from "#base";
import { appConfig } from "#config";
import { prisma } from "#database";
import {
  ApplicationCommandType,
  EmbedBuilder,
} from "discord.js";
import { getChannelPointBreakdown } from "../../../services/channelPoints.js";

createCommand({
  name: "pontos",
  description: "Mostra seus firecoins e bonus ativos",
  type: ApplicationCommandType.ChatInput,

  async run(interaction) {
    const user = await prisma.user.findUnique({
      where: { discordId: interaction.user.id },
      select: {
        balance: true,
        isTwitchSub: true,
        isDiscordBooster: true,
        balancemultiplier: true,
      },
    });

    if (!user) {
      await interaction.reply({
        content: "Sua conta ainda nao foi encontrada no banco. Use /link para vincular sua Twitch.",
        ephemeral: true,
      });
      return;
    }

    const breakdown = getChannelPointBreakdown({
      isTwitchSub: user.isTwitchSub,
      isDiscordBooster: user.isDiscordBooster,
      balanceMultiplier: user.balancemultiplier,
    });

    const activeBonusText = breakdown.activeBonuses
      .filter((bonus) => bonus.value > 1)
      .map((bonus) => `${bonus.label} x${bonus.value}`)
      .join("\n") || "Nenhum bonus ativo";

    const embed = new EmbedBuilder()
      .setColor(appConfig.discord.points.embedColor)
      .setTitle("Seus Firecoins")
      .setDescription(`Saldo atual: ${appConfig.discord.profile.fireCoinsEmoji} ${user.balance}`)
      .addFields(
        { name: "Base por ciclo", value: `${breakdown.basePoints}`, inline: true },
        { name: "Multiplicador total", value: `x${breakdown.totalMultiplier}`, inline: true },
        { name: "Bonus ativos", value: activeBonusText, inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
});
