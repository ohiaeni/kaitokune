import { z } from "zod";
import type { NextResponse, QA } from "../../shared/schemas";
import type { Prompt } from "./provider";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${y}年${m}月${d}日（${weekday}）`;
}

function formatQA(qa: QA[]): string {
  return qa.map((x, i) => `Q${i + 1}: ${x.question}\nA${i + 1}: ${x.answer}`).join("\n\n");
}

export function buildNextQuestionPrompt(input: {
  date: string;
  qa: QA[];
  recent: string[];
  allowDone: boolean;
}): Prompt {
  const output = input.allowDone
    ? `次の質問をする場合は {"question": "質問文"}、日記を書くのに十分な材料が集まった場合は {"done": true} を返してください。`
    : `{"question": "質問文"} の形式で次の質問を返してください。`;

  const system = [
    "あなたは、ユーザーが毎日の日記を書くのを手伝う、聞き上手なインタビュアーです。",
    "ユーザーに 1 問ずつ質問し、その回答から日記の材料を集めます。",
    "",
    "# 質問のルール",
    "- 質問は 1 つだけ。60 文字以内の短い日本語で、気軽に答えられるものにする",
    "- 最初の質問は、今日の出来事全体について答えやすいものにする",
    "- 2 問目以降は、直前の回答を深掘りする（そのとき何を感じたか、なぜそうしたか、など）か、まだ聞いていない話題（人、食事、気分、明日のことなど）に広げる",
    "- 同じ内容の質問を繰り返さない。回答を否定・評価しない",
    "- 質問の前に、回答への短い共感の一言を添えてもよい（例:「それは嬉しいですね。」）",
    "",
    "# 出力形式",
    "JSON オブジェクトだけを出力してください。前後に説明文やコードブロックを付けないでください。",
    output,
  ].join("\n");

  const parts = [`今日の日付: ${formatDate(input.date)}`];
  if (input.recent.length > 0) {
    parts.push(`# 最近の日記（参考。話題をつなげてもよい）\n${input.recent.map((r) => `- ${r}`).join("\n")}`);
  }
  parts.push(
    input.qa.length > 0
      ? `# これまでの質問と回答\n${formatQA(input.qa)}`
      : "# これまでの質問と回答\n（まだありません。最初の質問をしてください）",
  );
  parts.push(`次は ${input.qa.length + 1} 問目です。`);

  return { system, user: parts.join("\n\n"), json: true };
}

const nextResultSchema = z.union([
  z.object({ question: z.string().trim().min(1).max(300) }),
  z.object({ done: z.literal(true) }),
]);

/** モデルの出力から最初の JSON オブジェクトを取り出す（コードブロックや前置きが付いていても許容する） */
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error(`JSON not found in AI output: ${text.slice(0, 200)}`);
  return JSON.parse(text.slice(start, end + 1));
}

export function parseNextQuestion(text: string, allowDone: boolean): NextResponse {
  const result = nextResultSchema.parse(extractJson(text));
  if ("done" in result) {
    if (!allowDone) throw new Error("AI ended the conversation too early");
    return { done: true };
  }
  return { question: result.question };
}

export function buildComposePrompt(input: { date: string; qa: QA[] }): Prompt {
  const system = [
    "あなたは、インタビューの回答をもとに、本人に代わって日記を書くアシスタントです。",
    "",
    "# 書き方のルール",
    "- 本人の一人称（「私」または主語の省略）で、自然な日記の文体（です・ます調ではなく、だ・である調寄りのくだけた文体）で書く",
    "- 回答に書かれている事実と気持ちだけを使う。回答にない出来事や感情を創作しない",
    "- 回答の言葉づかいや表現をできるだけ活かす",
    "- 200〜400 文字程度。段落に分けて読みやすくする",
    "- 日付・タイトル・見出し・箇条書きは付けず、本文だけを出力する",
  ].join("\n");

  const user = `日付: ${formatDate(input.date)}\n\n# インタビューの内容\n${formatQA(input.qa)}\n\nこの内容で今日の日記を書いてください。`;

  return { system, user, json: false };
}

export function parseDiary(text: string): string {
  const body = text
    .trim()
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/\n?```$/, "")
    .trim();
  if (body.length < 10) throw new Error(`AI output is too short: ${body}`);
  return body;
}
