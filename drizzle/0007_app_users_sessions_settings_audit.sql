CREATE TABLE `app_users` (
	`id` char(36) NOT NULL,
	`email` varchar(320) NOT NULL,
	`username` varchar(64) NOT NULL,
	`full_name` varchar(255) NOT NULL,
	`role` enum('admin','broker','readonly') NOT NULL DEFAULT 'broker',
	`office` varchar(255),
	`phone` varchar(64),
	`password_hash` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`last_login_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	`created_by` char(36),
	`updated_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) ON UPDATE UTC_TIMESTAMP(3),
	`deactivated_at` datetime(3),
	CONSTRAINT `app_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `app_users_email_unique` UNIQUE(`email`),
	CONSTRAINT `app_users_username_unique` UNIQUE(`username`),
	CONSTRAINT `app_users_email_lowercase` CHECK(email = LOWER(email)),
	CONSTRAINT `app_users_username_lowercase` CHECK(username = LOWER(username))
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`token_hash` varchar(255) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	`ip_address` varchar(45),
	`user_agent` varchar(512),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `app_settings` (
	`key` varchar(255) NOT NULL,
	`value` json NOT NULL,
	`description` text,
	`category` enum('branding','notifications','integrations','workflow','security') NOT NULL,
	`updated_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) ON UPDATE UTC_TIMESTAMP(3),
	`updated_by` char(36),
	CONSTRAINT `app_settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` char(36) NOT NULL,
	`user_id` char(36),
	`action` varchar(128) NOT NULL,
	`target_type` varchar(64),
	`target_id` varchar(255),
	`metadata` json NOT NULL DEFAULT (JSON_OBJECT()),
	`ip_address` varchar(45),
	`created_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `app_settings` ADD CONSTRAINT `app_settings_updated_by_fk` FOREIGN KEY (`updated_by`) REFERENCES `app_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `app_users` ADD CONSTRAINT `app_users_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `app_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `sessions_token_hash_idx` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_log_created_at_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_log_user_id_idx` ON `audit_log` (`user_id`);
