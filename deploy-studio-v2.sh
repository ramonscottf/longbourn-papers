#!/bin/bash
# Longbourn Photo Studio v2 — Deploy Script
# Run from ~/Projects/longbourn-papers on the Dutchman
# ---------------------------------------------------

set -e

echo "📷 Longbourn Photo Studio v2 — Deploy"
echo "======================================="

cd ~/Projects/longbourn-papers

# Pull latest
git pull origin main
echo "✓ Pulled latest"

# --- Set OPENAI_API_KEY secret (only needed once, skip if already set) ---
# Uncomment and fill in your key if not already configured:
# echo "your-openai-key-here" | npx wrangler secret put OPENAI_API_KEY

# --- Deploy Pages + Worker (full-stack via root wrangler.jsonc) ---
echo ""
echo "Deploying Pages + Worker..."
npx wrangler deploy --config wrangler.jsonc

echo ""
echo "✓ Done. Photo Studio v2 live at longbournpapers.com/photos"
echo ""
echo "Pipeline:"
echo "  Upload → Clean (AI bg removal) → Set Prime → Generate Scene → Approve → Deploy"
echo ""
echo "If OPENAI_API_KEY not yet set:"
echo "  npx wrangler secret put OPENAI_API_KEY --config wrangler.jsonc"
