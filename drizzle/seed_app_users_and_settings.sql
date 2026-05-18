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
) VALUES
  ('00000000-0000-0000-0000-000000000001', 'eabrego@lee-associates.com', 'eabrego', 'Eva Abrego', 'admin', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000002', 'fadler@lee-associates.com', 'fadler', 'Frank Adler', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000003', 'sahern@lee-associates.com', 'sahern', 'Sean Ahern', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000004', 'targuello@lee-associates.com', 'targuello', 'Tim Arguello', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000005', 'tbarnes@lee-associates.com', 'tbarnes', 'Taylor Barnes', 'admin', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000006', 'cbarnett@lee-associates.com', 'cbarnett', 'Chris Barnett', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000007', 'bbarson@lee-associates.com', 'bbarson', 'Brian Barson', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000008', 'dbolt@lee-associates.com', 'dbolt', 'David Bolt', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000009', 'mchristensen@lee-associates.com', 'mchristensen', 'Matt Christensen', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000010', 'edavidson@lee-associates.com', 'edavidson', 'Ethan Davidson', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000011', 'ndumke@lee-associates.com', 'ndumke', 'Nick Dumke', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000012', 'mdurkin@lee-associates.com', 'mdurkin', 'Matt Durkin', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000013', 'bgarbutt@lee-associates.com', 'bgarbutt', 'Brian Garbutt', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000014', 'jgessford@lee-associates.com', 'jgessford', 'John Gessford', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000015', 'lgessford@lee-associates.com', 'lgessford', 'Libby Gessford', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000016', 'pgills@lee-associates.com', 'pgills', 'Pitzer Gills', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000017', 'kgould@lee-associates.com', 'kgould', 'Ken Gould', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000018', 'bgriffin@lee-associates.com', 'bgriffin', 'Bob Griffin', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000019', 'jgrijalva@lee-associates.com', 'jgrijalva', 'Jeff Grijalva', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000020', 'charrington@lee-associates.com', 'charrington', 'Carter Harrington', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000021', 'jhietbrink@lee-associates.com', 'jhietbrink', 'Judd Hietbrink', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000022', 'jhirsch@lee-associates.com', 'jhirsch', 'Jeff Hirsch', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000023', 'jhogan@lee-associates.com', 'jhogan', 'Jack Hogan', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000024', 'dkluver@lee-associates.com', 'dkluver', 'David Kluver', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000025', 'mlawer@lee-associates.com', 'mlawer', 'Matt Lawer', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000026', 'mlong@lee-associates.com', 'mlong', 'Mike Long', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000027', 'smadigan@lee-associates.com', 'smadigan', 'Steve Madigan', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000028', 'gmcardell@lee-associates.com', 'gmcardell', 'Gary McArdell', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000029', 'jmejia@lee-associates.com', 'jmejia', 'Jonathan Mejia', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000030', 'fperkins@lee-associates.com', 'fperkins', 'Frank Perkins', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000031', 'bschneider@lee-associates.com', 'bschneider', 'Brad Schneider', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000032', 'asherratt@lee-associates.com', 'asherratt', 'Alejandro Sherratt', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000033', 'bsmith@lee-associates.com', 'bsmith', 'Brendan Smith', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000034', 'htoland@lee-associates.com', 'htoland', 'Hayden Toland', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000035', 'mtoland@lee-associates.com', 'mtoland', 'Miles Toland', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000036', 'rturner@lee-associates.com', 'rturner', 'Rick Turner', 'admin', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000037', 'timwalker@lee-associates.com', 'timwalker', 'Tim Walker', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000038', 'twest@lee-associates.com', 'twest', 'Tom West', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000039', 'cwinn@lee-associates.com', 'cwinn', 'Charlie Winn', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000040', 'mzacher@lee-associates.com', 'mzacher', 'Maddie Zacher', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000041', 'szacher@lee-associates.com', 'szacher', 'Shannon Zacher', 'broker', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000042', 'ekat@lee-associates.com', 'ekat', 'Errissa Kat', 'admin', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL),
  ('00000000-0000-0000-0000-000000000043', 'kmorris@lee-associates.com', 'kmorris', 'Kelsey Morris', 'admin', NULL, NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, NULL, UTC_TIMESTAMP(3), NULL, UTC_TIMESTAMP(3), NULL)
ON DUPLICATE KEY UPDATE
  `email` = VALUES(`email`),
  `username` = VALUES(`username`),
  `full_name` = VALUES(`full_name`),
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
