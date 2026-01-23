# US-FIX-007: Enforce Color as Primary Tag

## Context
You are working on the Ownly project, a smart home inventory PWA.
Project root: ~/work/ownly

## Problem
AI doesn't always include color as a tag when analyzing images. Users want to search by color (e.g., "blue shirt").

## Your Task
Update the AI Vision prompt to enforce color as the FIRST tag for every detected item.

## Files to Modify
1. `supabase/functions/analyze-image/index.ts` - Update VISION_PROMPT

## Requirements

### 1. Update VISION_PROMPT
Find the section about tags in VISION_PROMPT and modify it to:

```
3. Relevant tags - IMPORTANT: The FIRST tag MUST be the dominant color of the item (e.g., "blue", "red", "black", "white", "silver", "brown", "beige", "navy", "gray"). 
   If multiple colors, use the most prominent one.
   If color is unclear, use "multicolor" or "neutral".
   Remaining tags: material, condition, size, style, etc.
   Example: "tags": ["navy blue", "cotton", "casual", "medium"]
```

### 2. Add Color Validation (Optional)
After parsing the AI response, add a simple check:

```typescript
const COLOR_WORDS = [
  'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink',
  'black', 'white', 'gray', 'grey', 'brown', 'beige', 'tan',
  'navy', 'teal', 'cyan', 'magenta', 'gold', 'silver', 'bronze',
  'cream', 'ivory', 'coral', 'maroon', 'olive', 'turquoise',
  'multicolor', 'neutral', 'clear', 'transparent'
];

// Check if first tag contains a color
function hasColorTag(tags: string[]): boolean {
  if (!tags || tags.length === 0) return false;
  const firstTag = tags[0].toLowerCase();
  return COLOR_WORDS.some(color => firstTag.includes(color));
}
```

Log a warning if color tag is missing (don't fail the request).

## Acceptance Criteria
- [ ] VISION_PROMPT updated with color emphasis
- [ ] COLOR_WORDS constant added
- [ ] hasColorTag() function added
- [ ] Warning logged if first tag isn't a color
- [ ] No breaking changes to existing API response format
- [ ] Code compiles without TypeScript errors

## Verification
After making changes, the AI should return responses like:
- Blue shirt → tags: ["blue", "cotton", "casual"]  
- Black laptop → tags: ["black", "electronics", "portable"]
- Wooden chair → tags: ["brown", "wood", "furniture"]

## Done Criteria
Run: `cd ~/work/ownly && npm run build`
Build must pass.

When completely finished, run:
openclaw gateway wake --text "Done: US-FIX-007 - Color tag enforcement added to AI prompt" --mode now
