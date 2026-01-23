#!/bin/bash
MAX_ITERATIONS=20
cd "$(dirname "$0")/../.."

echo "🐺 Ralph starting in $(pwd)"
echo "Story: US-FIX-005 - Visual Indicator for Shared Photo"
echo ""

for ((i=1; i<=MAX_ITERATIONS; i++)); do
  echo "=== Iteration $i / $MAX_ITERATIONS ==="
  
  result=$(codex exec --full-auto "$(cat scripts/ralph-fixes/prompt.md)")
  echo "$result"
  
  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo ""
    echo "✅ Story complete!"
    exit 0
  fi
  
  echo ""
  echo "--- Continuing to next iteration ---"
  echo ""
done

echo "⚠️ Max iterations ($MAX_ITERATIONS) reached without completion"
exit 1
