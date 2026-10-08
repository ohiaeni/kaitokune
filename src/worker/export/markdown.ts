import { findMood } from "../../shared/constants";
import { formatDate } from "../../shared/date";
import type { ExportFile } from "../../shared/schemas";

/** 人が読むための Markdown。1 日ごとに見出し・気分・本文を並べ、AI との会話は折りたたむ */
export function toMarkdown(file: ExportFile): string {
  const sections = file.entries.map((entry) => {
    const lines = [`## ${formatDate(entry.date, { withYear: true })}`, ""];
    const mood = findMood(entry.mood);
    if (mood) {
      lines.push(`気分: ${mood.emoji} ${mood.label}`, "");
    }
    lines.push(entry.body);
    if (entry.qa.length > 0) {
      lines.push("", "<details>", "<summary>AI との会話</summary>", "");
      for (const { question, answer } of entry.qa) {
        lines.push(`**Q. ${question}**`, "", `A. ${answer}`, "");
      }
      lines.push("</details>");
    }
    return lines.join("\n");
  });
  return [`# kaitokune の日記`, "", `${file.exportedAt} にエクスポート（${file.entries.length} 件）`, ...sections]
    .join("\n\n")
    .concat("\n");
}
