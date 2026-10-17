export type Level = { name: string; min: number; perk: string };
export type Badge = { id: string; title: string; description: string; min: number };

export const LEVELS: Level[] = [
  { name: "New Donor", min: 0, perk: "Welcome to the community" },
  { name: "Life Saver", min: 1, perk: "Digital certificate for every verified donation" },
  { name: "Bronze Hero", min: 3, perk: "Bronze badge and partner discounts" },
  { name: "Silver Hero", min: 5, perk: "Silver badge and a thank-you gift" },
  { name: "Gold Hero", min: 10, perk: "Gold badge, gift box and priority partner offers" },
  { name: "Platinum Hero", min: 25, perk: "Platinum badge and annual recognition event" },
  { name: "Legend", min: 50, perk: "Hall of fame and special award" },
];

export const BADGES: Badge[] = [
  { id: "first-drop", title: "First Drop", description: "Completed your first verified donation", min: 1 },
  { id: "triple", title: "Triple Saver", description: "3 verified donations", min: 3 },
  { id: "high-five", title: "High Five", description: "5 verified donations", min: 5 },
  { id: "ten", title: "Decade of Giving", description: "10 verified donations", min: 10 },
  { id: "quarter", title: "Quarter Century", description: "25 verified donations", min: 25 },
  { id: "fifty", title: "Golden Heart", description: "50 verified donations", min: 50 },
];

export function getRewardStatus(verifiedDonations: number) {
  const level = [...LEVELS].reverse().find((l) => verifiedDonations >= l.min) ?? LEVELS[0]!;
  const nextLevel = LEVELS.find((l) => l.min > verifiedDonations) ?? null;
  const progress = nextLevel
    ? Math.round(((verifiedDonations - level.min) / (nextLevel.min - level.min)) * 100)
    : 100;
  return {
    level,
    nextLevel,
    progress,
    earnedBadges: BADGES.filter((b) => verifiedDonations >= b.min),
    lockedBadges: BADGES.filter((b) => verifiedDonations < b.min),
  };
}
