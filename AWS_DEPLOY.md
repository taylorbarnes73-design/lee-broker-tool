# AWS Deploy

This repo is set up to deploy to AWS App Runner from a Docker image in ECR.

## Current recommendation

This repo uses AWS RDS for MySQL for persistence.

One important date: AWS now says App Runner will stop accepting new customers on April 30, 2026, and recommends ECS Express Mode for new container deployments instead. If you already have App Runner access, this scaffold still works. If you do not, plan on ECS Express Mode or the EC2 path documented in `AWS_EC2_SETUP.md`.

See [DATABASE_SETUP.md](./DATABASE_SETUP.md) for the database-specific setup notes.
See [AWS_RDS_SETUP.md](./AWS_RDS_SETUP.md) for a quick AWS RDS MySQL path.

## Prerequisites

1. Install Docker Desktop and make sure Docker is running.
2. Sign in to AWS so the CLI can resolve credentials.
3. Copy `.env.example` to `.env` and fill in the required values, including `CONNECTOR_API_KEY`.
4. Set `DATABASE_URL`, `DATABASE_SSL_MODE`, and the local auth values in `.env`.

## Power Automate connector auth

The custom connector now expects a shared API key in the `x-api-key` header for every `/api/v1` request.

1. Generate a long random secret and set it as `CONNECTOR_API_KEY` in `.env`.
2. Deploy the app so the backend has the new environment value.
3. In Power Automate, import or update `lee-broker-tool-connector.json`.
4. On the connector Security tab, use API key auth with header name `x-api-key` if Power Automate asks you to confirm it.
5. Create the connection using the same shared key.

This avoids Microsoft Entra user-consent flow for the connector itself.

## Test your database first

Before deploying, verify the database connection locally:

```powershell
corepack pnpm db:test
```

## Deploy

From the repo root:

```powershell
.\scripts\deploy-aws.ps1
```

Optional parameters:

```powershell
.\scripts\deploy-aws.ps1 -Region us-east-2 -RepositoryName lee-broker-tool -StackName lee-broker-tool -ImageTag latest
```

## What the script does

1. Confirms `aws` and `docker` are available.
2. Resolves your active AWS account ID from the current credentials.
3. Creates the ECR repository if it does not exist.
4. Builds the Docker image and pushes it to ECR.
5. Deploys `template.yaml` with values loaded from `.env`.
6. Prints the CloudFormation stack outputs, including the App Runner URL.
