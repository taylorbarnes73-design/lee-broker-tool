# AWS RDS Setup

Use this path if you want to move the app to AWS MySQL.

## Recommendation

For this repo, AWS RDS for MySQL is the cleaner long-term fit than Azure because the app is already AWS-oriented.

## Before you start

1. Log into AWS with your configured profile.
2. Decide whether you want a quick public dev database or a tighter private networking setup later.

## Log into AWS

```powershell
.\scripts\aws-login.ps1 -AwsProfile TaylorBarnes
```

## Create a simple RDS MySQL instance

This helper uses your default VPC and default subnets in the chosen region, creates a security group for MySQL, and allows only your current public IP by default.

```powershell
.\scripts\deploy-rds.ps1 `
  -AwsProfile TaylorBarnes `
  -Region us-east-2 `
  -DbPassword "change-this-password"
```

Optional overrides:

```powershell
.\scripts\deploy-rds.ps1 `
  -AwsProfile TaylorBarnes `
  -Region us-east-2 `
  -StackName lee-broker-tool-rds `
  -DbInstanceIdentifier lee-broker-tool-db `
  -DbName lee_broker_tool `
  -DbUsername leeadmin `
  -DbPassword "change-this-password" `
  -AllowedCidr "203.0.113.10/32"
```

## Point the app at the RDS endpoint

After the stack is created, use the output endpoint:

```powershell
.\scripts\setup-rds-db.ps1 `
  -ServerHost "your-rds-endpoint.rds.amazonaws.com" `
  -DatabaseName "lee_broker_tool" `
  -Username "leeadmin" `
  -Password "change-this-password"
```

Then verify and migrate:

```powershell
corepack pnpm db:test
corepack pnpm db:push
corepack pnpm dev
```

## Notes

1. This is a quick dev path, not the final hardened network design.
2. For production, use private subnets and app-to-db networking inside AWS.
3. If you are a brand-new App Runner customer, note that AWS says App Runner stops accepting new customers on April 30, 2026, and recommends ECS Express Mode for new container deployments.
