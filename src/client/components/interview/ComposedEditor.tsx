import type { Busy } from "../../hooks/useInterview";
import { DiaryEditor } from "../DiaryEditor";
import { Button } from "../ui/button";

/** AI がまとめた日記を直して保存する画面。書き直しと会話に戻る操作も出す */
export function ComposedEditor({
  body,
  busy,
  onSave,
  onRecompose,
  onBack,
}: {
  body: string;
  busy: Busy;
  onSave: (body: string, mood: number | null) => void;
  onRecompose: () => void;
  onBack: () => void;
}) {
  return (
    // 書き直したら編集中の内容を新しい本文に入れ替える
    <DiaryEditor key={body} initialBody={body} initialMood={null} saving={busy === "save"} onSave={onSave}>
      <Button variant="outline" disabled={busy !== null} onClick={onRecompose}>
        {busy === "compose" ? "書き直し中…" : "AI に書き直してもらう"}
      </Button>
      <Button variant="ghost" disabled={busy !== null} onClick={onBack}>
        会話に戻る
      </Button>
    </DiaryEditor>
  );
}
