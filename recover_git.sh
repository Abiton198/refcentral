#!/bin/bash

set -e

PROJECT_DIR=~/Desktop/refcentral
BACKUP_DIR=~/Desktop/refcentral_backup
REMOTE_URL="git@github.com:Abiton198/refcentral.git"   # 🔑 Replace with your GitHub/GitLab repo

echo "🚑 Backing up project to $BACKUP_DIR ..."
rm -rf "$BACKUP_DIR"
cp -r "$PROJECT_DIR" "$BACKUP_DIR"

cd "$PROJECT_DIR"

echo "🗑️ Removing corrupted .git ..."
rm -rf .git

echo "🔄 Reinitializing git ..."
git init
git remote add origin "$REMOTE_URL"

echo "📥 Fetching from remote ..."
git fetch origin

echo "🌿 Creating main branch ..."
git checkout -b main
git reset --hard origin/main || true

echo "📂 Restoring backup files ..."
cp -r "$BACKUP_DIR"/* "$PROJECT_DIR"/

echo "➕ Staging files ..."
git add .

echo "💾 Committing recovery ..."
git commit -m "Recovered project after git corruption"

echo "🚀 Pushing to remote ..."
git push origin main --force

echo "✅ Recovery complete!"
