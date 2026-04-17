param(
    [string] $AwsProfile = "TaylorBarnes"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    throw "AWS CLI is not installed or not on PATH."
}

Write-Host "Logging into AWS with profile '$AwsProfile'..." -ForegroundColor Yellow
aws sso login --profile $AwsProfile

Write-Host "Verifying identity..." -ForegroundColor Yellow
aws sts get-caller-identity --profile $AwsProfile
