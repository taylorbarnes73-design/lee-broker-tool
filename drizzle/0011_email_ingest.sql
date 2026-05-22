-- BrokerAdmin email ingest: dedupe + observability + submission linkage.
CREATE TABLE IF NOT EXISTS `email_ingest_log` (
  `id` int AUTO_INCREMENT NOT NULL,
  `message_id` varchar(512) NOT NULL,
  `internet_message_id` varchar(512),
  `thread_id` varchar(512),
  `received_at` datetime(3),
  `from_email` varchar(320),
  `to_emails` json,
  `cc_emails` json,
  `subject` varchar(1024),
  `submission_id` int,
  `ingest_status` varchar(32) NOT NULL DEFAULT 'imported',
  `error_message` text,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT `email_ingest_log_id` PRIMARY KEY (`id`),
  CONSTRAINT `email_ingest_log_message_id_unique` UNIQUE (`message_id`),
  CONSTRAINT `email_ingest_log_internet_message_id_unique` UNIQUE (`internet_message_id`)
);
--> statement-breakpoint
CREATE INDEX `eil_received_at_idx` ON `email_ingest_log` (`received_at`);
--> statement-breakpoint
CREATE INDEX `eil_ingest_status_idx` ON `email_ingest_log` (`ingest_status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `kv_state` (
  `key` varchar(255) NOT NULL,
  `value` json NOT NULL,
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT `kv_state_key` PRIMARY KEY (`key`)
);
--> statement-breakpoint
ALTER TABLE `submissions` ADD COLUMN `source` varchar(32) NOT NULL DEFAULT 'tool';
--> statement-breakpoint
ALTER TABLE `submissions` ADD COLUMN `source_email_message_id` varchar(512) NULL;
--> statement-breakpoint
ALTER TABLE `submissions` ADD COLUMN `source_email_web_link` text NULL;
--> statement-breakpoint
ALTER TABLE `submissions` ADD COLUMN `parsed_fields` json NULL;
--> statement-breakpoint
CREATE INDEX `submissions_source_email_message_id_idx` ON `submissions` (`source_email_message_id`);
