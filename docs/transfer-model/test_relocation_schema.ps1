$ErrorActionPreference = 'Stop'
$schemaFile = Join-Path $PSScriptRoot 'relocation-request.schema.json'
$baseline = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'examples/relocation/bounded-two-instance-request.json') -Raw
$checks = 0
function New-Request { $baseline | ConvertFrom-Json }
function Assert-Request([string]$Name, $Request, [bool]$Expected) {
    $valid = Test-Json -Json ($Request | ConvertTo-Json -Depth 40) -SchemaFile $schemaFile -ErrorAction SilentlyContinue
    if ($valid -ne $Expected) { throw "Unexpected relocation request validity: $Name" }
    $script:checks++
}
Assert-Request 'bounded two-instance request' (New-Request) $true
$request = New-Request
$request.executionReady = $true
Assert-Request 'planning request cannot claim runtime readiness' $request $false
$request = New-Request
$request.scan.budgets.maxDecodedBytes = 0
Assert-Request 'decoded byte budget must be positive' $request $false
$request = New-Request
$request.scan.budgets.PSObject.Properties.Remove('maxLineBytes')
Assert-Request 'oversized-line bound cannot be omitted' $request $false
$request = New-Request
$request.scan.executeRecordedCommands = $true
Assert-Request 'archaeology cannot execute recorded commands' $request $false
$request = New-Request
$request.system.maxEdgeDepth = -1
Assert-Request 'system graph depth cannot be negative' $request $false
$request = New-Request
$request.selection.rules[0].extent.maxDepth = 2
Assert-Request 'explicit files cannot implicitly expand' $request $false
$request = New-Request
$request.selection.rules[3].extent.maxDepth = -1
Assert-Request 'tree depth cannot be negative' $request $false
$request = New-Request
$request.selection.rules[3].extent.PSObject.Properties.Remove('root')
Assert-Request 'explicit tree anchor needs a root' $request $false
$request = New-Request
$request.selection.rules[3].extent.maxDepth = $null
Assert-Request 'explicit unlimited tree depth retains expansion budgets' $request $true
$request.selection.PSObject.Properties.Remove('expansionBudgets')
Assert-Request 'unlimited tree depth cannot remove expansion budgets' $request $false
$request = New-Request
$request.historyProjection.includeIncomingCheckpoint = $false
Assert-Request 'slim profile retains incoming checkpoint' $request $false
$request = New-Request
$request.historyProjection.retainedIntervals = $null
Assert-Request 'slim history requires interval count' $request $false
$request = New-Request
$request.historyProjection.mode = 'all'
$request.historyProjection.retainedIntervals = $null
Assert-Request 'full history is a separate profile' $request $true
$request = New-Request
$request.historyProjection.unknownBoundaryPolicy = 'guess'
Assert-Request 'unknown boundaries cannot be silently guessed' $request $false
$request = New-Request
$request.historyProjection.pristinePolicy = 'truncate-in-place'
Assert-Request 'source preservation cannot become in-place truncation' $request $false
$request = New-Request
$request.launch.projectRoots[0].instructionDelivery = 'none'
Assert-Request 'required instructions need delivery choice' $request $false
$request = New-Request
$request.selection.rules[2].binding.targetRole = 'recovery-source'
$request.selection.rules[2].binding.access = 'read-write'
Assert-Request 'recovery-source cannot become a writable link target' $request $false
Write-Output "$checks composed relocation request checks passed. No scans, copies, links, history projection or launches were executed."
