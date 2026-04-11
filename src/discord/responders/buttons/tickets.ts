import { createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import { type ButtonInteraction, type CacheType, type ModalSubmitInteraction, TextChannel } from "discord.js";
import { z } from "zod";
import {
  buildRatingRows,
  buildTicketActionRow,
  buildTicketModal,
  createTranscriptAttachment,
  createTicketChannel,
  finalizeTranscriptLog,
  formatTicketRating,
  getTicketCategoryById,
  isDiscordAdmin,
  readTicketMetadata,
  sendTranscriptArchive,
  TICKET_CATEGORY_ID,
  updateTicketMetadata,
} from "../../../services/tickets.js";

const ratingLocks = new Set<string>();

async function deleteTicketChannel(channel: TextChannel, reason: string) {
  const canManageChannels =
    channel.guild.members.me?.permissionsIn(channel).has("ManageChannels") ?? false;

  console.log(
    `[Tickets] Tentando apagar canal ${channel.id} (${channel.name}). Motivo: ${reason}. deletable=${channel.deletable} manageChannels=${canManageChannels}`
  );

  const freshChannel = await channel.client.channels.fetch(channel.id).catch(() => null);

  if (freshChannel && freshChannel.isTextBased() && !freshChannel.isDMBased() && "delete" in freshChannel) {
    await freshChannel.delete(reason);
    console.log(`[Tickets] Canal ${channel.id} apagado com sucesso via fetch.`);
    return;
  }

  await channel.delete(reason);
  console.log(`[Tickets] Canal ${channel.id} apagado com sucesso via referencia atual.`);
}

createResponder({
  customId: "/ticket/open",
  types: [ResponderType.Button],
  async run(interaction) {
    await interaction.showModal(buildTicketModal());
  },
});

createResponder({
  customId: "/ticket/open",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  async run(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        content: "Esse ticket precisa ser aberto dentro do servidor.",
        ephemeral: true,
      });
      return;
    }

    const selectedCategoryId = interaction.fields.getStringSelectValues("problem_type")[0];
    const category = getTicketCategoryById(selectedCategoryId);
    if (!category) {
      await interaction.reply({
        content: "Categoria de ticket invalida.",
        ephemeral: true,
      });
      return;
    }

    const description = interaction.fields.getTextInputValue("problem_description").trim();

    try {
      const { channel, ticketId } = await createTicketChannel({
        guildId: interaction.guildId,
        parentId: TICKET_CATEGORY_ID,
        ownerId: interaction.user.id,
        ownerUsername: interaction.user.username,
        ownerTag: interaction.user.tag,
        type: category.label,
        description,
      });

      await interaction.reply({
        content: `Seu ticket de ${category.label} foi criado em ${channel}. Aguarde a equipe analisar. ID: #${ticketId}`,
        ephemeral: true,
      });
    } catch (error) {
      console.error("[Tickets] Erro ao criar ticket:", error);
      await interaction.reply({
        content: "Nao foi possivel criar o ticket agora. Verifique se a categoria e as permissoes do bot estao corretas.",
        ephemeral: true,
      });
    }
  },
});

async function requireAdmin(
  interaction: ButtonInteraction<CacheType> | ModalSubmitInteraction<CacheType>
) {
  if (!isDiscordAdmin(interaction)) {
    await interaction.reply({
      content: "Apenas administradores podem usar essa acao.",
      ephemeral: true,
    });
    return false;
  }

  if (!interaction.channel || interaction.channel.isDMBased()) {
    await interaction.reply({
      content: "Esse botao so funciona em um canal de ticket.",
      ephemeral: true,
    });
    return false;
  }

  return true;
}

createResponder({
  customId: "/ticket/accept",
  types: [ResponderType.Button],
  async run(interaction) {
    if (!(await requireAdmin(interaction))) return;
    if (!(interaction.channel instanceof TextChannel)) return;

    await interaction.deferReply().catch(() => null);

    const metadata = readTicketMetadata(interaction.channel);
    if (!metadata) {
      await interaction.editReply({
        content: "Esse canal nao parece ser um ticket valido.",
      });
      return;
    }

    if (metadata.status === "accepted") {
      await interaction.editReply({
        content: "Esse ticket ja foi aceito.",
      });
      return;
    }

    await interaction.channel.permissionOverwrites.edit(metadata.ownerId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
      EmbedLinks: true,
    });

    await updateTicketMetadata(interaction.channel, {
      acceptedById: interaction.user.id,
      status: "accepted",
    });

    await interaction.message.edit({
      components: [
        buildTicketActionRow({
          acceptDisabled: true,
          rejectDisabled: true,
          closeDisabled: false,
        }),
      ],
    });

    await interaction.editReply({
      content: `Ticket aceito por ${interaction.user}. O usuario <@${metadata.ownerId}> agora pode participar.`,
    });
  },
});

createResponder({
  customId: "/ticket/reject",
  types: [ResponderType.Button],
  async run(interaction) {
    if (!(await requireAdmin(interaction))) return;
    if (!(interaction.channel instanceof TextChannel)) return;

    const metadata = readTicketMetadata(interaction.channel);
    if (!metadata) {
      await interaction.reply({
        content: "Esse canal nao parece ser um ticket valido.",
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: "Ticket recusado. O canal sera apagado.",
    });

    await deleteTicketChannel(interaction.channel, "Ticket recusado");
  },
});

createResponder({
  customId: "/ticket/close",
  types: [ResponderType.Button],
  async run(interaction) {
    if (!(await requireAdmin(interaction))) return;
    if (!(interaction.channel instanceof TextChannel)) return;

    await interaction.deferReply({ ephemeral: true });

    try {
      const metadata = readTicketMetadata(interaction.channel);
      if (!metadata) {
        await interaction.editReply({
          content: "Esse canal nao parece ser um ticket valido.",
        });
        return;
      }

      await interaction.editReply({
        content: "Fechando ticket e gerando transcript...",
      });

      const staffIdForRating = metadata.acceptedById ?? interaction.user.id;

      console.log(`[Tickets] Fechando ticket #${metadata.ticketId} por ${interaction.user.id}. Staff avaliado: ${staffIdForRating}`);
      console.log(`[Tickets] Gerando transcript do ticket #${metadata.ticketId}...`);
      const attachment = await createTranscriptAttachment(interaction.channel);
      console.log(`[Tickets] Transcript gerado para ticket #${metadata.ticketId}.`);

      console.log(`[Tickets] Enviando arquivo do transcript do ticket #${metadata.ticketId}...`);
      const transcriptArchive = await sendTranscriptArchive({
        ticketId: metadata.ticketId,
        attachment,
      });
      console.log(`[Tickets] Arquivo do transcript enviado para ticket #${metadata.ticketId}.`);

      console.log(`[Tickets] Enviando mensagem de avaliacao do ticket #${metadata.ticketId}...`);
      await interaction.channel.send({
        content: `<@${metadata.ownerId}> o atendimento foi encerrado. Avalie o suporte de <@${staffIdForRating}> de 1 a 5 estrelas abaixo.`,
        components: buildRatingRows(
          staffIdForRating,
          transcriptArchive.archiveMessage.id,
          interaction.user.id
        ),
      });
      console.log(`[Tickets] Mensagem de avaliacao enviada para ticket #${metadata.ticketId}.`);

      console.log(`[Tickets] Ajustando permissoes do ticket #${metadata.ticketId}...`);
      await interaction.channel.permissionOverwrites.edit(metadata.ownerId, {
        ViewChannel: true,
        SendMessages: false,
        ReadMessageHistory: true,
        AttachFiles: false,
        EmbedLinks: true,
      });
      console.log(`[Tickets] Permissoes ajustadas para ticket #${metadata.ticketId}.`);

      await interaction.message.edit({
        components: [
          buildTicketActionRow({
            acceptDisabled: true,
            rejectDisabled: true,
            closeDisabled: true,
          }),
        ],
      }).catch((error) => {
        console.error("[Tickets] Falha ao atualizar botoes do ticket:", error);
      });

      await interaction.editReply({
        content: "Ticket fechado. Solicitando avaliacao do usuario.",
      });
    } catch (error) {
      console.error("[Tickets] Erro ao fechar ticket:", error);

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: "Ocorreu um erro ao fechar o ticket. Verifique as permissoes do bot e tente novamente.",
        }).catch(() => null);
      } else {
        await interaction.followUp({
          content: "Ocorreu um erro ao fechar o ticket. Verifique as permissoes do bot e tente novamente.",
          ephemeral: true,
        }).catch(() => null);
      }
    }
  },
});

const ratingSchema = z.object({
  stars: z.coerce.number().min(1).max(5),
  adminId: z.string(),
  archiveMessageId: z.string(),
  closedById: z.string(),
});

createResponder({
  customId: "/ticket/rate/:stars/:adminId/:archiveMessageId/:closedById",
  types: [ResponderType.Button],
  parse: ratingSchema.parse,
  async run(interaction, { stars, adminId, archiveMessageId, closedById }) {
    console.log(`[Tickets] Clique de avaliacao recebido no canal ${interaction.channelId} com nota ${stars} por ${interaction.user.id}.`);
    await interaction.deferUpdate().catch(() => null);

    if (!(interaction.channel instanceof TextChannel)) {
      await interaction.followUp({
        content: "Esse botao so funciona dentro do ticket.",
        ephemeral: true,
      }).catch(() => null);
      return;
    }

    const metadata = readTicketMetadata(interaction.channel);
    if (!metadata) {
      await interaction.followUp({
        content: "Esse canal nao parece ser um ticket valido.",
        ephemeral: true,
      }).catch(() => null);
      return;
    }

    if (interaction.user.id !== metadata.ownerId) {
      await interaction.followUp({
        content: "Somente quem abriu o ticket pode enviar a avaliacao.",
        ephemeral: true,
      }).catch(() => null);
      return;
    }

    if (ratingLocks.has(interaction.channelId)) {
      await interaction.followUp({
        content: "Esse ticket esta sendo finalizado.",
        ephemeral: true,
      }).catch(() => null);
      return;
    }

    ratingLocks.add(interaction.channelId);

    try {
      console.log(`[Tickets] Iniciando finalizacao por avaliacao do ticket #${metadata.ticketId}.`);
      await interaction.message.edit({ components: [] }).catch(() => null);

      const finalLog = await finalizeTranscriptLog({
        guildId: interaction.guildId!,
        ticketId: metadata.ticketId,
        ownerId: metadata.ownerId,
        problemType: metadata.problemType,
        problemDescription: metadata.problemDescription,
        acceptedById: adminId,
        closedById,
        transcriptArchiveMessageId: archiveMessageId,
        stars,
      });

      console.log(
        `[Tickets] Embed final registrada para ticket #${metadata.ticketId} com mensagem ${finalLog.embedMessage.id}.`
      );

      console.log(`[Tickets] Avaliacao registrada para ticket #${metadata.ticketId}. Apagando canal...`);
      await deleteTicketChannel(interaction.channel, "Ticket finalizado e avaliado");

      await interaction.editReply({
        content: `${interaction.message.content}\n\nAvaliacao enviada: ${formatTicketRating(stars)}.`,
        components: [],
      }).catch(() => null);
    } catch (error) {
      console.error(`[Tickets] Falha ao avaliar/finalizar ticket #${metadata.ticketId}:`, error);
      await interaction.followUp({
        content: "Nao foi possivel finalizar o ticket agora.",
        ephemeral: true,
      }).catch(() => null);
    } finally {
      ratingLocks.delete(interaction.channelId);
    }
  },
});
