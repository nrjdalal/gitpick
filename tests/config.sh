#!/bin/bash

set -e

TEST_RUNNER="node $(pwd)/dist/index.mjs"

if [ "$#" -gt 0 ]; then
  case "$1" in
    gitpick@*|@*/*)
      TEST_RUNNER="bunx --bun $1"
      shift
      ;;
  esac
fi

if [ "$TEST_RUNNER" = "node $(pwd)/dist/index.mjs" ]; then
  bun run build
fi

rm -rf .test-artifacts/config
mkdir -p .test-artifacts/config
cp .gitpick.jsonc .test-artifacts/config/.gitpick.jsonc

echo -e "\n🚀 Running .gitpick.jsonc config test\n"

(cd .test-artifacts/config && eval "$TEST_RUNNER")

PASSED=0
FAILED=0
TOTAL=14

for i in $(seq 1 $TOTAL); do
  if [ "$(ls -A ".test-artifacts/config/$i" 2>/dev/null)" ]; then
    echo "✅ Test case #$i"
    PASSED=$((PASSED + 1))
  else
    echo "❌ Test case #$i"
    FAILED=$((FAILED + 1))
  fi
done

echo -e "\n📋 $PASSED/$TOTAL .gitpick.jsonc checks passed."

if [ $FAILED -eq 0 ]; then
  echo -e "🎉 All config tests passed!\n"
else
  echo -e "🚨 Some config tests failed.\n"
  exit 1
fi
