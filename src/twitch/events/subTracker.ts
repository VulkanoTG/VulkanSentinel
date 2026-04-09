import { prisma } from "#database";

type SubscriptionSyncInput = {
    twitchId: string;
    username?: string | null;
    isSubscribed: boolean;
    source?: string;
};

// Sincroniza o status de inscrição do usuário com base em eventos do Twitch (chat ou EventSub)
export async function syncSubscriptionStatus({
    twitchId,
    username,
    isSubscribed,
    source = "unknown",
}: SubscriptionSyncInput) {
    if (!twitchId) return;

    console.log(
        `[Subscription] ${isSubscribed ? "ATIVANDO" : "DESATIVANDO"} sub para ${username ?? twitchId} via ${source}`
    );

    try {
        const user = await prisma.user.findUnique({
            where: { twitchId },
            select: { id: true },
        });

        if (!user) {
            console.log(`[Subscription] Usuário com twitchId ${twitchId} não encontrado na base de dados.`);
            return;
        }

        await prisma.$executeRaw`
            UPDATE "User"
            SET "isTwitchSub" = ${isSubscribed}, "updatedAt" = NOW()
            WHERE "id" = ${user.id}
        `;
    } catch (error) {
        console.error("Erro ao sincronizar status de inscrição:", error);
    }
}

export async function processSubscription(tags: any) {
    const msgId = tags["msg-id"];
    const twitchId = tags["user-id"];
    const username = tags.username?.toLowerCase();

    if (!msgId || !twitchId) return;

    const subEvents = ["sub", "resub", "subgift", "anonsubgift", "primepaidupgrade", "primepaidupgradegift"];

    if (!subEvents.includes(msgId)) return;

    await syncSubscriptionStatus({
        twitchId,
        username,
        isSubscribed: true,
        source: "chat",
    });
}