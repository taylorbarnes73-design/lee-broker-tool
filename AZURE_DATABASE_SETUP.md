# Azure Database Setup

Use this if you want to point the app at your existing Azure Database for MySQL Flexible Server now.

## Important: not Azure SQL Database

This app currently uses the MySQL driver stack (`mysql2` + Drizzle MySQL).

That means these Azure resources are compatible:

1. Azure Database for MySQL Flexible Server
2. Other MySQL-compatible databases

These are not compatible without a larger code migration:

1. Azure SQL Database
2. Microsoft.Sql / SQL Server exports

If you exported a deployment zip from Azure and it references `Microsoft.Sql/servers/databases`, that is Azure SQL Database, not Azure MySQL.

## What Azure needs

1. Use the server FQDN, usually `<servername>.mysql.database.azure.com`.
2. Use the exact database username that Azure expects for your server.
3. Keep TLS on.
4. Make sure the server allows connections from your current machine or app host.

## Quick setup

From the repo root:

```powershell
.\scripts\setup-azure-db.ps1 `
  -ServerHost "your-server.mysql.database.azure.com" `
  -DatabaseName "lee_broker_tool" `
  -Username "youruser" `
  -Password "your-password"
```

If your Azure server expects the qualified username format, pass that exact value instead, for example:

```powershell
.\scripts\setup-azure-db.ps1 `
  -ServerHost "your-server.mysql.database.azure.com" `
  -DatabaseName "lee_broker_tool" `
  -Username "youruser@your-server" `
  -Password "your-password"
```

Then run:

```powershell
corepack pnpm db:test
```

If that passes, run:

```powershell
corepack pnpm db:push
corepack pnpm dev
```

## If connection fails

Common causes:

1. Your current IP is not allowed in Azure firewall rules.
2. The Azure server is private-access only and this machine is not on the reachable network path.
3. The username needs the qualified `username@servername` format.
4. The database name is wrong.
