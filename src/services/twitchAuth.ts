import { env } from "#env";

// Token cache em memória para evitar pedir refresh toda hora
let cachedAccessToken: string | null = env.TWITCH_USER_TOKEN ?? null;
let tokenExpiresAt: number | null = null;
let refreshTimeout: NodeJS.Timeout | null = null;

export function getCachedTwitchAccessToken() {
	return cachedAccessToken;
}

export async function getTwitchAccessToken(): Promise<string | null> {
	// Se já temos um token em memória, usa ele
	if (cachedAccessToken) {
		return cachedAccessToken;
	}


	const clientId = env.TWITCH_CLIENT_ID;
	const clientSecret = env.TWITCH_CLIENT_SECRET;
	const refreshToken = env.TWITCH_REFRESH_TOKEN;

	if (!clientId || !clientSecret || !refreshToken) {
		console.warn("[TwitchAuth] Client ID/secret ou refresh token não configurados. Usando TWITCH_USER_TOKEN fixo.");
		return env.TWITCH_USER_TOKEN ?? null;
	}


	// Faz refresh do token de usuário
	const params = new URLSearchParams({
		grant_type: "refresh_token",
		refresh_token: refreshToken,
		client_id: clientId,
		client_secret: clientSecret,
	});

	const res = await fetch("https://id.twitch.tv/oauth2/token", {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: params.toString(),
	});

	if (!res.ok) {
		const body = await res.text();
		console.error(`[TwitchAuth] Falha ao renovar token da Twitch: ${res.status} ${body}`);
		return env.TWITCH_USER_TOKEN ?? null;
	}

	const data = await res.json() as {
		access_token?: string;
		expires_in?: number;
		refresh_token?: string;
		token_type?: string;
	};

	if (!data.access_token) {
		console.error("[TwitchAuth] Resposta de refresh não contém access_token");
		return env.TWITCH_USER_TOKEN ?? null;
	}
	cachedAccessToken = data.access_token;
	// Armazena o timestamp de expiração
	if (data.expires_in) {
		tokenExpiresAt = Date.now() + data.expires_in * 1000;
	} else {
		tokenExpiresAt = null;
	}

	// Agenda renovação automática 5 minutos antes de expirar
	if (tokenExpiresAt) {
		const msBeforeRefresh = Math.max(tokenExpiresAt - Date.now() - 5 * 60 * 1000, 0);
		if (refreshTimeout) clearTimeout(refreshTimeout);
		refreshTimeout = setTimeout(() => {
			cachedAccessToken = null; // força refresh
			getTwitchAccessToken().then(() => {
				console.log("[TwitchAuth] Token renovado automaticamente antes de expirar.");
			});
		}, msBeforeRefresh);
		console.log(`[TwitchAuth] Token renovado. Próxima renovação em ${(msBeforeRefresh/1000/60).toFixed(1)} minutos.`);
	} else {
		console.log("[TwitchAuth] Token renovado, mas sem info de expiração.");
	}

	return cachedAccessToken;
}

export function getTokenTimeLeft() {
	return tokenExpiresAt ? tokenExpiresAt - Date.now() : 0;
}

