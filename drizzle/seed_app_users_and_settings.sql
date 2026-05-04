-- Run after migration `0007_app_users_sessions_settings_audit` (e.g. `pnpm db:push` / `drizzle-kit migrate`).
-- Idempotent inserts for default admin + app_settings.

SET NAMES utf8mb4;

SET @admin_id = '11111111-1111-4111-8111-111111111111';

INSERT INTO `app_users` (
  `id`,
  `email`,
  `username`,
  `full_name`,
  `role`,
  `office`,
  `phone`,
  `password_hash`,
  `is_active`,
  `last_login_at`,
  `created_at`,
  `created_by`,
  `updated_at`,
  `deactivated_at`
) VALUES (
  @admin_id,
  'tbarnes@lee-associates.com',
  'tbarnes',
  'Taylor Barnes',
  'admin',
  NULL,
  NULL,
  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  true,
  NULL,
  UTC_TIMESTAMP(3),
  NULL,
  UTC_TIMESTAMP(3),
  NULL
)
ON DUPLICATE KEY UPDATE
  `email` = VALUES(`email`),
  `username` = VALUES(`username`),
  `full_name` = VALUES(`full_name`),
  `role` = VALUES(`role`),
  `password_hash` = VALUES(`password_hash`),
  `is_active` = VALUES(`is_active`),
  `updated_at` = UTC_TIMESTAMP(3);

INSERT INTO `app_settings` (`key`, `value`, `description`, `category`, `updated_at`, `updated_by`) VALUES
(
  'branding.company_name',
  JSON_QUOTE('Lee & Associates Newport Beach'),
  'Public-facing company name',
  'branding',
  UTC_TIMESTAMP(3),
  @admin_id
),
(
  'branding.support_email',
  JSON_QUOTE('tbarnes@lee-associates.com'),
  'Inbound support / reply-to',
  'branding',
  UTC_TIMESTAMP(3),
  @admin_id
),
(
  'workflow.confidential_warning_enabled',
  CAST('true' AS JSON),
  'Whether to show confidential workflow warnings',
  'workflow',
  UTC_TIMESTAMP(3),
  @admin_id
),
(
  'security.session_timeout_hours',
  CAST('12' AS JSON),
  'Idle session timeout in hours',
  'security',
  UTC_TIMESTAMP(3),
  @admin_id
),
(
  'notifications.email_on_submission',
  CAST('true' AS JSON),
  'Send email when a new submission arrives',
  'notifications',
  UTC_TIMESTAMP(3),
  @admin_id
)
ON DUPLICATE KEY UPDATE
  `value` = VALUES(`value`),
  `description` = VALUES(`description`),
  `category` = VALUES(`category`),
  `updated_at` = VALUES(`updated_at`),
  `updated_by` = VALUES(`updated_by`);
