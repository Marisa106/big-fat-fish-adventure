param(
  [int]$Port = 8123
)

$Root = Split-Path -Parent $PSScriptRoot
Write-Output ("Serving {0} at http://127.0.0.1:{1}/" -f $Root, $Port)
Set-Location -LiteralPath $Root
python -m http.server $Port --bind 127.0.0.1
