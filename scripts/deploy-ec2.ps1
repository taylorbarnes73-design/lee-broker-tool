param(
    [string] $Region = "us-east-2",
    [string] $StackName = "lee-broker-tool-ec2",
    [string] $ServiceName = "lee-broker-tool",
    [string] $ArtifactBucket = "",
    [string] $ArtifactKey = "deploy/lee-broker-tool.zip",
    [string] $InstanceType = "t3.small",
    [string] $DbInstanceIdentifier = "lee-broker-tool-db",
    [string] $AwsProfile = "TaylorBarnes"
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
        throw "AWS command failed: aws $($Args -join ' ')"
    }
}

function Get-AwsAccountId([string] $region) {
    $accountId = Invoke-Aws sts get-caller-identity --region $region --query "Account" --output text
    if (-not $accountId -or $accountId -eq "None") {
        throw "AWS CLI returned no identity."
    }

    return $accountId
}

Require-Command "aws" "Install AWS CLI v2 and make sure it is on PATH."
Require-Command "corepack" "Node.js with Corepack is required."

$script:AwsProfile = $AwsProfile.Trim()

if (-not (Test-Path ".env")) {
    throw "Missing .env in repo root."
}

$accountId = Get-AwsAccountId -region $Region
if (-not $ArtifactBucket) {
    $ArtifactBucket = "lee-broker-tool-artifacts-$accountId-$Region"
}

$vpcId = Invoke-Aws ec2 describe-vpcs `
    --region $Region `
    --filters "Name=is-default,Values=true" `
    --query "Vpcs[0].VpcId" `
    --output text

$publicSubnetId = Invoke-Aws ec2 describe-subnets `
    --region $Region `
    --filters "Name=vpc-id,Values=$vpcId" "Name=default-for-az,Values=true" `
    --query "Subnets[0].SubnetId" `
    --output text

$dbSecurityGroupId = Invoke-Aws rds describe-db-instances `
    --region $Region `
    --db-instance-identifier $DbInstanceIdentifier `
    --query "DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId" `
    --output text

Write-Host "Building production bundle" -ForegroundColor Yellow
corepack pnpm build
if ($LASTEXITCODE -ne 0) {
    throw "Build failed."
}

$deployDir = Join-Path $PWD ".deploy"
$artifactRoot = Join-Path $deployDir "artifact"
$artifactZip = Join-Path $deployDir "lee-broker-tool.zip"

if (Test-Path $deployDir) {
    Remove-Item -Recurse -Force $deployDir
}

New-Item -ItemType Directory -Path $artifactRoot | Out-Null
Copy-Item dist -Destination $artifactRoot -Recurse
Copy-Item package.json -Destination $artifactRoot
Copy-Item pnpm-lock.yaml -Destination $artifactRoot
Copy-Item patches -Destination $artifactRoot -Recurse

Compress-Archive -Path (Join-Path $artifactRoot "*") -DestinationPath $artifactZip

Write-Host "Ensuring artifact bucket exists: $ArtifactBucket" -ForegroundColor Yellow
$bucketExists = $true
try {
    Invoke-Aws s3api head-bucket --bucket $ArtifactBucket
}
catch {
    $bucketExists = $false
}

if (-not $bucketExists) {
    if ($Region -eq "us-east-1") {
        Invoke-Aws s3api create-bucket --bucket $ArtifactBucket
    }
    else {
        Invoke-Aws s3api create-bucket --bucket $ArtifactBucket --create-bucket-configuration "LocationConstraint=$Region" --region $Region
    }
}

Write-Host "Uploading artifact to s3://$ArtifactBucket/$ArtifactKey" -ForegroundColor Yellow
Invoke-Aws s3 cp $artifactZip "s3://$ArtifactBucket/$ArtifactKey" --region $Region

$envVars = Get-Content ".env" | Where-Object {
    $_ -and -not $_.TrimStart().StartsWith("#") -and $_.Contains("=")
}

$paramMap = @{}
foreach ($line in $envVars) {
    $name, $value = $line -split "=", 2
    $paramMap[$name.Trim()] = $value
}

$parameterOverrides = [System.Collections.Generic.List[string]]::new()

function Add-ParameterOverride([string] $name, [string] $value, [bool] $allowEmpty = $false) {
    if ($allowEmpty -or -not [string]::IsNullOrWhiteSpace($value)) {
        $parameterOverrides.Add("${name}=${value}")
    }
}

Add-ParameterOverride "ServiceName" $ServiceName $true
Add-ParameterOverride "VpcId" $vpcId $true
Add-ParameterOverride "PublicSubnetId" $publicSubnetId $true
Add-ParameterOverride "InstanceType" $InstanceType $true
Add-ParameterOverride "ArtifactBucket" $ArtifactBucket $true
Add-ParameterOverride "ArtifactKey" $ArtifactKey $true
Add-ParameterOverride "DatabaseSecurityGroupId" $dbSecurityGroupId $true
Add-ParameterOverride "DatabaseUrl" $paramMap["DATABASE_URL"]
Add-ParameterOverride "DatabaseSslMode" $paramMap["DATABASE_SSL_MODE"]
Add-ParameterOverride "DatabaseSslRejectUnauthorized" $paramMap["DATABASE_SSL_REJECT_UNAUTHORIZED"]
Add-ParameterOverride "JwtSecret" $paramMap["JWT_SECRET"]
Add-ParameterOverride "ConnectorApiKey" $paramMap["CONNECTOR_API_KEY"]
Add-ParameterOverride "OwnerOpenId" $paramMap["OWNER_OPEN_ID"]
Add-ParameterOverride "AdminEmail" $paramMap["ADMIN_EMAIL"]
Add-ParameterOverride "SmtpHost" $paramMap["SMTP_HOST"]
Add-ParameterOverride "SmtpPort" $paramMap["SMTP_PORT"]
Add-ParameterOverride "SmtpSecure" $paramMap["SMTP_SECURE"]
Add-ParameterOverride "SmtpUser" $paramMap["SMTP_USER"]
Add-ParameterOverride "SmtpPass" $paramMap["SMTP_PASS"]
Add-ParameterOverride "SmtpFrom" $paramMap["SMTP_FROM"]
Add-ParameterOverride "LocalAuthEnabled" $paramMap["LOCAL_AUTH_ENABLED"]
Add-ParameterOverride "LocalAuthEmailDomain" $paramMap["LOCAL_AUTH_EMAIL_DOMAIN"]
Add-ParameterOverride "LocalAdminEmails" $paramMap["LOCAL_ADMIN_EMAILS"]
Add-ParameterOverride "OAuthServerUrl" $paramMap["OAUTH_SERVER_URL"]
Add-ParameterOverride "ViteOAuthPortalUrl" $paramMap["VITE_OAUTH_PORTAL_URL"]
Add-ParameterOverride "ViteEnableAuthRedirect" $paramMap["VITE_ENABLE_AUTH_REDIRECT"]
Add-ParameterOverride "ViteAppId" $paramMap["VITE_APP_ID"]
Add-ParameterOverride "BuiltInForgeApiUrl" $paramMap["BUILT_IN_FORGE_API_URL"]
Add-ParameterOverride "BuiltInForgeApiKey" $paramMap["BUILT_IN_FORGE_API_KEY"]
Add-ParameterOverride "AwsRegion" $paramMap["AWS_REGION"]
Add-ParameterOverride "AwsCognitoUserPoolId" $paramMap["AWS_COGNITO_USER_POOL_ID"]
Add-ParameterOverride "AwsCognitoClientId" $paramMap["AWS_COGNITO_CLIENT_ID"]
Add-ParameterOverride "AwsCognitoDomain" $paramMap["AWS_COGNITO_DOMAIN"]
Add-ParameterOverride "AwsS3Bucket" $paramMap["AWS_S3_BUCKET"]
Add-ParameterOverride "AwsS3Region" $paramMap["AWS_S3_REGION"]

$deployArgs = [System.Collections.Generic.List[string]]::new()
$deployArgs.AddRange([string[]]@(
    "cloudformation",
    "deploy",
    "--region", $Region,
    "--stack-name", $StackName,
    "--template-file", "ec2-app.template.yaml",
    "--capabilities", "CAPABILITY_IAM",
    "--parameter-overrides"
))
$deployArgs.AddRange([string[]]$parameterOverrides)

Write-Host "Deploying EC2 stack '$StackName'" -ForegroundColor Yellow
Invoke-Aws @deployArgs

Write-Host "Fetching stack outputs" -ForegroundColor Yellow
Invoke-Aws cloudformation describe-stacks `
    --region $Region `
    --stack-name $StackName `
    --query "Stacks[0].Outputs" `
    --output table

$outputs = Invoke-Aws cloudformation describe-stacks --region $Region --stack-name $StackName --query "Stacks[0].Outputs" --output json | ConvertFrom-Json
$instanceId = ($outputs | Where-Object { $_.OutputKey -eq "InstanceId" }).OutputValue

if ($instanceId) {
    Write-Host "Updating code on EC2 instance $instanceId via SSM..." -ForegroundColor Yellow
    $ssmParams = @{
        commands = @(
            "cd /opt/$ServiceName",
            "/opt/awscli-venv/bin/aws s3 cp s3://$ArtifactBucket/$ArtifactKey /tmp/${ServiceName}.zip",
            "unzip -o /tmp/${ServiceName}.zip -d /opt/$ServiceName",
            "pnpm install --prod --frozen-lockfile",
            "systemctl restart ${ServiceName}.service"
        )
    }
    $ssmFinal = @{ Parameters = $ssmParams }
    $ssmJsonFinal = $ssmFinal | ConvertTo-Json -Depth 5 -Compress
    Set-Content -Path ".deploy\ssm-update.json" -Value $ssmJsonFinal -Encoding ascii
    
    Invoke-Aws ssm send-command `
        --instance-ids $instanceId `
        --document-name "AWS-RunShellScript" `
        --cli-input-json "file://.deploy/ssm-update.json" `
        --region $Region `
        --output text
        
    Write-Host "EC2 update command sent successfully." -ForegroundColor Green
}
