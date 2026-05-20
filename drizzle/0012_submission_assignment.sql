-- Track which admin is working on each submission and when it was completed.
ALTER TABLE `submissions` ADD COLUMN `assignedTo` varchar(128) NULL;
--> statement-breakpoint
ALTER TABLE `submissions` ADD COLUMN `assignedToOpenId` varchar(64) NULL;
--> statement-breakpoint
ALTER TABLE `submissions` ADD COLUMN `assignedAt` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `submissions` ADD COLUMN `completedBy` varchar(128) NULL;
--> statement-breakpoint
ALTER TABLE `submissions` ADD COLUMN `completedAt` timestamp NULL;
