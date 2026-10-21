param([string]$OutputRoot = (Join-Path ([IO.Path]::GetTempPath()) ('sesh-validation-' + [guid]::NewGuid().ToString('N'))))
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$output = [IO.Path]::GetFullPath($OutputRoot)
if (Test-Path -LiteralPath $output) { throw "Validation output must be a new directory: $output" }
New-Item -ItemType Directory -Path $output | Out-Null
$npm = if ($IsWindows) { (Get-Command npm.cmd).Source } else { (Get-Command npm).Source }
function Invoke-Npm([string[]]$Arguments) {
  & $npm @Arguments
  if ($LASTEXITCODE -ne 0) { throw "npm failed: $($Arguments -join ' ')" }
}
Push-Location $repo
try {
  Invoke-Npm @('ci','--prefix','AS/sesh-evidence','--ignore-scripts','--no-audit','--no-fund')
  Invoke-Npm @('ci','--prefix','scripts','--ignore-scripts','--no-audit','--no-fund')
  Invoke-Npm @('run','--prefix','scripts','format:check')
  $testFiles = @(Get-ChildItem -LiteralPath AS/sesh-evidence/test -Filter '*.test.cjs' -File | ForEach-Object FullName)
  & node --test @testFiles
  if ($LASTEXITCODE -ne 0) { throw 'Behavioral tests failed' }
  & ./docs/transfer-model/test_schema.ps1
  & ./docs/transfer-model/test_relocation_schema.ps1
  & ./docs/transfer-model/test_git_restore_schema.ps1
  $packs = Join-Path $output 'packages'
  New-Item -ItemType Directory -Path $packs | Out-Null
  $tarballs = @()
  foreach ($name in @('sesh-evidence','sesh-bloodhound','agent-relocator','sesh-nautilus')) {
    Push-Location (Join-Path $repo "AS/$name")
    try {
      $result = & $npm pack --json --pack-destination $packs
      if ($LASTEXITCODE -ne 0) { throw "Packing failed: $name" }
      $packed = $result | ConvertFrom-Json
      $tarballs += Join-Path $packs $packed[0].filename
    } finally { Pop-Location }
  }
  $prefix = Join-Path $output 'installation'
  Invoke-Npm (@('install','--prefix',$prefix,'--ignore-scripts','--no-audit','--no-fund') + $tarballs)
  foreach ($name in @('sesh-bloodhound','agent-relocator','sesh-nautilus')) {
    $wrapper = Join-Path $prefix "node_modules/.bin/$name"
    if ($IsWindows) { $wrapper += '.cmd' }
    & $wrapper --help
    if ($LASTEXITCODE -ne 0) { throw "Installed command failed: $name" }
  }
  & node scripts/smoke-transfer-tools.cjs --prefix $prefix --fixtures (Join-Path $output 'fixtures') --out (Join-Path $output 'validation.json')
  if ($LASTEXITCODE -ne 0) { throw 'Installed package workflows failed' }
  Write-Output "Validation passed. Artifacts: $output"
} finally { Pop-Location }
