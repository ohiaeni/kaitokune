import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { currentMonth, formatMonth, shiftMonth } from "../../lib/date";
import { Button } from "../ui/button";

/** 月の見出しと、前後の月への移動。今月より先には進めない */
export function MonthNav({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const isCurrent = month >= currentMonth();
  return (
    <div className="flex items-center justify-between">
      <Button variant="ghost" size="icon-lg" aria-label="前の月" onClick={() => onChange(shiftMonth(month, -1))}>
        <ChevronLeftIcon />
      </Button>
      <h1 className="text-xl font-bold">{formatMonth(month)}</h1>
      <Button
        variant="ghost"
        size="icon-lg"
        aria-label="次の月"
        disabled={isCurrent}
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        <ChevronRightIcon />
      </Button>
    </div>
  );
}
