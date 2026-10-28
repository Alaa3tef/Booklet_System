
# Build Angular
npm run build

if ($LASTEXITCODE -ne 0) {
    throw "Build failed. Deployment cancelled."
}

# Change these paths to your actual folders
$source = ".\dist\exam-booklet-system\browser\"
$destination = "\\10.4.254.112:9090\C:\BookletSystemFront\"

# Copy build files but preserve the existing web.config
robocopy $source $destination /E /XF web.config

# Robocopy exit codes 0-7 are not failures
if ($LASTEXITCODE -ge 8) {
    throw "Deployment failed. Check permissions and connection."
}

Write-Host "Deployment completed successfully."
