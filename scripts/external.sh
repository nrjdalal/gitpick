#!/bin/bash

set -e          # Exit immediately if a command exits with a non-zero status
set -o pipefail # Ensure pipeline errors are caught

# Create a temporary directory for the backup
TEMP_BACKUP_DIR=$(mktemp -d)

# Backup the external directory if it exists
if [ -d "external" ]; then
  echo -e "\nCreating backup of 'external' directory in temporary directory..."
  cp -r external "$TEMP_BACKUP_DIR/external_backup"
fi

# Function to restore backup on failure
restore_backup() {
  echo -e "\nRestoring backup from temporary directory..."
  rm -rf external
  mv "$TEMP_BACKUP_DIR/external_backup" external
}

# Trap errors and restore backup
trap 'restore_backup' ERR

# Main script
rm -rf external
bunx gitpick@latest https://github.com/sindresorhus/nano-spawn/tree/main/source external/nano-spawn

# bunx gitpick@latest https://github.com/sindresorhus/yoctocolors/blob/main/base.js external/yoctocolors
# bunx gitpick@latest https://github.com/sindresorhus/yoctocolors/blob/main/base.d.ts external/yoctocolors
# bunx gitpick@latest https://github.com/sindresorhus/yoctocolors/blob/main/index.js external/yoctocolors
# bunx gitpick@latest https://github.com/sindresorhus/yoctocolors/blob/main/index.d.ts external/yoctocolors

# bunx gitpick@latest https://github.com/sindresorhus/yocto-spinner/blob/main/index.js external/yocto-spinner
# bunx gitpick@latest https://github.com/sindresorhus/yocto-spinner/blob/main/index.d.ts external/yocto-spinner

# bunx prettier@latest --write --ignore-unknown "external/**/*"

# sed -i '' 's|import yoctocolors from "yoctocolors"|import yoctocolors from "../yoctocolors"|g' external/yocto-spinner/index.js

# Cleanup backup if everything succeeds
rm -rf "$TEMP_BACKUP_DIR"
echo -e "\nScript completed successfully."
