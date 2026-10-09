// モックの API が返すデータ。メモリ上にだけ持ち、ページを読み込み直すと初期状態に戻る
import type { Entry, Note, QA } from "../../shared/schemas";
import { today } from "../lib/date";
import type { Scenario } from "./scenarios";

type StoredEntry = Entry & { qa: QA[] };

const SAMPLE_BODIES = [
  "朝はゆっくりコーヒーを淹れて、窓を開けて過ごした。午後は近所の公園まで散歩して、帰りにパン屋に寄った。夜は早めに布団に入れたので、明日は気持ちよく起きられそう。",
  "仕事が立て込んでいて、昼ごはんを食べる時間がほとんどなかった。それでも夕方には一区切りついて、帰り道に見た夕焼けがきれいだった。",
  "友だちと久しぶりに電話した。近況を話しているうちに 1 時間たっていて驚いた。来月は会う約束をした。",
  "雨で一日家にいた。読みかけの本を最後まで読めたのがうれしい。夜はカレーを作った。",
];

const SAMPLE_QA: QA[] = [
  { question: "今日はどんな一日でしたか？", answer: "のんびり過ごせた" },
  { question: "印象に残ったことはありますか？", answer: "夕焼けがきれいだった" },
  { question: "明日はどう過ごしたいですか？", answer: "早起きして散歩したい" },
];

/** today から days 日前の日付（YYYY-MM-DD） */
function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return today(d);
}

function sampleEntry(date: string, i: number): StoredEntry {
  const time = new Date(`${date}T21:00:00`).getTime();
  return {
    date,
    body: SAMPLE_BODIES[i % SAMPLE_BODIES.length],
    mood: i % 6 === 5 ? null : (i % 5) + 1,
    suggestions: i % 3 === 0 ? [] : ["朝に 10 分散歩する", "寝る前にスマホを見ない"],
    createdAt: time,
    updatedAt: time,
    qa: i % 2 === 0 ? SAMPLE_QA : [],
  };
}

function initialEntries(scenario: Scenario): StoredEntry[] {
  if (scenario === "empty") {
    return [];
  }
  // 標準では、今日の日記は書いていない状態にする
  const days = scenario === "many" ? Array.from({ length: 365 }, (_, i) => i) : [1, 2, 4, 7, 12, 20, 33];
  return days.map((n, i) => sampleEntry(daysAgo(n), i));
}

export function createStore(scenario: Scenario) {
  const entries = new Map(initialEntries(scenario).map((e) => [e.date, e]));
  const notes: Note[] =
    scenario === "empty"
      ? []
      : [{ id: 1, date: today(), body: "昼に食べたラーメンがおいしかった", createdAt: Date.now() }];
  return {
    entries,
    notes,
    nextNoteId: notes.length + 1,
    /** 日付ごとの AI の呼び出し回数 */
    aiUsage: new Map<string, number>(),
  };
}
