#!/bin/zsh

# path for homebrew and bun
export PATH=/opt/homebrew/bin:/bin

echo "Last updated: $(date)\n"

# Define personal access token and repository details
PAT=""
REPO="nrjdalal/version-checker"

# Clone repo
cd /tmp
rm -rf version-checker
git clone https://$PAT@github.com/$REPO.git

# Navigate to repo and update
cd version-checker
rm -rf next-template
bunx create-next-app@canary next-template --ts --eslint --tailwind --src-dir --app --no-turbopack --import-alias "@/*"
git add .
git commit -m "update next@canary"
git push https://$PAT@github.com/$REPO.git
