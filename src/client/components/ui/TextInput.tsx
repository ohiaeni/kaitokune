import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

/** 入力欄に共通の枠・背景・フォーカス時の強調 */
const FIELD =
  "border border-stone-300 bg-white outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-900";

type Shape = "pill" | "box";

const SHAPES: Record<Shape, string> = {
  /** 丸い形。ボタンと横に並べる 1 行の入力欄 */
  pill: "rounded-full px-4 py-2 text-sm",
  /** 四角い形 */
  box: "rounded-xl px-3 py-2",
};

export function TextInput({
  variant = "box",
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { variant?: Shape }) {
  return <input className={`${SHAPES[variant]} ${FIELD} ${className}`} {...props} />;
}

/** 複数行の入力欄（四角い形） */
export function TextArea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`w-full resize-y rounded-xl p-3 leading-relaxed ${FIELD} ${className}`} {...props} />;
}
