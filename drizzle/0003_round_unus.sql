ALTER TABLE `submissions` ADD `submittedByOpenId` varchar(64);--> statement-breakpoint
ALTER TABLE `submissions` ADD `submittedByEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `uploads` ADD `uploaderOpenId` varchar(64);