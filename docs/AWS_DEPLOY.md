# AWS Deploy

This repo’s production path is AWS-first:

- Runtime: AWS App Runner
- Image registry: Amazon ECR repository `lee-broker-tool`
- Database: Amazon RDS MySQL
- File storage: Amazon S3 bucket `lee-broker-tool-files`
- Source build: AWS CodeBuild using `buildspec.yml`

## Runtime Environment

Required App Runner variables:

```env
NODE_ENV=production
PORT=3000
AWS_REGION=us-east-2
AWS_S3_REGION=us-east-2
AWS_S3_BUCKET=lee-broker-tool-files
DATABASE_SSL_MODE=disabled
LOCAL_AUTH_ENABLED=true
LOCAL_AUTH_EMAIL_DOMAIN=lee-associates.com
VITE_ENABLE_AUTH_REDIRECT=false
```

Required App Runner secrets:

```env
DATABASE_URL=arn:aws:secretsmanager:us-east-2:<account-id>:secret:lee-broker-tool/DATABASE_URL-...
JWT_SECRET=arn:aws:secretsmanager:us-east-2:<account-id>:secret:lee-broker-tool/JWT_SECRET-...
SETTINGS_ENCRYPTION_KEY=arn:aws:secretsmanager:us-east-2:<account-id>:secret:lee-broker-tool/SETTINGS_ENCRYPTION_KEY-...
```

The App Runner instance role needs:

- `secretsmanager:GetSecretValue` for the app secrets
- `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` on `arn:aws:s3:::lee-broker-tool-files/*`

Because this service uses a VPC connector for RDS, the VPC also needs an S3 gateway endpoint attached to the route table used by the connector subnets.

## Build And Deploy

CodeBuild builds the Docker image and pushes `latest` to ECR:

```bash
aws codebuild start-build --project-name lee-broker-tool --region us-east-2
```

Then deploy the latest ECR image through App Runner:

```bash
aws apprunner start-deployment \
  --service-arn arn:aws:apprunner:us-east-2:<account-id>:service/lee-broker-tool/<service-id> \
  --region us-east-2
```

## Production Smoke Checks

```bash
curl -i https://<app-runner-url>/
curl -sS https://<app-runner-url>/api/health
```

Upload smoke tests should create an S3 object under `broker-docs/smoke/`; delete test objects after verification.
