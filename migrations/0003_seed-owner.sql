-- 既存の日記・会話ログ・メモ・AI の利用回数の持ち主になるユーザー。次のマイグレーションでこの id=1 に割り当てる。
-- リポジトリは公開なので仮のメールアドレスにしておき、本番ではデプロイ後に本物のアドレスへ書き換える（docs/setup.md）。
-- ローカル開発では .dev.vars の DEV_USER_EMAIL をこのアドレスにしておけば、そのまま既存のデータを使える。
INSERT INTO `users` (`id`, `email`, `created_at`) VALUES (1, 'owner@example.invalid', unixepoch() * 1000);
