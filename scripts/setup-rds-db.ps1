param(
    [Parameter(Mandatory = $true)]
    [string] $ServerHost,

    [Parameter(Mandatory = $true)]
    [string] $DatabaseName,

    [Parameter(Mandatory = $true)]
    [string] $Username,

    [Parameter(Mandatory = $true)]
    [string] $Password,

    [string] $EnvPath = ".env",
    [string] $LocalAuthEmailDomain = "lee-associates.com",
    [string] $DatabaseSslMode = "require",
    [string] $DatabaseSslRejectUnauthorized = "true"
)

$ErrorActionPreference = "Stop"

function Set-EnvValue([string] $Path, [string] $Key, [string] $Value) {
    if (-not (Test-Path $Path)) {
        throw "Environment file '$Path' does not exist."
    }

    $escapedKey = [Regex]::Escape($Key)
    $content = Get-Content $Path -Raw

    if ($content -match "(?m)^$escapedKey=") {
        $content = [Regex]::Replace($content, "(?m)^$escapedKey=.*$", "$Key=$Value")
    }
    else {
        if ($content.Length -gt 0 -and -not $content.EndsWith("`r`n") -and -not $content.EndsWith("`n")) {
            $content += [Environment]::NewLine
        }
        $content += "$Key=$Value" + [Environment]::NewLine
    }

    Set-Content -Path $Path -Value $content -NoNewline
}

if (-not (Test-Path $EnvPath)) {
    Copy-Item ".env.example" $EnvPath
}

$encodedUser = [System.Uri]::EscapeDataString($Username)
$encodedPassword = [System.Uri]::EscapeDataString($Password)
$databaseUrl = "mysql://${encodedUser}:${encodedPassword}@${ServerHost}:3306/${DatabaseName}"

Set-EnvValue -Path $EnvPath -Key "DATABASE_URL" -Value $databaseUrl
Set-EnvValue -Path $EnvPath -Key "DATABASE_SSL_MODE" -Value $DatabaseSslMode
Set-EnvValue -Path $EnvPath -Key "DATABASE_SSL_REJECT_UNAUTHORIZED" -Value $DatabaseSslRejectUnauthorized
Set-EnvValue -Path $EnvPath -Key "LOCAL_AUTH_ENABLED" -Value "true"
Set-EnvValue -Path $EnvPath -Key "LOCAL_AUTH_EMAIL_DOMAIN" -Value $LocalAuthEmailDomain

Write-Host "Updated $EnvPath for AWS RDS MySQL." -ForegroundColor Green
Write-Host "Host: $ServerHost" -ForegroundColor Green
Write-Host "Database: $DatabaseName" -ForegroundColor Green
Write-Host "User: $Username" -ForegroundColor Green
Write-Host "SSL Mode: $DatabaseSslMode" -ForegroundColor Green
Write-Host ""
Write-Host "Next step:" -ForegroundColor Yellow
Write-Host "  corepack pnpm db:test" -ForegroundColor Yellow
