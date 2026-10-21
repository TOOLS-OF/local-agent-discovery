$ErrorActionPreference = 'Stop'
$schemaFile = Join-Path $PSScriptRoot 'plan.schema.json'
$baseline = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'examples/exclusive-original-paths.json') -Raw
$checks = 0
function Assert-PlanValidity([string]$Name, $Plan, [bool]$Expected) {
    $json = $Plan | ConvertTo-Json -Depth 30
    $valid = Test-Json -Json $json -SchemaFile $schemaFile -ErrorAction SilentlyContinue
    if ($valid -ne $Expected) { throw "Unexpected schema result: $Name (expected $Expected)" }
    $script:checks++
}
foreach ($file in Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'examples') -Filter '*.json') {
    Assert-PlanValidity $file.Name (Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json) $true
}
$ready = $baseline | ConvertFrom-Json
$ready.executionReady = $true
$ready.blockers = @()
$ready.capabilities.requiredAcceptance = 'passed'
$ready.capabilities.evidence = @('synthetic-fixture:verified')
$ready.references[0].status = 'passed'
Assert-PlanValidity 'consistent ready contract' $ready $true
$plan = $ready | ConvertTo-Json -Depth 30 | ConvertFrom-Json
$plan.continuity.sourceWriter = 'active'
Assert-PlanValidity 'exclusive continuation with active source cannot be ready' $plan $false
$plan.continuity.sourceWriter = 'unknown'
Assert-PlanValidity 'exclusive continuation with unknown writer cannot be ready' $plan $false
$plan = $ready | ConvertTo-Json -Depth 30 | ConvertFrom-Json
$plan.resources[0].targetRole = 'recovery-source'
Assert-PlanValidity 'ready writable recovery source rejected' $plan $false
$plan.resources[0].targetRole = 'preserved-evidence'
Assert-PlanValidity 'ready writable evidence rejected' $plan $false
$plan = $ready | ConvertTo-Json -Depth 30 | ConvertFrom-Json
$plan.cwd.extent = 'selected-unverified'
Assert-PlanValidity 'unverified subset cannot claim readiness' $plan $false
$plan = $ready | ConvertTo-Json -Depth 30 | ConvertFrom-Json
$plan.references[0].status = 'failed'
Assert-PlanValidity 'failed reference cannot claim readiness' $plan $false
$plan = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'examples/fork-shared-embodiment.json') -Raw | ConvertFrom-Json
$plan.history.binding = 'shared-live-store'
Assert-PlanValidity 'independent fork cannot share its future history stream' $plan $false
$plan.history.binding = 'native-fork'
$plan.identity.policy = 'retain-exclusive'
Assert-PlanValidity 'fork cannot claim exclusive continuation identity' $plan $false
$plan = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'examples/extended-access-candidate.json') -Raw | ConvertFrom-Json
$plan.executionReady = $true
$plan.blockers = @()
$plan.capabilities.requiredAcceptance = 'passed'
$plan.capabilities.evidence = @('synthetic-fixture:other-checks-passed')
foreach ($reference in $plan.references) { $reference.status = 'passed' }
Assert-PlanValidity 'extended access needs verified coordination' $plan $false
$plan.capabilities.historyCoordination = 'verified'
Assert-PlanValidity 'extended access with declared coordination evidence is structurally valid' $plan $true
$plan = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'examples/readonly-history-lens.json') -Raw | ConvertFrom-Json
$plan.history.writerAuthority = 'destination-exclusive'
Assert-PlanValidity 'read-only lens cannot request a history writer' $plan $false
Write-Output "$checks transfer configuration schema checks passed. No transfers or links were executed."
