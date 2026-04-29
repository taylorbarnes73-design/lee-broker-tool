# Database Setup

This repo uses **AWS RDS for MySQL** for persistence. Hosting, storage, and
database all run in AWS.

## Database engine requirement

This app expects a MySQL-compatible database.

Compatible:

1. AWS RDS for MySQL (the supported target)
2. Other MySQL 8.x-compatible hosts

Not compatible without rewriting the database layer:

1. SQL Server / Microsoft.Sql databases

## Environment variables

```env
DATABASE_URL=mysql://USER:PASSWORD@YOUR_DB.xxxxxx.REGION.rds.amazonaws.com:3306/DBNAME
DATABASE_SSL_MODE=require
DATABASE_SSL_REJECT_UNAUTHORIZED=true
```

## AWS RDS for MySQL

Notes:

1. If the app runs on App Runner and RDS is private, enable App Runner VPC
   outbound access with the right subnets and security groups.
2. If the app runs on ECS or EC2, keep RDS in the same VPC so the app can
   reach it via a private security-group rule.
3. See `AWS_RDS_SETUP.md` for a scripted provisioning path.

## Verify the connection

From the repo root:

```powershell
corepack pnpm db:test
```
