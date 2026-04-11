import { appConfig } from "#config";
import { prisma } from "#database";

const channelPointsConfig = appConfig.twitch.channelPoints;

type ChannelPointsInput = {
  userId: number;
  baseHours?: number;
};

type ChannelPointFlags = {
  isTwitchSub: boolean;
  isDiscordBooster: boolean;
};

export function getChannelPointBreakdown({
  isTwitchSub,
  isDiscordBooster,
}: ChannelPointFlags) {
  const multipliers = [
    {
      label: "Base",
      value: channelPointsConfig.baseMultiply,
      active: true,
    },
    {
      label: "Sub Twitch",
      value: channelPointsConfig.subMultiply,
      active: isTwitchSub,
    },
    {
      label: "Booster Discord",
      value: channelPointsConfig.boosterMultiply,
      active: isDiscordBooster,
    },
    {
      label: "Evento",
      value: channelPointsConfig.eventMultiply,
      active: channelPointsConfig.eventMultiplierActive && channelPointsConfig.eventMultiply > 1,
    },
  ];

  const activeMultipliers = multipliers.filter((multiplier) => multiplier.active);
  const totalMultiplier = activeMultipliers.reduce((total, multiplier) => {
    return total * multiplier.value;
  }, 1);

  return {
    basePoints: channelPointsConfig.points,
    totalMultiplier,
    activeBonuses: activeMultipliers,
  };
}

export async function calculateChannelPoints({
  userId,
  baseHours = 10 / 60,
}: ChannelPointsInput) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isTwitchSub: true,
      isDiscordBooster: true,
    },
  });

  if (!user) {
    const breakdown = getChannelPointBreakdown({
      isTwitchSub: false,
      isDiscordBooster: false,
    });

    return {
      points: Math.floor(channelPointsConfig.points * breakdown.totalMultiplier),
      hours: baseHours,
      multiplier: breakdown.totalMultiplier,
      activeBonuses: breakdown.activeBonuses,
    };
  }

  const breakdown = getChannelPointBreakdown({
    isTwitchSub: user.isTwitchSub,
    isDiscordBooster: user.isDiscordBooster,
  });

  return {
    points: Math.floor(channelPointsConfig.points * breakdown.totalMultiplier),
    hours: baseHours,
    multiplier: breakdown.totalMultiplier,
    activeBonuses: breakdown.activeBonuses,
  };
}
