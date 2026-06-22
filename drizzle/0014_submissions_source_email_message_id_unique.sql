-- BrokerAdmin email ingest: the existing plain index allowed duplicate
-- source_email_message_id values; make it UNIQUE so a duplicate insert
-- (e.g. a retried tick racing the email_ingest_log dedup check) fails loudly
-- instead of creating a second submission for the same email.
ALTER TABLE `submissions` DROP INDEX `submissions_source_email_message_id_idx`;
--> statement-breakpoint
ALTER TABLE `submissions` ADD UNIQUE INDEX `submissions_source_email_message_id_unique` (`source_email_message_id`);
