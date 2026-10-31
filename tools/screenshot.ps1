param(
  [string]$OutDir = "artifacts/shots"
)

# 备用入口：真实视口截图与 E2E 已统一由 tools/capture.mjs 完成。
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js not found. Run 'node tools/capture.mjs' from the project root."
  exit 1
}
Write-Output "Delegating to tools/capture.mjs (real viewport + E2E) ..."
node tools/capture.mjs
