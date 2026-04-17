# Database Setup

## Recommendation

For this codebase, AWS RDS for MySQL is the better long-term fit if you plan to keep hosting and storage in AWS.

## Database engine requirement

This app currently expects a MySQL-compatible database.

Compatible:

1. AWS RDS for MySQL
2. Azure Database for MySQL Flexible Server
3. Other MySQL-compatible hosts

Not compatible without rewriting the database layer:

1. Azure SQL Database
2. SQL Server / Microsoft.Sql databases

Reasons:

1. This repo is already wired around AWS deployment primitives like ECR, App Runner, S3, and Cognito placeholders.
2. Keeping the app and database in the same cloud avoids cross-cloud firewall work, latency, and egress surprises.
3. Azure Database for MySQL is still a valid temporary option if you already have it running and want the fastest path to a working environment.

## Practical decision

- Use Azure now if it already exists, is reachable, and you want the shortest path to launch.
- Use AWS RDS if you want the cleaner final architecture and are willing to finish the AWS database setup.

## Environment variables

The app uses these database settings:

```env
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DBNAME
DATABASE_SSL_MODE=require
DATABASE_SSL_REJECT_UNAUTHORIZED=true
```

## Azure Database for MySQL

Typical shape:

```env
DATABASE_URL=mysql://USER:PASSWORD@YOUR_SERVER.mysql.database.azure.com:3306/DBNAME
DATABASE_SSL_MODE=require
DATABASE_SSL_REJECT_UNAUTHORIZED=true
```

Notes:

1. Azure Database for MySQL Flexible Server supports public access with firewall rules or private access with VNet integration.
2. If you used private networking, your app must be able to reach that Azure VNet path.
3. If you used public access, allow only the exact app egress IPs or your current workstation while testing.

## AWS RDS for MySQL

Typical shape:

```env
DATABASE_URL=mysql://USER:PASSWORD@YOUR_DB.xxxxxx.REGION.rds.amazonaws.com:3306/DBNAME
DATABASE_SSL_MODE=require
DATABASE_SSL_REJECT_UNAUTHORIZED=true
```

Notes:

1. If your app uses App Runner and your RDS instance is private, you need App Runner VPC outbound access plus the right subnets and security groups.
2. If your app host changes to ECS, keeping RDS in AWS remains the cleanest option.

## Verify the connection

From the repo root:

```powershell
corepack pnpm db:test
```
