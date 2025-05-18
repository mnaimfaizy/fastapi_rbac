# PowerShell script to generate certificates for Redis TLS
# Must have OpenSSL installed and available in PATH

# Check if OpenSSL is available
$openssl = Get-Command openssl -ErrorAction SilentlyContinue
if (-not $openssl) {
    Write-Host "Error: OpenSSL is not installed or not in PATH" -ForegroundColor Red
    Write-Host @"
Please install OpenSSL and add it to your PATH. You can:

1. Install using Chocolatey (recommended):
   choco install openssl

2. Or download from https://slproweb.com/products/Win32OpenSSL.html
   - Download and install the latest Win64 OpenSSL v3.x
   - During installation, choose to copy OpenSSL DLLs to Windows system directory
   - Add the OpenSSL bin directory to your PATH (typically C:\Program Files\OpenSSL-Win64\bin)

After installing, restart your PowerShell session and try again.
"@
    exit 1
}

# Script's directory is the target directory for certificates
$CertsDir = $PSScriptRoot

Write-Host "Generating CA key and certificate in $CertsDir..."
# Generate CA key and certificate
& openssl genrsa -out (Join-Path $CertsDir "ca.key") 4096
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& openssl req -x509 -new -nodes -sha256 -key (Join-Path $CertsDir "ca.key") -days 3650 -out (Join-Path $CertsDir "ca.crt") -subj "/CN=Redis CA"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Generating Redis server key and CSR in $CertsDir..."
# Generate Redis server key and CSR
& openssl genrsa -out (Join-Path $CertsDir "redis.key") 2048
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Use fastapi_rbac_redis as the Common Name for the Redis certificate
& openssl req -new -key (Join-Path $CertsDir "redis.key") -out (Join-Path $CertsDir "redis.csr") -subj "/CN=fastapi_rbac_redis"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Signing the Redis server certificate with our CA in $CertsDir..."
# Sign the Redis server certificate with our CA
& openssl x509 -req -sha256 -days 365 -in (Join-Path $CertsDir "redis.csr") -CA (Join-Path $CertsDir "ca.crt") -CAkey (Join-Path $CertsDir "ca.key") -CAcreateserial -out (Join-Path $CertsDir "redis.crt")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Cleaning up temporary files from $CertsDir..."
# Clean up CSR and serial files
Remove-Item -Path (Join-Path $CertsDir "redis.csr") -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path $CertsDir "ca.srl") -ErrorAction SilentlyContinue

Write-Host "Setting file permissions in $CertsDir..."
# Set proper permissions - note that PowerShell uses different permission system
# These are approximate equivalents to the Linux 644 and 600 permissions
$CaCrtPath = Join-Path $CertsDir "ca.crt"
$RedisCrtPath = Join-Path $CertsDir "redis.crt"
$CaKeyPath = Join-Path $CertsDir "ca.key"
$RedisKeyPath = Join-Path $CertsDir "redis.key"

$acl = Get-Acl $CaCrtPath
$acl.SetAccessRuleProtection($true, $false)
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule("Users","Read","Allow")
$acl.AddAccessRule($rule)
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule("Administrators","FullControl","Allow")
$acl.AddAccessRule($rule)
Set-Acl $CaCrtPath $acl
Set-Acl $RedisCrtPath $acl

# Set permissions for redis.key to be readable by Users
$aclRedisKey = Get-Acl $RedisKeyPath
$aclRedisKey.SetAccessRuleProtection($true, $false) # Disinherit and remove existing rules
$ruleRedisKeyUsers = New-Object System.Security.AccessControl.FileSystemAccessRule("Users", "Read", "Allow")
$aclRedisKey.AddAccessRule($ruleRedisKeyUsers)
$ruleRedisKeyAdmins = New-Object System.Security.AccessControl.FileSystemAccessRule("Administrators", "FullControl", "Allow")
$aclRedisKey.AddAccessRule($ruleRedisKeyAdmins)
Set-Acl $RedisKeyPath $aclRedisKey

# Keep ca.key restricted to Administrators
$aclCaKey = Get-Acl $CaKeyPath
$aclCaKey.SetAccessRuleProtection($true, $false)
$ruleCaKeyAdmins = New-Object System.Security.AccessControl.FileSystemAccessRule("Administrators","FullControl","Allow")
$aclCaKey.AddAccessRule($ruleCaKeyAdmins)
Set-Acl $CaKeyPath $aclCaKey

Write-Host "Certificates generated successfully in $CertsDir!"
