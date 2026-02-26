#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE_DIR="$SCRIPT_DIR/templates/default"

echo "Syncing framework files from root into CLI template..."

# Framework files (all 9)
mkdir -p "$TEMPLATE_DIR/src/framework"
cp "$ROOT_DIR/src/framework/index.ts" "$TEMPLATE_DIR/src/framework/"
cp "$ROOT_DIR/src/framework/types.ts" "$TEMPLATE_DIR/src/framework/"
cp "$ROOT_DIR/src/framework/animation-config.ts" "$TEMPLATE_DIR/src/framework/"
cp "$ROOT_DIR/src/framework/animation-context.tsx" "$TEMPLATE_DIR/src/framework/"
cp "$ROOT_DIR/src/framework/animated.tsx" "$TEMPLATE_DIR/src/framework/"
cp "$ROOT_DIR/src/framework/transitions.ts" "$TEMPLATE_DIR/src/framework/"
cp "$ROOT_DIR/src/framework/morph.tsx" "$TEMPLATE_DIR/src/framework/"
cp "$ROOT_DIR/src/framework/slide-layout.tsx" "$TEMPLATE_DIR/src/framework/"
cp "$ROOT_DIR/src/framework/use-slide-navigation.ts" "$TEMPLATE_DIR/src/framework/"

# Components
mkdir -p "$TEMPLATE_DIR/src/components"
cp "$ROOT_DIR/src/components/slide-deck.tsx" "$TEMPLATE_DIR/src/components/"

# Lib
mkdir -p "$TEMPLATE_DIR/src/lib"
cp "$ROOT_DIR/src/lib/utils.ts" "$TEMPLATE_DIR/src/lib/"

# Shared source files
cp "$ROOT_DIR/src/main.tsx" "$TEMPLATE_DIR/src/"
cp "$ROOT_DIR/src/globals.css" "$TEMPLATE_DIR/src/"

# Config files
cp "$ROOT_DIR/vite.config.ts" "$TEMPLATE_DIR/"
cp "$ROOT_DIR/tsconfig.json" "$TEMPLATE_DIR/"
cp "$ROOT_DIR/postcss.config.mjs" "$TEMPLATE_DIR/"
cp "$ROOT_DIR/.gitignore" "$TEMPLATE_DIR/"

# Public assets
mkdir -p "$TEMPLATE_DIR/public"
cp "$ROOT_DIR/public/logo.svg" "$TEMPLATE_DIR/public/"

# AGENTS.md
cp "$ROOT_DIR/AGENTS.md" "$TEMPLATE_DIR/"

echo "Done. Synced framework files into template."
echo ""
echo "Template-specific files (App.tsx, deck-config.ts, slides/, README.md, package.json, index.html)"
echo "are NOT synced — they contain placeholders and must be edited manually."
