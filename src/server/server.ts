import express from "express";
import { prisma } from "#database";

type TwitchTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

type TwitchUserResponse = {
  data: {
    id: string;
    login: string;
    display_name: string;
  }[];
};


const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server running.");
});

app.get("/auth/twitch/callback", async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) {
    return res.status(400).send("Código ou state ausente.");
  }

  try {
    //Trocar code por access_token
    const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID!,
        client_secret: process.env.TWITCH_CLIENT_SECRET!,
        code: code as string,
        grant_type: "authorization_code",
        redirect_uri: process.env.TWITCH_REDIRECT_URI!,
      }),
    });

    const tokenData = (await tokenResponse.json()) as TwitchTokenResponse;

    if (!tokenData.access_token) {
      console.error(tokenData);
      return res.status(400).send("Erro ao obter access token.");
    }

    const accessToken = tokenData.access_token;

    //Buscar usuário na Twitch
    const userResponse = await fetch("https://api.twitch.tv/helix/users", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Client-Id": process.env.TWITCH_CLIENT_ID!,
      },
    });

   const userData = (await userResponse.json()) as TwitchUserResponse;
    const twitchUser = userData.data?.[0];

    if (!twitchUser) {
      return res.status(400).send("Usuário da Twitch não encontrado.");
    }

    const twitchId = twitchUser.id;
    const discordId = state as string;

    //Salvar no banco
    await prisma.user.upsert({
      where: { discordId },
      update: {
        twitchId,
        updatedAt: new Date(),
      },
      create: {
        discordId,
        twitchId,
      },
    });

    res.send("Conta vinculada com sucesso! Você pode fechar esta aba.");

  } catch (error) {
    console.error("Erro no callback:", error);
    res.status(500).send("Erro interno do servidor.");
  }
});

app.listen(3000, () => {
  console.log("HTTP Server rodando na porta 3000");
});