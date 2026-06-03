import { createCommand } from "#base";
import { appConfig } from "#config";
import {
  ApplicationCommandType,
  EmbedBuilder,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import {
  discordViewerCommandCategories,
  twitchViewerCommandCategories,
  type CommandCategory,
} from "../../../services/commandCatalog.js";

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
  name: "comandos",
  description: "Publica um painel publico com os comandos de viewer da live",
  type: ApplicationCommandType.ChatInput,
  defaultMemberPermissions: PermissionFlagsBits.Administrator,

  async run(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!(interaction.channel instanceof TextChannel)) {
      await interaction.editReply({
        content: "Esse comando precisa ser usado em um canal de texto do servidor.",
      });
      return;
    }

    const totalDiscordCommands = discordViewerCommandCategories.reduce((total, category) => {
      return total + category.commands.length;
    }, 0);
    const totalTwitchCommands = twitchViewerCommandCategories.reduce((total, category) => {
      return total + category.commands.length;
    }, 0);

    const overviewEmbed = new EmbedBuilder()
      .setColor(appConfig.colors.default)
      .setTitle("Vulkan Sentinel | Guia de comandos da live")
      .setDescription(
        "Este painel mostra so os comandos publicos usados por viewers no Discord e na Twitch.\nFerramentas de moderacao e administracao ficaram fora daqui para manter a leitura limpa."
      )
      .addFields(
        {
          name: "Discord",
          value: `${totalDiscordCommands} comandos para vincular conta, ver perfil, acompanhar pontos e interagir com a live.`,
          inline: true,
        },
        {
          name: "Twitch",
          value: `${totalTwitchCommands} comandos para usar direto no chat enquanto a stream estiver rolando.`,
          inline: true,
        },
        {
          name: "Comece por aqui",
          value: "Use `/link` para vincular sua conta, `/profile` para abrir seu perfil e `/playlist` ou `/pedirmusica` para entrar no ritmo da live.",
          inline: false,
        }
      )
      .setFooter({ text: "Vulkan Sentinel | Painel publico da comunidade" });

    const discordEmbed = buildCommandCategoryEmbed({
      title: "Discord | Comandos slash para viewers",
      subtitle: "Fluxos publicos para conta, Firecoins, playlist e interacao durante a live.",
      categories: discordViewerCommandCategories,
      color: appConfig.colors.azoxo,
      footerText: "Vulkan Sentinel | Discord viewer commands",
    });

    const twitchEmbed = buildCommandCategoryEmbed({
      title: "Twitch | Comandos de chat para viewers",
      subtitle: "Atalhos publicos para participar da stream sem se perder no chat.",
      categories: twitchViewerCommandCategories,
      color: 0x9146ff,
      footerText: "Vulkan Sentinel | Twitch viewer commands",
    });

    await interaction.channel.send({
      embeds: [overviewEmbed, discordEmbed, twitchEmbed],
    });

    await interaction.editReply({
      content: `Painel publico de comandos enviado em <#${interaction.channel.id}>.`,
    });
  },
});
