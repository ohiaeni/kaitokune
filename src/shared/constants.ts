// クライアントからも import するため、zod に依存させない（バンドルサイズ削減）

/** 1 日の会話で最低限答える質問数（これ未満では AI は会話を終わらせない） */
export const MIN_QUESTIONS = 3;
/** 1 日の会話の最大質問数（これに達したらサーバーが強制的に終了する） */
export const MAX_QUESTIONS = 5;

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const MONTH_PATTERN = /^\d{4}-\d{2}$/;
