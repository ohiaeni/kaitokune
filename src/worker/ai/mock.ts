import type { Prompt, TextGenerator } from "./provider";

/** 次の質問として順に返す固定の質問 */
const QUESTIONS = [
  "今日はどんな一日でしたか？",
  "それはよかったですね。そのとき、どんな気持ちでしたか？",
  "今日食べたもので印象に残っているものはありますか？",
  "明日はどんなことをしたいですか？",
];

/** buildNextQuestionPrompt の「次は N 問目です。」 */
const QUESTION_NUMBER = /次は (\d+) 問目です。/;
/** buildComposePrompt の「A1: ...」の行 */
const ANSWER_LINE = /^A\d+: (.+)$/gm;

/** 何問目かをプロンプトから読み取る */
function questionNumber(prompt: Prompt): number {
  const match = QUESTION_NUMBER.exec(prompt.user);
  return match ? Number(match[1]) : 1;
}

function nextQuestion(prompt: Prompt): string {
  const n = questionNumber(prompt);
  // 終わってよいとき（buildNextQuestionPrompt が {"done": true} を案内しているとき）は、質問を使い切ったら終える
  if (prompt.system.includes('{"done": true}') && n > QUESTIONS.length) {
    return JSON.stringify({ done: true });
  }
  return JSON.stringify({ question: QUESTIONS[(n - 1) % QUESTIONS.length] });
}

/** 回答をつなげて、それらしい日記にする */
function composed(prompt: Prompt): string {
  const answers = [...prompt.user.matchAll(ANSWER_LINE)].map((m) => m[1].trim());
  return [
    "（モックの AI が書いた日記です）",
    "",
    answers.join("\n\n") || "今日もいろいろなことがあった。",
    "",
    "### 明日やってみること",
    "- 昼休みに 5 分だけ外を歩く",
    "- 寝る前にスマホを置いて 10 分早く布団に入る",
  ].join("\n");
}

/**
 * 開発用のモック（`npm run dev`）。AI を呼ばずに、parseNextQuestion・parseComposed が受け付ける固定の応答を返す。
 * 無料枠を使わず、オフラインでも動き、毎回同じ応答になる
 */
export function createMockAI(): TextGenerator {
  return {
    name: "mock",
    generate(prompt: Prompt) {
      return Promise.resolve(prompt.json ? nextQuestion(prompt) : composed(prompt));
    },
  };
}
