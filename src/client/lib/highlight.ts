/**
 * 検索語に一致した部分を強調できるよう、テキストを一致した部分とそれ以外に分ける。
 * API の LIKE と同じく ASCII の大文字・小文字は区別しない。空の部分は含めない
 */
export function splitByQuery(text: string, q: string): { text: string; match: boolean }[] {
  if (!q) return text ? [{ text, match: false }] : [];
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i"));
  // 正規表現にキャプチャを含めて split すると、一致した部分が奇数番目に入る
  return parts.map((part, i) => ({ text: part, match: i % 2 === 1 })).filter((part) => part.text !== "");
}
