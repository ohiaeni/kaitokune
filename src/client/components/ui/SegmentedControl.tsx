/** いくつかの選択肢から 1 つを選ぶ切り替えボタン。選んだものだけ強調する */
export function SegmentedControl<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  /** スクリーンリーダー向けの見出し */
  legend: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex self-center rounded-full bg-stone-200/60 p-1 dark:bg-stone-800">
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-full px-4 py-1 text-sm transition ${
            value === option.value
              ? "bg-white font-medium text-stone-900 shadow-sm dark:bg-stone-950 dark:text-stone-50"
              : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
          }`}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}
