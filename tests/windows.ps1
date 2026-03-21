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

for ($i = 0; $i -lt $urls.Count; $i++) {
  $num = $i + 1
  $url = $urls[$i]
  $target = "$ARTIFACTS\$num"

  Write-Host "`n------------------------- $num -------------------------"
  Write-Host "Running: node dist\index.mjs clone $url $target -o"

  node dist\index.mjs clone $url.Split(" ") $target -o

  if ($LASTEXITCODE -ne 0) {
    Write-Host "X Test case #$num failed: $url"
    $failed++
    continue
  }

  if (Test-Path $target) {
    node tests\tree.mjs $target
    Write-Host "V Test case #$num passed: $url"
    $passed++
  } else {
    Write-Host "X Test case #$num failed: $url (no output)"
    $failed++
  }
}

$total = $urls.Count
Write-Host "`n---------------------- SUMMARY ----------------------"
Write-Host "$passed/$total Windows path tests passed."

if ($failed -gt 0) {
  Write-Host "Some tests failed."
  exit 1
} else {
  Write-Host "All Windows tests passed!"
}
