import { findMood } from "../../../shared/constants";
import type { Entry } from "../../../shared/schemas";
import { Card } from "../ui/card";

/** 日記の気分と本文 */
export function EntryBody({ entry }: { entry: Entry }) {
  const mood = findMood(entry.mood);
  return (
    <Card className="block p-4">
      {mood && (
        <p className="mb-3 text-sm text-muted-foreground">
          <span className="mr-1 text-xl" aria-hidden>
            {mood.emoji}
          </span>
          {mood.label}
        </p>
      )}
      <p className="whitespace-pre-wrap leading-loose">{entry.body}</p>
    </Card>
  );
}
