# AWS ECS Setup

Use this path when App Runner is unavailable in your AWS account.

## What this does

1. Builds the app image with Docker
2. Pushes it to ECR
3. Deploys an ECS Fargate service
4. Places a public Application Load Balancer in front of it
5. Grants the ECS service security group access to the RDS MySQL security group

## Deploy

```powershell
.\scripts\deploy-ecs.ps1 `
  -AwsProfile TaylorBarnes `
  -Region us-east-2 `
  -DbInstanceIdentifier lee-broker-tool-db
```

## Result

The stack outputs include:

1. `AppUrl`
2. `LoadBalancerDnsName`
3. `ClusterArn`
4. `ServiceName`

## Notes

1. This assumes your `.env` is already filled with the live RDS connection and app secrets.
2. The current repo still has some optional features that depend on Forge-backed environment variables. If those stay blank, the core app can run but some AI or upload features may fail.
3. This is a practical AWS deployment path for this account because App Runner is not available here.
