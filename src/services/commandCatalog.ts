export type CommandEntry = {
  name: string;
  description: string;
};

export type CommandCategory = {
  id: string;
  label: string;
  description: string;
  commands: CommandEntry[];
};

function buildCommandCategory(
  id: string,
  label: string,
  description: string,
  commands: CommandEntry[]
): CommandCategory {
  return {
    id,
    label,
    description,
    commands,
  };
}

function getCommandByName(categories: CommandCategory[], commandName: string) {
  for (const category of categories) {
    const command = category.commands.find((entry) => entry.name === commandName);
    if (command) {
      return command;
    }
  }

  return null;
}

export const discordCommandCategories: CommandCategory[] = [
  {
    id: "conta",
    label: "Conta e Perfil",
    description: "Fluxos de vinculacao, consulta de perfil e acesso pessoal.",
    commands: [
      {
        name: "/link",
        description: "Vincula a conta do Discord com a Twitch para liberar integracoes, beneficios e perfil web.",
      },
      {
        name: "/profile",
        description: "Mostra o perfil do usuario com saldo, horas assistidas, bonus ativos e status da conta.",
      },
      {
        name: "/lgpd",
        description: "Exibe o resumo de privacidade, exporta dados e registra solicitacoes do titular.",
      },
      {
        name: "/pedirmusica",
        description: "Busca uma musica no Spotify e adiciona a faixa na fila da conta configurada no bot.",
      },
      {
        name: "/playlist",
        description: "Mostra a musica atual e as proximas faixas da fila do Spotify.",
      },
    ],
  },
  {
    id: "economia",
    label: "Economia",
    description: "Consulta, transferencia e operacao do sistema de Firecoins.",
    commands: [
      {
        name: "/pontos",
        description: "Consulta rapidamente o saldo atual de Firecoins no Discord.",
      },
      {
        name: "/pay",
        description: "Transfere Firecoins entre usuarios com validacao e trilha de auditoria.",
      },
      {
        name: "/pointstatus",
        description: "Mostra o estado atual do sistema de pontos e do evento em andamento.",
      },
    ],
  },
  {
    id: "moderacao",
    label: "Moderacao e Suporte",
    description: "Ferramentas internas para disciplina, tickets e orientacao da staff.",
    commands: [
      {
        name: "/warn",
        description: "Aplica advertencia e aciona a moderacao progressiva quando o limite for atingido.",
      },
      {
        name: "/regrasmoderacao",
        description: "Limpa o canal atual e republica as regras internas de moderacao para a staff.",
      },
      {
        name: "/transferir",
        description: "Move a responsabilidade de um ticket para outro administrador.",
      },
      {
        name: "/live",
        description: "Consulta o status da live e verifica se a transmissao esta online.",
      },
    ],
  },
  {
    id: "admin",
    label: "Admin de Pontos e Servidor",
    description: "Controles administrativos de evento, multiplicador e publicacao.",
    commands: [
      {
        name: "/eventstart",
        description: "Inicia um evento temporario de multiplicador para o sistema de pontos.",
      },
      {
        name: "/eventstop",
        description: "Encerra o evento ativo de multiplicador.",
      },
      {
        name: "/basemultiply",
        description: "Ajusta o multiplicador base do ganho de Firecoins.",
      },
      {
        name: "/regras",
        description: "Republica os embeds de regras no canal oficial do servidor.",
      },
      {
        name: "/comandos",
        description: "Publica um painel limpo com os comandos publicos de viewer no Discord e na Twitch.",
      },
      {
        name: "/comandosstaff",
        description: "Exibe somente os comandos internos usados por moderadores e administradores.",
      },
    ],
  },
];

export const twitchCommandCategories: CommandCategory[] = [
  {
    id: "comunidade",
    label: "Comunidade",
    description: "Atalhos publicos para os viewers durante a live.",
    commands: [
      {
        name: "!discord",
        description: "Entrega o atalho oficial para a comunidade no Discord.",
      },
      {
        name: "!site",
        description: "Entrega o link oficial do site da live com painel e recompensas.",
      },
      {
        name: "!recompensa",
        description: "Alias de !site para abrir o portal oficial de recompensas da live.",
      },
      {
        name: "!pedirmusica",
        description: "Busca uma musica no Spotify e adiciona a faixa na fila da conta configurada.",
      },
      {
        name: "!pontos",
        description: "Consulta o saldo de Firecoins direto pelo chat da Twitch.",
      },
      {
        name: "!events",
        description: "Lista o evento de pontos ativo e o multiplicador atual da live.",
      },
    ],
  },
  {
    id: "economia",
    label: "Economia e Interacao",
    description: "Acoes economicas compartilhadas com o sistema do Discord.",
    commands: [
      {
        name: "!pay",
        description: "Permite transferir Firecoins usando identificadores de Twitch ou Discord.",
      },
    ],
  },
  {
    id: "moderacao",
    label: "Moderacao",
    description: "Comandos de acao disciplinar no chat da Twitch.",
    commands: [
      {
        name: "!warn",
        description: "Aciona a moderacao pela Twitch para advertir usuario vinculado ou nao.",
      },
    ],
  },
  {
    id: "admin",
    label: "Admin da Live",
    description: "Controles operacionais do bot para staff, mod e broadcaster.",
    commands: [
      {
        name: "!eventstart",
        description: "Abre um evento de multiplicador pelo chat para uso administrativo.",
      },
      {
        name: "!eventstop",
        description: "Fecha o evento de multiplicador ativo pelo chat.",
      },
      {
        name: "!basemultiply",
        description: "Ajusta o multiplicador base do ganho de Firecoins.",
      },
      {
        name: "!test",
        description: "Comando de validacao para testes operacionais do bot na Twitch.",
      },
    ],
  },
];

export const discordViewerCommandCategories: CommandCategory[] = [
  buildCommandCategory(
    "conta",
    "Conta e Perfil",
    "Fluxos de vinculacao, consulta de perfil e acesso pessoal.",
    [
      getCommandByName(discordCommandCategories, "/link"),
      getCommandByName(discordCommandCategories, "/profile"),
    ].filter((command): command is CommandEntry => Boolean(command))
  ),
  buildCommandCategory(
    "economia",
    "Economia",
    "Consulta, transferencia e operacao do sistema de Firecoins.",
    [
      getCommandByName(discordCommandCategories, "/pontos"),
      getCommandByName(discordCommandCategories, "/pay"),
      getCommandByName(discordCommandCategories, "/pointstatus"),
    ].filter((command): command is CommandEntry => Boolean(command))
  ),
  buildCommandCategory(
    "interacoes",
    "Interacoes",
    "Acoes da live para interagir diretamente com o streamer e a comunidade.",
    [
      getCommandByName(discordCommandCategories, "/pedirmusica"),
    ].filter((command): command is CommandEntry => Boolean(command))
  ),
  buildCommandCategory(
    "utilidades",
    "Utilidades",
    "Consultas e atalhos rapidos que ajudam durante a live.",
    [
      getCommandByName(discordCommandCategories, "/playlist"),
      getCommandByName(discordCommandCategories, "/live"),
      getCommandByName(discordCommandCategories, "/lgpd"),
    ].filter((command): command is CommandEntry => Boolean(command))
  ),
];

export const twitchViewerCommandCategories: CommandCategory[] = [
  buildCommandCategory(
    "comunidade",
    "Comunidade",
    "Atalhos publicos para os viewers durante a live.",
    [
      getCommandByName(twitchCommandCategories, "!discord"),
      getCommandByName(twitchCommandCategories, "!site"),
      getCommandByName(twitchCommandCategories, "!recompensa"),
      getCommandByName(twitchCommandCategories, "!events"),
    ].filter((command): command is CommandEntry => Boolean(command))
  ),
  buildCommandCategory(
    "economia",
    "Economia",
    "Consulta e movimentacao de Firecoins no chat da Twitch.",
    [
      getCommandByName(twitchCommandCategories, "!pontos"),
      getCommandByName(twitchCommandCategories, "!pay"),
    ].filter((command): command is CommandEntry => Boolean(command))
  ),
  buildCommandCategory(
    "interacoes",
    "Interacoes",
    "Comandos de participacao direta durante a stream.",
    [
      getCommandByName(twitchCommandCategories, "!pedirmusica"),
    ].filter((command): command is CommandEntry => Boolean(command))
  ),
];

export const discordStaffCommandCategories: CommandCategory[] = [
  buildCommandCategory(
    "moderacao",
    "Moderacao e Suporte",
    "Ferramentas internas para disciplina, tickets e orientacao da staff.",
    [
      getCommandByName(discordCommandCategories, "/warn"),
      getCommandByName(discordCommandCategories, "/regrasmoderacao"),
      getCommandByName(discordCommandCategories, "/transferir"),
      getCommandByName(discordCommandCategories, "/live"),
    ].filter((command): command is CommandEntry => Boolean(command))
  ),
  buildCommandCategory(
    "admin",
    "Admin de Pontos e Servidor",
    "Controles administrativos de evento, multiplicador e publicacao.",
    [
      getCommandByName(discordCommandCategories, "/eventstart"),
      getCommandByName(discordCommandCategories, "/eventstop"),
      getCommandByName(discordCommandCategories, "/basemultiply"),
      getCommandByName(discordCommandCategories, "/regras"),
      getCommandByName(discordCommandCategories, "/comandos"),
      getCommandByName(discordCommandCategories, "/comandosstaff"),
    ].filter((command): command is CommandEntry => Boolean(command))
  ),
];

export const twitchStaffCommandCategories: CommandCategory[] = [
  buildCommandCategory(
    "moderacao",
    "Moderacao",
    "Comandos de acao disciplinar no chat da Twitch.",
    [
      getCommandByName(twitchCommandCategories, "!warn"),
    ].filter((command): command is CommandEntry => Boolean(command))
  ),
  buildCommandCategory(
    "admin",
    "Admin da Live",
    "Controles operacionais do bot para staff, mod e broadcaster.",
    [
      getCommandByName(twitchCommandCategories, "!eventstart"),
      getCommandByName(twitchCommandCategories, "!eventstop"),
      getCommandByName(twitchCommandCategories, "!basemultiply"),
      getCommandByName(twitchCommandCategories, "!test"),
    ].filter((command): command is CommandEntry => Boolean(command))
  ),
];
