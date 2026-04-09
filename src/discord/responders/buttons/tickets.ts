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
  isDiscordAdmin,
  readTicketMetadata,
  sendTranscriptLog,
  sendUserDm,
  TICKET_CATEGORY_ID,
  updateTicketMetadata,
} from "../../../services/tickets.js";

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

    const type = interaction.fields.getTextInputValue("problem_type").trim();
    const description = interaction.fields.getTextInputValue("problem_description").trim();

    try {
      const { channel, ticketId } = await createTicketChannel({
        guildId: interaction.guildId,
        parentId: TICKET_CATEGORY_ID,
        ownerId: interaction.user.id,
        ownerUsername: interaction.user.username,
        ownerTag: interaction.user.tag,
        type,
        description,
      });

      await interaction.reply({
        content: `Seu ticket foi criado em ${channel}. Aguarde a equipe analisar. ID: #${ticketId}`,
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

    const metadata = readTicketMetadata(interaction.channel);
    if (!metadata) {
      await interaction.reply({
        content: "Esse canal nao parece ser um ticket valido.",
        ephemeral: true,
      });
      return;
    }

    if (metadata.status === "accepted") {
      await interaction.reply({
        content: "Esse ticket ja foi aceito.",
        ephemeral: true,
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

    await interaction.reply({
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

    await sendUserDm(
      metadata.ownerId,
      `Seu ticket #${metadata.ticketId} foi recusado pela equipe.`
    );

    await interaction.channel.delete("Ticket recusado");
  },
});

createResponder({
  customId: "/ticket/close",
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

    if (!metadata.acceptedById) {
      await interaction.reply({
        content: "Esse ticket ainda nao foi aceito por nenhum administrador.",
        ephemeral: true,
      });
      return;
    }

    const attachment = await createTranscriptAttachment(interaction.channel);
    const transcriptMessage = await sendTranscriptLog({
      ticketId: metadata.ticketId,
      ownerId: metadata.ownerId,
      ownerTag: metadata.ownerTag,
      acceptedById: metadata.acceptedById,
      attachment,
    });

    await updateTicketMetadata(interaction.channel, {
      status: "awaiting_rating",
      transcriptMessageId: transcriptMessage.id,
    });

    await interaction.channel.permissionOverwrites.edit(metadata.ownerId, {
      ViewChannel: true,
      SendMessages: false,
      ReadMessageHistory: true,
      AttachFiles: false,
      EmbedLinks: true,
    });

    await interaction.message.edit({
      components: [
        buildTicketActionRow({
          acceptDisabled: true,
          rejectDisabled: true,
          closeDisabled: true,
        }),
      ],
    });

    await interaction.reply({
      content: "Ticket fechado. Solicitando avaliacao do usuario.",
    });

    await interaction.channel.send({
      content: `<@${metadata.ownerId}> o atendimento foi encerrado. Avalie o suporte de <@${metadata.acceptedById}> de 1 a 5 estrelas abaixo.`,
      components: buildRatingRows(metadata.acceptedById),
    });
  },
});

const ratingSchema = z.object({
  stars: z.coerce.number().min(1).max(5),
  adminId: z.string(),
});

createResponder({
  customId: "/ticket/rate/:stars/:adminId",
  types: [ResponderType.Button],
  parse: ratingSchema.parse,
  async run(interaction, { stars }) {
    if (!(interaction.channel instanceof TextChannel)) {
      await interaction.reply({
        content: "Esse botao so funciona dentro do ticket.",
        ephemeral: true,
      });
      return;
    }

    const metadata = readTicketMetadata(interaction.channel);
    if (!metadata) {
      await interaction.reply({
        content: "Esse canal nao parece ser um ticket valido.",
        ephemeral: true,
      });
      return;
    }

    if (interaction.user.id !== metadata.ownerId) {
      await interaction.reply({
        content: "Somente quem abriu o ticket pode enviar a avaliacao.",
        ephemeral: true,
      });
      return;
    }

    const transcriptChannel = await interaction.client.channels.fetch("1491673864223199252");
    if (!transcriptChannel || !transcriptChannel.isTextBased() || transcriptChannel.isDMBased()) {
      await interaction.reply({
        content: "Canal de transcripts nao encontrado.",
        ephemeral: true,
      });
      return;
    }

    const transcriptUrl = metadata.transcriptMessageId
      ? `https://discord.com/channels/${interaction.guildId}/${transcriptChannel.id}/${metadata.transcriptMessageId}`
      : "Transcript sem link";

    if (metadata.transcriptMessageId && "messages" in transcriptChannel) {
      const transcriptMessage = await transcriptChannel.messages
        .fetch(metadata.transcriptMessageId)
        .catch(() => null);

      if (transcriptMessage) {
        await transcriptMessage.edit({
          content: `${transcriptMessage.content}\nAvaliacao: ${stars} estrela(s) por ${interaction.user}.\nTranscript: ${transcriptUrl}`,
        });
      }
    }

    await interaction.update({
      content: `${interaction.message.content}\n\nAvaliacao enviada: ${stars} estrela(s).`,
      components: [],
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));
    await interaction.channel.delete("Ticket finalizado e avaliado");
  },
});
