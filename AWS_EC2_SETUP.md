# AWS EC2 Setup

Use this if Docker Desktop is broken locally and you still want to deploy the app to AWS.

## What this does

1. Builds the app locally
2. Packages the built app into a zip artifact
3. Uploads the artifact to S3
4. Creates an EC2 instance
5. Installs Node.js, pnpm, and Caddy on the instance
6. Downloads the artifact and runs the app with systemd
7. Puts HTTPS in front of the app using an auto-resolving `sslip.io` hostname
8. Grants the EC2 security group access to the RDS MySQL security group

## Deploy

```powershell
.\scripts\deploy-ec2.ps1 `
  -AwsProfile TaylorBarnes `
  -Region us-east-2 `
  -DbInstanceIdentifier lee-broker-tool-db
```

## Result

The stack outputs include:

1. `AppUrl`
2. `PublicDnsName`
3. `PublicIp`
4. `InstanceId`

## Notes

1. This is a practical fallback when local Docker is not working.
2. It uses a public EC2 instance for simplicity.
3. `AppUrl` is served over HTTPS using `${public-ip}.sslip.io`.
4. Optional AI and storage features may still need additional env values later.
