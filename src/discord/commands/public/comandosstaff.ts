import { createCommand } from "#base";
import { appConfig } from "#config";
import {
  ApplicationCommandType,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import {
  discordStaffCommandCategories,
  twitchStaffCommandCategories,
  type CommandCategory,
} from "../../../services/commandCatalog.js";
import { ensureDiscordModeratorAccess } from "../../../services/discordPermissions.js";

function renderCommandList(category: CommandCategory) {
  return [
    category.description,
    "",
    ...category.commands.map((command, index) => {
      return `${index + 1}. \`${command.name}\`\n${command.description}`;
    }),
  ].join("\n");
}

function buildCommandCategoryEmbed(options: {
  title: string;
  subtitle: string;
  categories: CommandCategory[];
  color: number;
  footerText: string;
}) {
  const totalCommands = options.categories.reduce((total, category) => {
    return total + category.commands.length;
  }, 0);

  return new EmbedBuilder()
    .setColor(options.color)
    .setTitle(options.title)
    .setDescription(`${options.subtitle}\n\nTotal neste painel: **${totalCommands} comandos**.`)
    .addFields(
      ...options.categories.map((category) => ({
        name: `${category.label} | ${category.commands.length} comandos`,
        value: renderCommandList(category),
        inline: false,
      }))
    )
    .setFooter({ text: options.footerText });
}

createCommand({
  name: "comandosstaff",
  description: "Exibe somente os comandos internos usados pela staff",
  type: ApplicationCommandType.ChatInput,
  defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,

  async run(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.guild) {
      await interaction.editReply({
        content: "Esse comando precisa ser usado dentro do servidor.",
      });
      return;
    }

    if (!(await ensureDiscordModeratorAccess(interaction))) {
      return;
    }

    const totalDiscordCommands = discordStaffCommandCategories.reduce((total, category) => {
      return total + category.commands.length;
    }, 0);
    const totalTwitchCommands = twitchStaffCommandCategories.reduce((total, category) => {
      return total + category.commands.length;
    }, 0);

    const overviewEmbed = new EmbedBuilder()
      .setColor(appConfig.colors.warning)
      .setTitle("Vulkan Sentinel | Comandos internos da staff")
      .setDescription(
        "Este painel mostra apenas os comandos internos de moderacao e administracao usados pela staff no Discord e na Twitch."
      )
      .addFields(
        {
          name: "Discord",
          value: `${totalDiscordCommands} comandos slash para moderacao, suporte e operacao administrativa.`,
          inline: true,
        },
        {
          name: "Twitch",
          value: `${totalTwitchCommands} comandos de chat para moderacao e controle da live.`,
          inline: true,
        },
        {
          name: "Visibilidade",
          value: "A resposta deste comando e ephemera para evitar expor atalhos internos fora da staff.",
          inline: false,
        }
      )
      .setFooter({ text: "Vulkan Sentinel | Staff only" });

    const discordEmbed = buildCommandCategoryEmbed({
      title: "Discord | Comandos da staff",
      subtitle: "Ferramentas internas para operacao, disciplina e manutencao do servidor.",
      categories: discordStaffCommandCategories,
      color: appConfig.colors.azoxo,
      footerText: "Vulkan Sentinel | Discord staff commands",
    });

    const twitchEmbed = buildCommandCategoryEmbed({
      title: "Twitch | Comandos da staff",
      subtitle: "Atalhos reservados para moderacao e controle operacional durante a live.",
      categories: twitchStaffCommandCategories,
      color: 0x9146ff,
      footerText: "Vulkan Sentinel | Twitch staff commands",
    });

    await interaction.editReply({
      embeds: [overviewEmbed, discordEmbed, twitchEmbed],
    });
  },
});
