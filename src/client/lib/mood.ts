export const MOODS = [
  { value: 1, emoji: "😞", label: "つらい" },
  { value: 2, emoji: "😕", label: "いまいち" },
  { value: 3, emoji: "😐", label: "ふつう" },
  { value: 4, emoji: "🙂", label: "よい" },
  { value: 5, emoji: "😄", label: "最高" },
] as const;

export function moodEmoji(mood: number | null): string | null {
  return MOODS.find((m) => m.value === mood)?.emoji ?? null;
}
