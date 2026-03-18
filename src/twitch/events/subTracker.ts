import { prisma } from "#database";

export async function processSubscription(tags: any) {
    
    const msgId = tags["msg-id"];
    const twitchId = tags["user-id"];
    const username = tags.username?.toLowerCase();

    if (msgId|| !twitchId) return;

    const subEvents = ["sub", "resub", "subgift", "anonsubgift", "primepaidupgrade", "primepaidupgradegift"];


    if (!subEvents.includes(msgId)) return;

    console.log("📩 Nova inscrição:", username);

    try {

        const user = await prisma.user.findUnique({
            where: { twitchId }
        });

        if (!user) {
            console.log("Usuario não encontrado na base de dados ");
            return;
        } 
    
        await prisma.user.update({
            where: { id: user.id },
            data: {
                isTwitchSub: true
            }
        });
    } catch (error) {
        console.error("Erro ao processar inscrição:", error);
    }
}