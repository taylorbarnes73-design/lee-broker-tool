ALTER TABLE `brokerAdminRequests` MODIFY COLUMN `emailMessageId` varchar(512) NOT NULL;--> statement-breakpoint
ALTER TABLE `brokerAdminRequests` MODIFY COLUMN `internetMessageId` varchar(512);--> statement-breakpoint
ALTER TABLE `brokerAdminRequests` MODIFY COLUMN `threadKey` varchar(512);