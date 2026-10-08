import { MOODS } from "../../shared/constants";

export { MOODS };

export function moodEmoji(mood: number | null): string | null {
  return MOODS.find((m) => m.value === mood)?.emoji ?? null;
}
