param(
  [Parameter(Mandatory = $true)]
  [string] $CertificateArn,
  [string] $Region = "us-east-2",
  [string] $AwsProfile = "TaylorBarnes",
  [int] $Seconds = 600
)

$ErrorActionPreference = "Stop"

$stopAt = (Get-Date).AddSeconds($Seconds)
while ((Get-Date) -lt $stopAt) {
  $status = & aws --profile $AwsProfile acm describe-certificate --region $Region --certificate-arn $CertificateArn --query "Certificate.Status" --output text
  $vals = & aws --profile $AwsProfile acm describe-certificate --region $Region --certificate-arn $CertificateArn --query "Certificate.DomainValidationOptions[].ValidationStatus" --output text
  Write-Output ("cert={0} validations={1}" -f $status, $vals)
  if ($status -eq "ISSUED") { exit 0 }
  Start-Sleep -Seconds 30
}

exit 2
