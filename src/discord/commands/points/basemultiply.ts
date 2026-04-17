import { createCommand } from "#base";
import { updateBaseMultiplier } from "../../../services/channelPointsAdmin.js";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  PermissionFlagsBits,
} from "discord.js";

createCommand({
  name: "basemultiply",
  description: "Altera o multiplicador base dos pontos",
  type: ApplicationCommandType.ChatInput,
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
  options: [
    {
      name: "valor",
      description: "Novo valor do multiplicador base",
      type: ApplicationCommandOptionType.Number,
      required: true,
    },
  ],

  async run(interaction) {
    const value = interaction.options.getNumber("valor", true);
    const result = updateBaseMultiplier(value);

    await interaction.reply({
      content: result.message,
      ephemeral: true,
    });
  },
});
