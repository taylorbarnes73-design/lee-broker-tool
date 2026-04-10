CREATE TABLE `submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`formType` varchar(32) NOT NULL,
	`payload` text,
	`reference` varchar(512),
	`submittedBy` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `submissions_id` PRIMARY KEY(`id`)
);
