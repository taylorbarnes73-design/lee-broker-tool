param(
    [string] $Region = "us-east-2",
    [string] $StackName = "lee-broker-tool-rds",
    [string] $DbInstanceIdentifier = "lee-broker-tool-db",
    [string] $DbName = "lee_broker_tool",
    [string] $DbUsername = "leeadmin",
    [Parameter(Mandatory = $true)]
    [string] $DbPassword,
    [string] $DbInstanceClass = "db.t3.micro",
    [int] $AllocatedStorage = 20,
    [string] $AllowedCidr = "",
    [string] $AwsProfile = "TaylorBarnes"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    throw "AWS CLI is not installed or not on PATH."
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
}

$script:AwsProfile = $AwsProfile.Trim()

if (-not $AllowedCidr) {
    try {
        $ip = Invoke-RestMethod -Uri "https://api.ipify.org"
        $AllowedCidr = "$ip/32"
    }
    catch {
        throw "Unable to detect your public IP automatically. Re-run with -AllowedCidr x.x.x.x/32."
    }
}

Write-Host "Using allowed CIDR: $AllowedCidr" -ForegroundColor Green

Invoke-Aws sts get-caller-identity --region $Region | Out-Null

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

if (-not $subnetIdsRaw) {
    throw "No default subnets found in VPC $vpcId."
}

$subnetIds = ($subnetIdsRaw -split "\s+") | Where-Object { $_ }
if ($subnetIds.Count -lt 2) {
    throw "RDS needs subnets in at least two availability zones. Found: $($subnetIds.Count)"
}

$subnetParam = [string]::Join(",", $subnetIds)

Write-Host "Using default VPC: $vpcId" -ForegroundColor Green
Write-Host "Using subnets: $subnetParam" -ForegroundColor Green

Write-Host "Deploying RDS CloudFormation stack '$StackName'..." -ForegroundColor Yellow
Invoke-Aws cloudformation deploy `
    --region $Region `
    --stack-name $StackName `
    --template-file aws-rds.template.yaml `
    --capabilities CAPABILITY_IAM `
    --parameter-overrides `
        "VpcId=$vpcId" `
        "SubnetIds=$subnetParam" `
        "DbInstanceIdentifier=$DbInstanceIdentifier" `
        "DbName=$DbName" `
        "DbUsername=$DbUsername" `
        "DbPassword=$DbPassword" `
        "DbInstanceClass=$DbInstanceClass" `
        "AllocatedStorage=$AllocatedStorage" `
        "AllowedCidr=$AllowedCidr"

Write-Host "RDS stack outputs:" -ForegroundColor Yellow
Invoke-Aws cloudformation describe-stacks `
    --region $Region `
    --stack-name $StackName `
    --query "Stacks[0].Outputs" `
    --output table
