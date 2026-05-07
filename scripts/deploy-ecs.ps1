param(
    [string] $Region = "us-east-2",
    [string] $RepositoryName = "lee-broker-tool",
    [string] $StackName = "lee-broker-tool-ecs",
    [string] $ImageTag = "latest",
    [string] $ServiceName = "lee-broker-tool",
    [string] $DbInstanceIdentifier = "lee-broker-tool-db",
    [string] $CertificateArn = "",
    [string] $AwsProfile = "TaylorBarnes",
    [switch] $SkipDocker,
    [switch] $UseRdsSecret,
    [string] $RdsPasswordSecretId = "lee-broker-tool/RDS_MASTER_PASSWORD",
    # Optional legacy switch; DATABASE_URL is always synced to Secrets Manager for ECS deploys.
    [switch] $UseDatabaseUrlSecret,
    [string] $DatabaseUrlSecretName = "lee-broker-tool/DATABASE_URL"
)

$ErrorActionPreference = "Stop"

function Require-Command([string] $command, [string] $installHint) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "Missing required command '$command'. $installHint"
    }
}

function Invoke-Aws {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]] $Args
    )

    if ($script:AwsProfile) {
        & aws --profile $script:AwsProfile @Args
    }
    else {
        & aws @Args
    }

    if ($LASTEXITCODE -ne 0) {
        throw "AWS command failed (exit code $LASTEXITCODE)."
    }
}

function Get-AwsAccountId([string] $region) {
    $accountId = Invoke-Aws sts get-caller-identity --region $region --query "Account" --output text
    if (-not $accountId -or $accountId -eq "None") {
        throw "AWS CLI returned no identity."
    }

    return $accountId
}

function Get-CfnStackStatus([string] $Region, [string] $StackName) {
    if ($script:AwsProfile) {
        $output = & aws --profile $script:AwsProfile cloudformation describe-stacks --region $Region --stack-name $StackName --query "Stacks[0].StackStatus" --output text 2>$null
    }
    else {
        $output = & aws cloudformation describe-stacks --region $Region --stack-name $StackName --query "Stacks[0].StackStatus" --output text 2>$null
    }

    if ($LASTEXITCODE -ne 0) {
        return $null
    }

    return ($output | Out-String).Trim()
}

function Wait-CfnStackIdleBeforeDeploy([string] $Region, [string] $StackName) {
    $status = Get-CfnStackStatus -Region $Region -StackName $StackName
    if (-not $status) {
        return
    }

    if ($status -eq "UPDATE_IN_PROGRESS" -or $status -eq "UPDATE_COMPLETE_CLEANUP_IN_PROGRESS") {
        Write-Host "CloudFormation stack '$StackName' is busy ($status); waiting for UPDATE_COMPLETE..." -ForegroundColor Yellow
        Invoke-Aws cloudformation wait stack-update-complete --region $Region --stack-name $StackName
        Write-Host "CloudFormation stack update finished." -ForegroundColor Green
        return
    }

    if ($status -eq "CREATE_IN_PROGRESS") {
        Write-Host "CloudFormation stack '$StackName' is being created; waiting for CREATE_COMPLETE..." -ForegroundColor Yellow
        Invoke-Aws cloudformation wait stack-create-complete --region $Region --stack-name $StackName
        Write-Host "CloudFormation stack create finished." -ForegroundColor Green
        return
    }

    if ($status -eq "UPDATE_ROLLBACK_IN_PROGRESS" -or $status -eq "UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS") {
        Write-Host "CloudFormation stack '$StackName' update rollback in progress ($status); waiting..." -ForegroundColor Yellow
        Invoke-Aws cloudformation wait stack-update-rollback-complete --region $Region --stack-name $StackName
        Write-Host "CloudFormation update rollback finished." -ForegroundColor Green
        return
    }

    if ($status -eq "ROLLBACK_IN_PROGRESS") {
        Write-Host "CloudFormation stack '$StackName' create rollback in progress; waiting..." -ForegroundColor Yellow
        Invoke-Aws cloudformation wait stack-rollback-complete --region $Region --stack-name $StackName
        Write-Host "CloudFormation create rollback finished." -ForegroundColor Green
        return
    }

    if ($status -eq "DELETE_IN_PROGRESS") {
        throw "CloudFormation stack '$StackName' is DELETE_IN_PROGRESS. Wait until deletion completes or choose another stack name."
    }
}

Require-Command "aws" "Install AWS CLI v2 and make sure it is on PATH."
if (-not $SkipDocker) {
    Require-Command "docker" "Install Docker Desktop and make sure the daemon is running."
}

$script:AwsProfile = $AwsProfile.Trim()

if (-not (Test-Path ".env")) {
    throw "Missing .env in repo root. Copy .env.example to .env and fill in the required values first."
}

$accountId = Get-AwsAccountId -region $Region
$ecrUri = "$accountId.dkr.ecr.$Region.amazonaws.com/$RepositoryName"
$imageUri = "${ecrUri}:$ImageTag"

Write-Host "Using AWS account: $accountId" -ForegroundColor Green
Write-Host "Using image URI: $imageUri" -ForegroundColor Green

$vpcId = Invoke-Aws ec2 describe-vpcs `
    --region $Region `
    --filters "Name=is-default,Values=true" `
    --query "Vpcs[0].VpcId" `
    --output text

if (-not $vpcId -or $vpcId -eq "None") {
    throw "No default VPC found in region $Region."
}

$subnetIdsRaw = Invoke-Aws ec2 describe-subnets `
    --region $Region `
    --filters "Name=vpc-id,Values=$vpcId" "Name=default-for-az,Values=true" `
    --query "Subnets[].SubnetId" `
    --output text

$subnetIds = ($subnetIdsRaw -split "\s+") | Where-Object { $_ }
if ($subnetIds.Count -lt 2) {
    throw "Need at least two subnets in the default VPC."
}

$subnetParam = [string]::Join(",", $subnetIds)

$dbSecurityGroupId = Invoke-Aws rds describe-db-instances `
    --region $Region `
    --db-instance-identifier $DbInstanceIdentifier `
    --query "DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId" `
    --output text

if (-not $dbSecurityGroupId -or $dbSecurityGroupId -eq "None") {
    throw "Could not resolve the RDS security group for DB instance '$DbInstanceIdentifier'."
}

$repoExists = $true
try {
    Invoke-Aws ecr describe-repositories --repository-names $RepositoryName --region $Region | Out-Null
}
catch {
    $repoExists = $false
}

if (-not $repoExists) {
    Write-Host "Creating ECR repository '$RepositoryName' in $Region" -ForegroundColor Yellow
    Invoke-Aws ecr create-repository --repository-name $RepositoryName --region $Region | Out-Null
}

if ($SkipDocker) {
    Write-Host "Skipping Docker build/push (using existing image tag '$ImageTag')." -ForegroundColor Yellow
}
else {
    Write-Host "Logging Docker into ECR" -ForegroundColor Yellow
    Invoke-Aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $ecrUri

    Write-Host "Building Docker image" -ForegroundColor Yellow
    docker build -t "${RepositoryName}:${ImageTag}" .

    Write-Host "Tagging Docker image for ECR" -ForegroundColor Yellow
    docker tag "${RepositoryName}:${ImageTag}" $imageUri

    Write-Host "Pushing image to ECR" -ForegroundColor Yellow
    docker push $imageUri
}

$envVars = Get-Content ".env" | Where-Object {
    $_ -and -not $_.TrimStart().StartsWith("#") -and $_.Contains("=")
}

$paramMap = @{}
foreach ($line in $envVars) {
    $name, $value = $line -split "=", 2
    $paramMap[$name.Trim()] = $value
}

$rdsEndpoint = $null
try {
    $rdsEndpoint = Invoke-Aws rds describe-db-instances `
        --region $Region `
        --db-instance-identifier $DbInstanceIdentifier `
        --query "DBInstances[0].Endpoint.Address" `
        --output text
}
catch {
    $rdsEndpoint = $null
}

$databaseUrlFromEnv = $paramMap["DATABASE_URL"]
$shouldOverrideDatabaseUrl = $false
if ($UseRdsSecret) {
    $shouldOverrideDatabaseUrl = $true
}
elseif (-not $databaseUrlFromEnv) {
    $shouldOverrideDatabaseUrl = $true
}
elseif ($databaseUrlFromEnv -match "127\.0\.0\.1|localhost") {
    $shouldOverrideDatabaseUrl = $true
}

if ($shouldOverrideDatabaseUrl) {
    if (-not $rdsEndpoint -or $rdsEndpoint -eq "None") {
        throw "Cannot override DATABASE_URL because RDS endpoint for '$DbInstanceIdentifier' could not be resolved."
    }
    Write-Host "Resolving RDS password from Secrets Manager for ECS deploy" -ForegroundColor Yellow
    $dbpw = Invoke-Aws secretsmanager get-secret-value `
        --region $Region `
        --secret-id $RdsPasswordSecretId `
        --query SecretString `
        --output text
    if (-not $dbpw) {
        throw "Secrets Manager returned an empty secret for '$RdsPasswordSecretId'."
    }

    $encodedUser = [System.Uri]::EscapeDataString("leeadmin")
    $encodedPassword = [System.Uri]::EscapeDataString($dbpw)
    $databaseUrlFromEnv = "mysql://${encodedUser}:${encodedPassword}@${rdsEndpoint}:3306/lee_broker_tool"
}

# The ECS template only injects DATABASE_URL from Secrets Manager (no plain env).
# Whenever we have a resolved URL (from .env, from -UseRdsSecret, or -UseDatabaseUrlSecret),
# upsert the well-known secret and pass its ARN to CloudFormation.
$databaseUrlSecretArn = ""
if (-not $databaseUrlFromEnv -or $databaseUrlFromEnv.Trim() -eq "") {
    throw "DATABASE_URL is required for ECS deploy (set it in .env or use -UseRdsSecret to build it from RDS)."
}

Write-Host "Ensuring Secrets Manager secret '$DatabaseUrlSecretName' matches deploy DATABASE_URL" -ForegroundColor Yellow
try {
    $databaseUrlSecretArn = Invoke-Aws secretsmanager describe-secret `
        --region $Region `
        --secret-id $DatabaseUrlSecretName `
        --query ARN `
        --output text
}
catch {
    $databaseUrlSecretArn = $null
}

if (-not $databaseUrlSecretArn -or $databaseUrlSecretArn -eq "None") {
    $databaseUrlSecretArn = Invoke-Aws secretsmanager create-secret `
        --region $Region `
        --name $DatabaseUrlSecretName `
        --secret-string $databaseUrlFromEnv `
        --query ARN `
        --output text
}
else {
    Invoke-Aws secretsmanager put-secret-value `
        --region $Region `
        --secret-id $DatabaseUrlSecretName `
        --secret-string $databaseUrlFromEnv | Out-Null
}

$parameterOverrides = @(
    "ServiceName=$ServiceName",
    "VpcId=$vpcId",
    "PublicSubnetIds=$subnetParam",
    "ContainerImageUri=$imageUri",
    "CertificateArn=$CertificateArn",
    "DatabaseSecurityGroupId=$dbSecurityGroupId",
    "DatabaseUrl=",
    "DatabaseUrlSecretArn=$databaseUrlSecretArn",
    "DatabaseSslMode=$($paramMap["DATABASE_SSL_MODE"])",
    "DatabaseSslRejectUnauthorized=$($paramMap["DATABASE_SSL_REJECT_UNAUTHORIZED"])",
    "JwtSecret=$($paramMap["JWT_SECRET"])",
    "ConnectorApiKey=$($paramMap["CONNECTOR_API_KEY"])",
    "OwnerOpenId=$($paramMap["OWNER_OPEN_ID"])",
    "AdminEmail=$($paramMap["ADMIN_EMAIL"])",
    "LocalAuthEnabled=$($paramMap["LOCAL_AUTH_ENABLED"])",
    "LocalAuthEmailDomain=$($paramMap["LOCAL_AUTH_EMAIL_DOMAIN"])",
    "LocalAdminEmails=$($paramMap["LOCAL_ADMIN_EMAILS"])",
    "OAuthServerUrl=$($paramMap["OAUTH_SERVER_URL"])",
    "ViteOAuthPortalUrl=$($paramMap["VITE_OAUTH_PORTAL_URL"])",
    "ViteEnableAuthRedirect=$($paramMap["VITE_ENABLE_AUTH_REDIRECT"])",
    "ViteAppId=$($paramMap["VITE_APP_ID"])",
    "BuiltInForgeApiUrl=$($paramMap["BUILT_IN_FORGE_API_URL"])",
    "BuiltInForgeApiKey=$($paramMap["BUILT_IN_FORGE_API_KEY"])",
    "AwsRegion=$($paramMap["AWS_REGION"])",
    "AwsCognitoUserPoolId=$($paramMap["AWS_COGNITO_USER_POOL_ID"])",
    "AwsCognitoClientId=$($paramMap["AWS_COGNITO_CLIENT_ID"])",
    "AwsCognitoDomain=$($paramMap["AWS_COGNITO_DOMAIN"])",
    "AwsS3Bucket=$($paramMap["AWS_S3_BUCKET"])",
    "AwsS3Region=$($paramMap["AWS_S3_REGION"])"
)

Write-Host "Using VPC: $vpcId" -ForegroundColor Green
Write-Host "Using subnets: $subnetParam" -ForegroundColor Green
Write-Host "Using DB security group: $dbSecurityGroupId" -ForegroundColor Green

Wait-CfnStackIdleBeforeDeploy -Region $Region -StackName $StackName

Write-Host "Deploying ECS stack '$StackName'" -ForegroundColor Yellow
$deployArgs = [System.Collections.Generic.List[string]]::new()
$deployArgs.AddRange([string[]]@(
    "cloudformation",
    "deploy",
    "--region", $Region,
    "--stack-name", $StackName,
    "--template-file", "ecs-app.template.yaml",
    "--capabilities", "CAPABILITY_IAM",
    "--parameter-overrides"
))
$deployArgs.AddRange([string[]]$parameterOverrides)
Invoke-Aws @deployArgs

Write-Host "Fetching stack outputs" -ForegroundColor Yellow
Invoke-Aws cloudformation describe-stacks `
    --region $Region `
    --stack-name $StackName `
    --query "Stacks[0].Outputs" `
    --output table
