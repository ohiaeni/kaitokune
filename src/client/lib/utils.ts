import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** クラス名をつなげ、Tailwind のクラスが重なったら後のものを優先する（shadcn/ui の部品が使う） */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
