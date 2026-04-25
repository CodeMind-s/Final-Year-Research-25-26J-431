# Wrapper to run az commands with full path
# Usage: powershell.exe -File deploy/az-run.ps1 <az-args>
$azPath = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
& $azPath @args
exit $LASTEXITCODE
