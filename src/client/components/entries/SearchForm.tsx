import { useState } from "react";
import { SEARCH_QUERY_MAX_LENGTH } from "../../../shared/constants";
import { Button } from "../ui";

/** 日記の検索欄。initial があれば「クリア」も出す */
export function SearchForm({ initial, onSearch }: { initial: string; onSearch: (q: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <search>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSearch(value.trim());
        }}
      >
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={SEARCH_QUERY_MAX_LENGTH}
          placeholder="日記を検索"
          aria-label="日記を検索"
          className="min-w-0 flex-1 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 dark:border-stone-700 dark:bg-stone-900"
        />
        <Button type="submit" variant="secondary">
          検索
        </Button>
        {initial && (
          <Button variant="ghost" onClick={() => onSearch("")}>
            クリア
          </Button>
        )}
      </form>
    </search>
  );
}
