#!/bin/bash

set -e

bun run build

TEST_CASES=(
  'nrjdalal/gitpick'
  'https://github.com/nrjdalal/gitpick'
  'git@github.com:nrjdalal/gitpick.git'
  'https://github.com/nrjdalal/gitpick.git'
  'nrjdalal/gitpick/tree/main/src'
  'https://github.com/nrjdalal/gitpick/tree/main/src'
  'git@github.com:nrjdalal/gitpick.git/tree/main/src'
  'https://github.com/nrjdalal/gitpick.git/tree/main/src'
  'nrjdalal/gitpick/tree/master/src -b main'
  'https://github.com/nrjdalal/gitpick/tree/master/src -b main'
  'git@github.com:nrjdalal/gitpick.git/tree/master/src -b main'
  'https://github.com/nrjdalal/gitpick.git/tree/master/src -b main'
  'nrjdalal/gitpick/blob/main/src/index.ts'
)

# Initialize report variables
PASSED_TESTS=0
FAILED_TESTS=0
REPORT=""

echo

# Iterate over test cases
for i in "${!TEST_CASES[@]}"; do
  TEST_CASE="${TEST_CASES[$i]}"
  TEST_NUMBER=$((i + 1))

  echo ------------------------- $TEST_NUMBER -------------------------
  echo
  echo "🚀 Running test case #$TEST_NUMBER CMD: node dist/index.js clone $TEST_CASE test/$TEST_NUMBER"

  # rm -rf test/$TEST_NUMBER

  if eval "node dist/index.js clone $TEST_CASE test/$TEST_NUMBER"; then
    if [ "$(ls -A test/$TEST_NUMBER)" ]; then
      cd test/$TEST_NUMBER

      if [ "$(ls -A | wc -l)" -gt 0 ]; then
        cd ../..
      else
        echo "❌ Cloning failed for test case #$TEST_NUMBER: $TEST_CASE"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        REPORT+="❌ Test case #$TEST_NUMBER failed: $TEST_CASE\n"
        cd ../..
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

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "🎉 All test cases passed!"
else
  echo -e "🚨 Some test cases failed. Please review the errors."
  exit 1
fi
