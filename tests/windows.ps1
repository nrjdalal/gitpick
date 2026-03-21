$ErrorActionPreference = "Stop"

$ARTIFACTS = ".test-artifacts\windows"

if (Test-Path $ARTIFACTS) { Remove-Item -Recurse -Force $ARTIFACTS }
New-Item -ItemType Directory -Force $ARTIFACTS | Out-Null

$urls = @(
  "nrjdalal/gitpick/blob/main/bin/index.ts"
  "nrjdalal/gitpick"
  "https://github.com/nrjdalal/gitpick"
  "git@github.com:nrjdalal/gitpick.git"
  "https://github.com/nrjdalal/gitpick.git"
  "nrjdalal/gitpick/tree/main/bin"
  "https://github.com/nrjdalal/gitpick/tree/main/bin"
  "git@github.com:nrjdalal/gitpick.git/tree/main/bin"
  "https://github.com/nrjdalal/gitpick.git/tree/main/bin"
  "nrjdalal/gitpick/tree/master/bin -b main"
  "https://github.com/nrjdalal/gitpick/tree/master/bin -b main"
  "git@github.com:nrjdalal/gitpick.git/tree/master/bin -b main"
  "https://github.com/nrjdalal/gitpick.git/tree/master/bin -b main"
  "nrjdalal/zerostarter/tree/main"
)

$passed = 0
$failed = 0

Write-Host ""

for ($i = 0; $i -lt $urls.Count; $i++) {
  $num = $i + 1
  $url = $urls[$i]
  $target = "$ARTIFACTS\$num"

  Write-Host "------------------------- $num -------------------------"
  Write-Host ""
  Write-Host "Running test case #$num CMD: node dist\index.mjs clone $url $target -o"

  node dist\index.mjs clone $url.Split(" ") $target -o

  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "X Cloning failed for test case #$num : $url"
    $failed++
    Write-Host ""
    continue
  }

  if (Test-Path $target) {
    Write-Host ""
    node tests\tree.mjs $target
    Write-Host ""
    Write-Host "V Test passed #$num : $url"
    $passed++
  } else {
    Write-Host ""
    Write-Host "X Test failed #$num : $url"
    $failed++
  }

  Write-Host ""
}

$total = $urls.Count
Write-Host "---------------------- SUMMARY ----------------------"
Write-Host ""
Write-Host "$passed out of $total test cases passed."
Write-Host ""

if ($failed -gt 0) {
  Write-Host "Some test cases failed. Please review the errors."
  exit 1
} else {
  Write-Host "All test cases passed!"
}
