import type { ReactNode } from "react";

/** 表示するものがないときのメッセージ */
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-sm text-stone-500">{children}</p>;
}
