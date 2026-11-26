param([string]$Tag='edms-ups:2.1.11', [string]$CacheFrom='edms-ups:2.1.10', [switch]$Verify, [switch]$UseHostNetwork)
$ErrorActionPreference='Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
 docker info --format '{{.OSType}}' | Out-Null
 if($LASTEXITCODE -ne 0){throw 'Docker Linux di laptop belum tersedia. Jangan build di NAS.'}
 New-Item -ItemType Directory -Path release -Force | Out-Null
 $buildArgs=@('build','--platform','linux/amd64','--tag',$Tag)
 $releaseVersion=($Tag -split ':')[-1]
 $buildArgs+=@('--build-arg',"APP_VERSION=$releaseVersion")
 if($CacheFrom){$null=& docker image inspect $CacheFrom 2>$null;if($LASTEXITCODE -eq 0){$buildArgs+=@('--cache-from',$CacheFrom)}}
 if($UseHostNetwork){$buildArgs+=@('--network','host')}
 $buildArgs+='.'
 & docker @buildArgs
 if($LASTEXITCODE -ne 0){throw 'Build Linux gagal; tidak ada paket siap deploy.'}
 docker image inspect $Tag --format '{{.Os}}/{{.Architecture}}' | Set-Content release/platform.txt
 if((Get-Content release/platform.txt -Raw).Trim() -ne 'linux/amd64'){throw 'Arsitektur image salah'}
 $tarName=($Tag -replace ':','-')+'.tar'
 docker save --output (Join-Path release $tarName) $Tag
 if($LASTEXITCODE -ne 0){throw 'Export image gagal'}
 (Get-FileHash -LiteralPath (Join-Path release $tarName) -Algorithm SHA256).Hash | Set-Content (Join-Path release ($tarName+'.SHA256.txt'))
 if ($Verify) {
  $verifierTag=$Tag -replace '^edms-ups:','edms-ups-verifier:'
  $verifyArgs=@('build','--platform','linux/amd64','--build-arg',"APP_VERSION=$releaseVersion",'--target','verifier','--tag',$verifierTag)
  if($CacheFrom){$null=& docker image inspect $CacheFrom 2>$null;if($LASTEXITCODE -eq 0){$verifyArgs+=@('--cache-from',$CacheFrom)}}
  if($UseHostNetwork){$verifyArgs+=@('--network','host')}
  $verifyArgs+='.'
  & docker @verifyArgs
  if($LASTEXITCODE -ne 0){throw 'Image verifier Linux gagal dibuat; rilis belum terverifikasi.'}
  & (Join-Path $PSScriptRoot 'verify-release.ps1') -Tag $Tag -VerifierTag $verifierTag
 } else {
  Write-Output 'Image Linux siap; selesaikan backup/restore dan dummy integration sebelum cutover.'
 }
} finally {Pop-Location}
