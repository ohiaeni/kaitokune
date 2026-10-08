import { useState } from "react";
import { SEARCH_QUERY_MAX_LENGTH } from "../../../shared/constants";
import { Button, TextInput } from "../ui";

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
        <TextInput
          variant="pill"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={SEARCH_QUERY_MAX_LENGTH}
          placeholder="日記を検索"
          aria-label="日記を検索"
          className="min-w-0 flex-1"
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
