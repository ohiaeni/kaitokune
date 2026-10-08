-- 日記・会話ログ・メモ・AI の利用回数に user_id を持たせ、既存の行はすべて id=1 のユーザー（0003_seed-owner）に割り当てる。
-- drizzle-kit が生成した SQL は (1) 古いテーブルにない user_id を SELECT し、(2) D1 ではトランザクション中に
-- PRAGMA foreign_keys=OFF が効かないため、entries を DROP すると ON DELETE CASCADE で qa_logs が消えてしまう。
-- そのため CREATE TABLE・CREATE INDEX は生成されたものと同じにしたまま、データの移し方だけを書き換えている。
-- 手順: 古いテーブルを __old_* に RENAME する（qa_logs の外部キーも __old_entries を指すように書き換わる）
-- → 新しいテーブルを作ってコピー → 参照する側（子）から古いテーブルを DROP する。
ALTER TABLE `entries` RENAME TO `__old_entries`;--> statement-breakpoint
ALTER TABLE `qa_logs` RENAME TO `__old_qa_logs`;--> statement-breakpoint
ALTER TABLE `ai_usage` RENAME TO `__old_ai_usage`;--> statement-breakpoint
ALTER TABLE `notes` RENAME TO `__old_notes`;--> statement-breakpoint
DROP INDEX `qa_logs_entry_date_idx`;--> statement-breakpoint
DROP INDEX `notes_date_idx`;--> statement-breakpoint
CREATE TABLE `entries` (
	`user_id` integer NOT NULL,
	`date` text NOT NULL,
	`body` text NOT NULL,
	`mood` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `date`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `qa_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`entry_date` text NOT NULL,
	`position` integer NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`,`entry_date`) REFERENCES `entries`(`user_id`,`date`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `qa_logs_user_entry_date_idx` ON `qa_logs` (`user_id`,`entry_date`);--> statement-breakpoint
CREATE TABLE `ai_usage` (
	`user_id` integer NOT NULL,
	`date` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `date`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`date` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notes_user_date_idx` ON `notes` (`user_id`,`date`);--> statement-breakpoint
INSERT INTO `entries`("user_id", "date", "body", "mood", "created_at", "updated_at") SELECT 1, "date", "body", "mood", "created_at", "updated_at" FROM `__old_entries`;--> statement-breakpoint
INSERT INTO `qa_logs`("id", "user_id", "entry_date", "position", "question", "answer") SELECT "id", 1, "entry_date", "position", "question", "answer" FROM `__old_qa_logs`;--> statement-breakpoint
INSERT INTO `ai_usage`("user_id", "date", "count") SELECT 1, "date", "count" FROM `__old_ai_usage`;--> statement-breakpoint
INSERT INTO `notes`("id", "user_id", "date", "body", "created_at") SELECT "id", 1, "date", "body", "created_at" FROM `__old_notes`;--> statement-breakpoint
DROP TABLE `__old_qa_logs`;--> statement-breakpoint
DROP TABLE `__old_entries`;--> statement-breakpoint
DROP TABLE `__old_ai_usage`;--> statement-breakpoint
DROP TABLE `__old_notes`;
