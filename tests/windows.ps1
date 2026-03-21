$ErrorActionPreference = "Stop"

$TEST_RUNNER = "node dist\index.mjs"
$ARTIFACTS = ".test-artifacts\windows"

if (Test-Path $ARTIFACTS) { Remove-Item -Recurse -Force $ARTIFACTS }
New-Item -ItemType Directory -Force $ARTIFACTS | Out-Null

$TEST_CASES = @(
  @("nrjdalal/gitpick/blob/main/bin/index.ts", "$ARTIFACTS\1")
  @("nrjdalal/gitpick", "$ARTIFACTS\2")
  @("nrjdalal/gitpick/tree/main/bin", "$ARTIFACTS\3")
  @("nrjdalal/gitpick/tree/master/bin -b main", "$ARTIFACTS\4")
  @("nrjdalal/zerostarter/tree/main", "$ARTIFACTS\5")
)

$passed = 0
$failed = 0

for ($i = 0; $i -lt $TEST_CASES.Count; $i++) {
  $num = $i + 1
  $url = $TEST_CASES[$i][0]
  $target = $TEST_CASES[$i][1]

  Write-Host "`n------------------------- $num -------------------------"
  Write-Host "Running: $TEST_RUNNER clone $url $target"

  $cmd = "$TEST_RUNNER clone $url $target -o"
  Invoke-Expression $cmd

  if ($LASTEXITCODE -ne 0) {
    Write-Host "X Test case #$num failed: $url"
    $failed++
    continue
  }

  if (Test-Path $target) {
    $items = Get-ChildItem -Recurse -Name $target | Select-Object -First 20
    foreach ($item in $items) { Write-Host "  $item" }
    Write-Host "V Test case #$num passed: $url"
    $passed++
  } else {
    Write-Host "X Test case #$num failed: $url (no output)"
    $failed++
  }
}

$total = $TEST_CASES.Count
Write-Host "`n---------------------- SUMMARY ----------------------"
Write-Host "$passed/$total Windows path tests passed."

if ($failed -gt 0) {
  Write-Host "Some tests failed."
  exit 1
} else {
  Write-Host "All Windows tests passed!"
}
