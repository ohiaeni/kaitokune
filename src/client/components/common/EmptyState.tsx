import type { ReactNode } from "react";
import { Empty, EmptyDescription } from "../ui/empty";

/** 表示するものがないときのメッセージ */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <Empty className="py-10 md:py-10">
      <EmptyDescription>{children}</EmptyDescription>
    </Empty>
  );
}
