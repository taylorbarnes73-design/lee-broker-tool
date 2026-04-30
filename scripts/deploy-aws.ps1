param(
    [string] $Region = "us-east-2",
    [string] $RepositoryName = "lee-broker-tool",
    [string] $StackName = "lee-broker-tool",
    [string] $ImageTag = "latest",
    [string] $AppRunnerServiceName = "lee-broker-tool",
    [string] $AwsProfile = ""
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
    # AWS CLI output can arrive as a string array; normalize to a single JSON string.
    $identityJson = (Invoke-Aws sts get-caller-identity --region $region --output json) | Out-String
    if (-not $identityJson) {
        throw "AWS CLI returned no identity. Run 'aws login' or configure your credentials in AWS Toolkit first."
    }

    return (ConvertFrom-Json $identityJson).Account
}

Require-Command "aws" "Install AWS CLI v2 and make sure it is on PATH."
Require-Command "docker" "Install Docker Desktop and make sure the daemon is running."

$script:AwsProfile = $AwsProfile.Trim()

if (-not (Test-Path ".env")) {
    throw "Missing .env in repo root. Copy .env.example to .env and fill in the required values first."
}

$accountId = Get-AwsAccountId -region $Region
$ecrUri = "$accountId.dkr.ecr.$Region.amazonaws.com/$RepositoryName"
$imageUri = "${ecrUri}:$ImageTag"

Write-Host "Using AWS account: $accountId" -ForegroundColor Green
Write-Host "Using image URI: $imageUri" -ForegroundColor Green

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

Write-Host "Logging Docker into ECR" -ForegroundColor Yellow
Invoke-Aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $ecrUri

Write-Host "Building Docker image" -ForegroundColor Yellow
docker build -t "${RepositoryName}:${ImageTag}" .

Write-Host "Tagging Docker image for ECR" -ForegroundColor Yellow
docker tag "${RepositoryName}:${ImageTag}" $imageUri

Write-Host "Pushing image to ECR" -ForegroundColor Yellow
docker push $imageUri

$envVars = Get-Content ".env" | Where-Object {
    $_ -and -not $_.TrimStart().StartsWith("#") -and $_.Contains("=")
}

$paramMap = @{}
foreach ($line in $envVars) {
    $name, $value = $line -split "=", 2
    $paramMap[$name.Trim()] = $value
}

$parameterOverrides = @(
    "AppRunnerServiceName=$AppRunnerServiceName",
    "ContainerImageUri=$imageUri",
    "DatabaseUrl=$($paramMap["DATABASE_URL"])",
    "DatabaseSslMode=$($paramMap["DATABASE_SSL_MODE"])",
    "JwtSecret=$($paramMap["JWT_SECRET"])",
    "ConnectorApiKey=$($paramMap["CONNECTOR_API_KEY"])",
    "OwnerOpenId=$($paramMap["OWNER_OPEN_ID"])",
    "AdminEmail=$($paramMap["ADMIN_EMAIL"])",
    "LocalAuthEnabled=$($paramMap["LOCAL_AUTH_ENABLED"])",
    "LocalAuthEmailDomain=$($paramMap["LOCAL_AUTH_EMAIL_DOMAIN"])",
    "LocalAdminEmails=$($paramMap["LOCAL_ADMIN_EMAILS"])",
    "OAuthServerUrl=$($paramMap["OAUTH_SERVER_URL"])",
    "ViteOAuthPortalUrl=$($paramMap["VITE_OAUTH_PORTAL_URL"])",
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

Write-Host "Deploying CloudFormation stack '$StackName'" -ForegroundColor Yellow
Invoke-Aws cloudformation deploy `
    --region $Region `
    --stack-name $StackName `
    --template-file template.yaml `
    --capabilities CAPABILITY_IAM `
    --parameter-overrides @parameterOverrides

Write-Host "Fetching stack outputs" -ForegroundColor Yellow
Invoke-Aws cloudformation describe-stacks `
    --region $Region `
    --stack-name $StackName `
    --query "Stacks[0].Outputs" `
    --output table
