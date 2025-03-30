#!/bin/bash

set -e          # Exit immediately if a command exits with a non-zero status
set -o pipefail # Ensure pipeline errors are caught

# Backup the deps directory if it exists
if [ -d "deps" ]; then
  echo -e "\nCreating backup of 'deps' directory..."
  cp -r deps deps_backup
fi

# Function to restore backup on failure
restore_backup() {
  echo -e "\nRestoring backup..."
  rm -rf deps
  mv deps_backup deps
}

# Trap errors and restore backup
trap 'restore_backup' ERR

# Main script
rm -rf deps
bunx gitpick@latest https://github.com/sindresorhus/nano-spawn/tree/main/source deps/nano-spawn
bunx gitpick@latest https://github.com/sindresorhus/yoctocolors/blob/main/base.js deps/yoctocolors
bunx gitpick@latest https://github.com/sindresorhus/yoctocolors/blob/main/base.d.ts deps/yoctocolors
bunx prettier@latest --write --ignore-unknown "deps/**/*"

# Cleanup backup if everything succeeds
rm -rf deps_backup
echo -e "\nScript completed successfully."
