import type { Context } from "hono";
import type { ApiErrorBody } from "../shared/schemas";

/** zValidator の失敗時に、API 共通のエラー形式で 400 を返す */
export function validationHook(
  result: { success: true } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } },
  c: Context,
) {
  if (!result.success) {
    const message = result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join(", ");
    return c.json<ApiErrorBody>({ error: "invalid_request", message }, 400);
  }
}
