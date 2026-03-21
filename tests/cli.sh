#!/bin/bash

set -e

TEST_RUNNER="node dist/index.mjs"
TEST_SOURCE="local"

if [ "$#" -gt 0 ]; then
  case "$1" in
    gitpick@*|@*/*)
      TEST_RUNNER="bunx --bun $1"
      TEST_SOURCE="$1"
      shift
      ;;
  esac
fi

if [ ! -d "external" ]; then
  echo -e "\n❌ The 'external' folder does not exist. Please run \033[1;32mnpm run sync:external\033[0m first.\n"
  exit 1
fi

if [ "$TEST_RUNNER" = "node dist/index.mjs" ]; then
  bun run build
fi

if [ "$#" -gt 0 ]; then
  eval "$TEST_RUNNER $*"
  exit 0
fi

rm -rf .test-artifacts/cli
mkdir -p .test-artifacts/cli

TEST_CASES=(
  'nrjdalal/gitpick/blob/main/bin/index.ts'
  'nrjdalal/gitpick'
  'https://github.com/nrjdalal/gitpick'
  'git@github.com:nrjdalal/gitpick.git'
  'https://github.com/nrjdalal/gitpick.git'
  'nrjdalal/gitpick/tree/main/bin'
  'https://github.com/nrjdalal/gitpick/tree/main/bin'
  'git@github.com:nrjdalal/gitpick.git/tree/main/bin'
  'https://github.com/nrjdalal/gitpick.git/tree/main/bin'
  'nrjdalal/gitpick/tree/master/bin -b main'
  'https://github.com/nrjdalal/gitpick/tree/master/bin -b main'
  'git@github.com:nrjdalal/gitpick.git/tree/master/bin -b main'
  'https://github.com/nrjdalal/gitpick.git/tree/master/bin -b main'
  'nrjdalal/zerostarter/tree/main'
)

# Initialize report variables
PASSED_TESTS=0
FAILED_TESTS=0
REPORT=""
RUNNER_VERSION="$(eval "$TEST_RUNNER --version" | tr -d '\r\n' | xargs)"

echo

# Iterate over test cases
for i in "${!TEST_CASES[@]}"; do
  TEST_CASE="${TEST_CASES[$i]}"
  TEST_NUMBER=$((i + 1))

  echo ------------------------- $TEST_NUMBER -------------------------
  echo
  echo "🚀 Running test case #$TEST_NUMBER CMD: $TEST_RUNNER clone $TEST_CASE .test-artifacts/cli/$TEST_NUMBER"

  rm -rf .test-artifacts/cli/$TEST_NUMBER

  if eval "$TEST_RUNNER clone $TEST_CASE .test-artifacts/cli/$TEST_NUMBER"; then
    if [ "$(ls -A .test-artifacts/cli/$TEST_NUMBER)" ]; then
      cd .test-artifacts/cli/$TEST_NUMBER

      if [ "$(ls -A | wc -l)" -gt 0 ]; then
        cd ../../..
      else
        echo "❌ Cloning failed for test case #$TEST_NUMBER: $TEST_CASE"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        REPORT+="❌ Test case #$TEST_NUMBER failed: $TEST_CASE\n"
        cd ../../..
        continue
      fi

      echo -e "\n✅ Test passed #$TEST_NUMBER: $TEST_CASE"
      PASSED_TESTS=$((PASSED_TESTS + 1))
      REPORT+="✅ Test case #$TEST_NUMBER passed: $TEST_CASE\n"
    else
      echo -e "\n❌ Test failed #$TEST_NUMBER: $TEST_CASE"
      FAILED_TESTS=$((FAILED_TESTS + 1))
      REPORT+="❌ Test case #$TEST_NUMBER failed: $TEST_CASE\n"
    fi
  else
    echo "❌ Cloning failed for test case #$TEST_NUMBER: $TEST_CASE"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    REPORT+="❌ Test case #$TEST_NUMBER failed: $TEST_CASE\n"
  fi

  echo
done

# Final report
echo ---------------------- SUMMARY ----------------------
echo -e "\n📋 $PASSED_TESTS out of ${#TEST_CASES[@]} test cases passed.\n"

echo -e "$REPORT"
if [ "$TEST_SOURCE" = "$RUNNER_VERSION" ]; then
  echo "🏷️  Runner: $RUNNER_VERSION"
else
  echo "🏷️  Runner: $TEST_SOURCE ($RUNNER_VERSION)"
fi

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "🎉 All test cases passed!"
else
  echo -e "🚨 Some test cases failed. Please review the errors."
  exit 1
fi
