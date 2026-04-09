import { prisma } from "#database";

const POINTS = 30;
const BASE_MULTIPLY = 1;
const SUB_MULTIPLY = 1.5;
const BOOSTER_MULTIPLY = 1.25;
const EVENT_MULTIPLY = 1;
const EVENT_MULTIPLIER_ACTIVE = false;

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
      value: BASE_MULTIPLY,
      active: true,
    },
    {
      label: "Sub Twitch",
      value: SUB_MULTIPLY,
      active: isTwitchSub,
    },
    {
      label: "Booster Discord",
      value: BOOSTER_MULTIPLY,
      active: isDiscordBooster,
    },
    {
      label: "Evento",
      value: EVENT_MULTIPLY,
      active: EVENT_MULTIPLIER_ACTIVE && EVENT_MULTIPLY > 1,
    },
  ];

  const activeMultipliers = multipliers.filter((multiplier) => multiplier.active);
  const totalMultiplier = activeMultipliers.reduce((total, multiplier) => {
    return total * multiplier.value;
  }, 1);

  return {
    basePoints: POINTS,
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
      points: Math.floor(POINTS * breakdown.totalMultiplier),
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
    points: Math.floor(POINTS * breakdown.totalMultiplier),
    hours: baseHours,
    multiplier: breakdown.totalMultiplier,
    activeBonuses: breakdown.activeBonuses,
  };
}
