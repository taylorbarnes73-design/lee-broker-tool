ALTER TABLE `submissions` ADD `status` varchar(32) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `pdfFileKey` varchar(512);--> statement-breakpoint
ALTER TABLE `submissions` ADD `pdfUrl` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;