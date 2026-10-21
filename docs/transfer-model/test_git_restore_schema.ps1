$ErrorActionPreference = 'Stop'
$schema = Join-Path $PSScriptRoot 'git-restore.schema.json'
$checks = 0
function New-Request {
  return @{
    version=1; inventoryRef='inventory.json'; executionReady=$false
    acquisition=@{method='preserved-repository-copy';remoteUrl=$null;networkPolicy='offline';objectIndependence='no-source-alternates-or-hardlink-dependency'}
    checkout=@{baseline='source-inventory-head';commit=('a'*40);branchPolicy='new-contributor-branch';branchName='meridian/sprint';remoteDrift='forbid-head-drift'}
    destination=@{layout='standalone-checkout';pathPolicy='remapped';path='C:/trial/project';commonRepository=$null;collisionPolicy='block-without-overwrite'}
    localState=@{preservationRef='preserved.json';application='reconcile-overlay';include=@('staged','unstaged','untracked','ignored-assets','unpublished-refs','stashes','reflogs','git-config','worktree-metadata')}
    dependencies=@{submodules='preserve-recorded-commits';lfs='preserve-required-objects';hooks='inventory-before-individual-activation';absolutePointers='record-before-repair-copies-only'}
  }
}
function Check($name,$request,$expected) {
  $actual = $request | ConvertTo-Json -Depth 20 | Test-Json -SchemaFile $schema -ErrorAction SilentlyContinue
  if ($actual -ne $expected) { throw "Unexpected validation for $name" }
  $script:checks++
}
$r=New-Request; Check 'offline repository without remote' $r $true
$r.acquisition.method='local-clone'; Check 'independent local clone without remote' $r $true
$r.acquisition.method='bundle'; Check 'bundle without remote' $r $true
$r=New-Request; $r.checkout.branchPolicy='same-name-in-independent-repository'; $r.checkout.branchName='main'; Check 'same branch in separate checkout' $r $true
$r.destination.layout='new-worktree';$r.destination.commonRepository='C:/owned-common'; Check 'same-name branch requires independent repository' $r $false
$r.checkout.branchPolicy='new-contributor-branch';$r.checkout.branchName='meridian/trial'; Check 'new branch in destination worktree' $r $true
$r.destination.commonRepository=$null; Check 'worktree requires common repository' $r $false
$r=New-Request;$r.acquisition.method='remote-clone'; Check 'remote clone requires url and network policy' $r $false
$r.acquisition.remoteUrl='https://example.test/repo.git';$r.acquisition.networkPolicy='explicit-fetch'; Check 'remote clone can pin source head' $r $true
$r.checkout.baseline='observed-remote-tip'; Check 'remote tip requires explicit drift acceptance' $r $false
$r.checkout.remoteDrift='accept-recorded-diff'; Check 'observed remote commit is explicit' $r $true
$r=New-Request;$r.checkout.branchPolicy='detached';$r.checkout.branchName=$null; Check 'detached inspection' $r $true
$r.checkout.commit='main'; Check 'branch name cannot masquerade as exact commit' $r $false
$r=New-Request;$r.destination.collisionPolicy='overwrite';Check 'no implicit collision overwrite' $r $false
Write-Output "$checks Git restoration schema checks passed; no Git or transfer operations executed."
