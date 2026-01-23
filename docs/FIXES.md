# Ownly - Pending Fixes & Improvements

> Created: 2026-01-30
> Status: In Progress

---

## Overview

This document tracks issues discovered during testing and their user stories for implementation.

---

## Issue 1: HEIC Image Processing Failure

**Problem:** Cannot process HEIC images when using 'Import from Gallery' on iOS devices.

**Root Cause:** The `heic2any` library may fail on certain HEIC variants or iOS-specific encodings.

---

### US-FIX-001: Improve HEIC Error Handling [P0]

**Description:** As a user importing HEIC photos from my iPhone gallery, I want clear error messages and fallback options so I can still add items.

**Technical Context:**
- Current implementation: `src/lib/imageUtils.ts` uses `heic2any` library
- Error occurs in `convertHeicToJpeg()` function
- `heic2any` can fail silently or throw generic errors
- iOS Photos app exports HEIC by default

**Acceptance Criteria:**

**Error Detection:**
- [ ] Wrap `heic2any` call in detailed try-catch
- [ ] Log specific error message and stack trace to console
- [ ] Detect common failure modes: corrupt file, unsupported variant, memory issues

**User-Facing Error:**
- [ ] Replace generic "Failed to process HEIC image" with specific message
- [ ] Show: "This image couldn't be processed. Try taking a new photo or use a JPEG/PNG image."
- [ ] Display error in red toast, auto-dismiss after 5 seconds

**Fallback Options:**
- [ ] Show modal with two buttons after HEIC failure:
  - "📷 Take New Photo" → triggers camera input
  - "🖼️ Choose Different Image" → triggers gallery input
- [ ] Modal title: "Image Processing Failed"
- [ ] Modal body: explain that some HEIC formats aren't supported

**Retry Logic:**
- [ ] On first failure, retry with `quality: 0.8` instead of `0.9`
- [ ] On second failure, retry with `quality: 0.6`
- [ ] After 3 failures, show fallback modal

**Files to modify:**
```
src/lib/imageUtils.ts
  - convertHeicToJpeg(): add retry logic, detailed error logging
  - validateImage(): improve HEIC detection

src/pages/AddItemPage.tsx
  - handleImageSelect(): show fallback modal on HEIC failure
  - Add HeicErrorModal component
```

**Test Cases:**
- [ ] Import HEIC from iOS Photos → should convert or show helpful error
- [ ] Import JPEG → should work normally (no regression)
- [ ] Import corrupt HEIC → should show fallback modal
- [ ] Tap "Take New Photo" in fallback → should open camera

---

### US-FIX-002: Server-side HEIC Fallback [P1]

**Description:** As a system, when client-side HEIC conversion fails, I should attempt server-side conversion as fallback.

**Technical Context:**
- Server (Deno) has access to more robust image processing
- Can use Sharp or ImageMagick on server
- Adds latency but ensures compatibility
- Only triggered when client-side fails

**Acceptance Criteria:**

**Edge Function:**
- [ ] Create `supabase/functions/convert-image/index.ts`
- [ ] Accept POST with `{ file: base64, mimeType: string }`
- [ ] Use Deno image processing or call external service
- [ ] Return `{ converted: base64, mimeType: "image/jpeg" }`
- [ ] Handle errors gracefully with proper error response

**Client Integration:**
- [ ] After 3 client-side retries fail, call server conversion
- [ ] Show loading state: "Converting image on server..."
- [ ] Timeout after 30 seconds with error message
- [ ] On success, continue with converted image

**Security:**
- [ ] Require authentication (use Supabase auth header)
- [ ] Limit file size to 10MB
- [ ] Rate limit: max 10 conversions per minute per user

**Files to modify:**
```
supabase/functions/convert-image/index.ts (new)
  - Main handler function
  - Image conversion logic

src/lib/imageUtils.ts
  - Add serverConvertHeic() function
  - Modify convertHeicToJpeg() to call server as fallback
```

**Test Cases:**
- [ ] Client HEIC conversion fails → server conversion succeeds
- [ ] Server conversion timeout → show error, offer retry
- [ ] Unauthenticated request → return 401

---

## Issue 2: Slow Multi-Item Addition

**Problem:** When AI detects multiple items, user must click and save each item one by one. This is tedious.

**Root Cause:** Current flow requires individual item editing before save.

---

### US-FIX-003: Batch Save with AI Defaults [P1]

**Description:** As a user with multiple detected items, I want to quickly add all items using AI-suggested values so I can save time.

**Technical Context:**
- `MultiItemSelection` component shows detected items
- Current flow: select item → ItemEditor → save → repeat
- AI already provides: name, category_suggestion, tags, brand
- Database supports batch insert

**Acceptance Criteria:**

**UI Changes:**
- [ ] Add "Add All Selected" button at bottom of MultiItemSelection
- [ ] Button style: full-width, teal background, white text
- [ ] Button text: "Add All (X items)" where X is selected count
- [ ] Button disabled if no items selected
- [ ] Keep existing "Edit & Add" button for single-item flow

**Batch Save Flow:**
- [ ] On "Add All" click, show full-screen progress overlay
- [ ] Progress UI:
  - Spinner icon
  - Text: "Adding items..."
  - Progress: "1 of 5", "2 of 5", etc.
  - Cancel button (stops remaining, keeps completed)
- [ ] Create items sequentially (not parallel, for better UX feedback)
- [ ] Each item gets: photo_url, thumbnail_url, name, category_id, tags from AI
- [ ] Set quantity = 1, no location (user can edit later)

**Success State:**
- [ ] On complete, show success overlay:
  - Checkmark animation
  - "✓ 5 items added!"
  - "View Inventory" button (primary)
  - "Add More" button (secondary)
- [ ] Auto-dismiss after 3 seconds → navigate to Inventory

**Error Handling:**
- [ ] If one item fails, continue with others
- [ ] On complete, show: "4 of 5 items added. 1 failed."
- [ ] Failed items shown with retry option

**Data Structure:**
```typescript
interface BatchSaveItem {
  photo_url: string;
  thumbnail_url: string;
  name: string;
  category_id: string | null;  // Look up from category_suggestion
  tags: string[];
  brand: string | null;
  quantity: 1;
  ai_metadata: object;
}
```

**Files to modify:**
```
src/components/MultiItemSelection.tsx
  - Add "Add All Selected" button
  - Add BatchSaveProgress component
  - Add BatchSaveSuccess component

src/pages/AddItemPage.tsx
  - handleBatchSave() function
  - Category lookup from suggestion
  - Sequential item creation

src/hooks/useCategories.ts
  - Add findCategoryByName() helper
```

**Test Cases:**
- [ ] Select 3 items → Add All → all 3 appear in Inventory
- [ ] Select 0 items → button disabled
- [ ] Cancel during batch → completed items saved, rest cancelled
- [ ] One item fails → others still saved, error shown

---

### US-FIX-004: Quick Add Single Item [P2]

**Description:** As a user with a single detected item, I want a "Quick Add" option to save immediately with AI defaults.

**Technical Context:**
- When AI detects exactly 1 item, goes directly to ItemEditor
- User must review fields and click Save
- Quick Add skips editor, uses AI values directly

**Acceptance Criteria:**

**UI Changes:**
- [ ] After single-item AI analysis, show choice screen:
  - Item preview (thumbnail + AI-detected name)
  - "Quick Add" button (teal, primary)
  - "Edit Details" button (outline, secondary)
- [ ] Quick Add tooltip: "Save with AI-suggested details"

**Quick Add Flow:**
- [ ] On click, show brief loading spinner
- [ ] Create item with AI values (same as batch save logic)
- [ ] On success: toast "Item added!", navigate to Inventory
- [ ] On error: toast error, stay on screen with retry option

**Preserve Edit Option:**
- [ ] "Edit Details" works as current flow (opens ItemEditor)
- [ ] No regression to existing functionality

**Files to modify:**
```
src/pages/AddItemPage.tsx
  - Add SingleItemChoice component
  - handleQuickAdd() function
  - Modify flow for single detected item
```

**Test Cases:**
- [ ] AI detects 1 item → show Quick Add option
- [ ] Click Quick Add → item saved with AI values
- [ ] Click Edit Details → opens ItemEditor as before
- [ ] AI detects 3 items → no Quick Add (batch flow instead)

---

## Issue 3: Same Photo for All Detected Items

**Problem:** When multiple items are detected in one photo, all items get the same photo. Users expect each item to have its own cropped image.

**Root Cause:** AI doesn't return bounding boxes; we use the full image for all items.

---

### US-FIX-005: Visual Indicator for Shared Photo [P2]

**Description:** As a user, I want to understand that multiple items share the same photo so I'm not confused.

**Technical Context:**
- Multiple items can have same `photo_url` and `thumbnail_url`
- No current indicator that photo is shared
- Users may be confused why items look "the same"

**Acceptance Criteria:**

**Database Change:**
- [ ] Add `source_batch_id` column to items table (nullable UUID)
- [ ] Items from same multi-item capture share same batch ID
- [ ] Single-item captures have NULL batch ID

**Inventory Display:**
- [ ] In GalleryGrid, show small badge on shared-photo items
- [ ] Badge: "📷 +2" meaning "2 other items share this photo"
- [ ] Badge position: bottom-right of thumbnail
- [ ] Badge style: semi-transparent black background, white text

**Item Detail Page:**
- [ ] If item has source_batch_id, show info section:
  - "This photo contains multiple items"
  - List linked items as clickable chips
  - Example: "Also in photo: Blue Mug, Red Plate"
- [ ] Position: below main photo, before details

**Files to modify:**
```
supabase/migrations/XXXXX_add_source_batch_id.sql (new)
  - ALTER TABLE items ADD COLUMN source_batch_id UUID;

src/types/database.ts
  - Add source_batch_id to Item interface

src/pages/AddItemPage.tsx
  - Generate batch ID for multi-item saves
  - Pass batch ID to each item creation

src/components/GalleryGrid.tsx
  - Query for shared items count
  - Render badge on thumbnails

src/pages/ItemDetailPage.tsx
  - Query for items with same batch ID
  - Render "Also in photo" section
```

**Test Cases:**
- [ ] Add 3 items from one photo → all have same batch_id
- [ ] Add 1 item → batch_id is NULL
- [ ] View item in Gallery → shows "+2" badge if shared
- [ ] View item detail → shows linked items if shared

---

### US-FIX-006: AI Bounding Box Detection [P3]

**Description:** As a system, I want AI to return bounding box coordinates for each detected item so I can crop individual thumbnails.

**Technical Context:**
- Gemini Vision can return object locations
- Bounding box format: `[x, y, width, height]` as percentages
- Frontend can crop using Canvas API
- More complex implementation, may have accuracy issues

**Acceptance Criteria:**

**AI Prompt Update:**
- [ ] Add to VISION_PROMPT:
  ```
  For each item, also provide approximate bounding box as percentage of image:
  "bbox": [x_percent, y_percent, width_percent, height_percent]
  Example: "bbox": [10, 20, 30, 40] means item starts at 10% from left, 20% from top, spans 30% width and 40% height
  ```
- [ ] Parse bbox from response, validate format
- [ ] Default to full image if bbox missing/invalid

**Frontend Cropping:**
- [ ] Create `cropImageToBbox(imageUrl, bbox)` function
- [ ] Use Canvas API to crop
- [ ] Generate cropped thumbnail (200x200)
- [ ] Upload cropped thumbnail to storage

**Fallback Behavior:**
- [ ] If bbox missing: use full image (current behavior)
- [ ] If bbox invalid (out of bounds): use full image
- [ ] If crop fails: use full image, log warning

**Files to modify:**
```
supabase/functions/analyze-image/index.ts
  - Update VISION_PROMPT with bbox request
  - Parse and validate bbox in response

src/types/api.ts
  - Add bbox field to DetectedItem interface

src/lib/imageUtils.ts
  - Add cropImageToBbox() function
  - Add validateBbox() helper

src/pages/AddItemPage.tsx
  - Process bboxes after AI analysis
  - Generate individual thumbnails
```

**Test Cases:**
- [ ] AI returns valid bbox → cropped thumbnail generated
- [ ] AI returns invalid bbox → falls back to full image
- [ ] AI returns no bbox → falls back to full image
- [ ] Cropped thumbnail displays correctly in Gallery

---

## Issue 4: Color Not Consistently Tagged

**Problem:** AI doesn't always include color as a tag, making it harder to search by color.

**Root Cause:** AI prompt doesn't emphasize color as a required tag.

---

### US-FIX-007: Enforce Color as Primary Tag [P1]

**Description:** As a user, I want items to always have color tagged so I can easily search "blue shirt" or filter by color.

**Technical Context:**
- Current prompt: "Relevant tags (descriptive keywords like color, material...)"
- Color is mentioned but not required
- AI sometimes omits color, especially for neutral items

**Acceptance Criteria:**

**Prompt Update:**
- [ ] Modify VISION_PROMPT to emphasize color:
  ```
  3. Relevant tags - IMPORTANT: The FIRST tag MUST be the dominant color of the item (e.g., "blue", "red", "black", "white", "silver", "brown"). 
     If multiple colors, use the most prominent one.
     Remaining tags: material, condition, size, style, etc.
     Example: "tags": ["navy blue", "cotton", "casual", "medium"]
  ```
- [ ] Add validation: if first tag isn't color-like, log warning

**Color Validation:**
- [ ] Create list of common color words:
  ```typescript
  const COLOR_WORDS = [
    'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink',
    'black', 'white', 'gray', 'grey', 'brown', 'beige', 'tan',
    'navy', 'teal', 'cyan', 'magenta', 'gold', 'silver', 'bronze',
    'cream', 'ivory', 'coral', 'maroon', 'olive', 'turquoise'
  ];
  ```
- [ ] Check if first tag contains a color word
- [ ] If not, add `"color: unknown"` as first tag (or prompt AI retry)

**Response Processing:**
- [ ] In frontend, ensure color tag is always first in display
- [ ] If AI didn't provide color, show placeholder: "Color: Not detected"

**Files to modify:**
```
supabase/functions/analyze-image/index.ts
  - Update VISION_PROMPT with color emphasis
  - Add color validation after parsing response
  - Add COLOR_WORDS constant

src/types/api.ts
  - No changes needed (tags already string[])
```

**Test Cases:**
- [ ] Analyze blue shirt → first tag is "blue" or "navy blue"
- [ ] Analyze black laptop → first tag is "black"
- [ ] Analyze transparent item → first tag is "clear" or "transparent"
- [ ] Search "blue" in Inventory → finds items with blue tag

---

### US-FIX-008: Color Tag UI Highlight [P2]

**Description:** As a user viewing tags, I want color tags to be visually distinct so I can quickly identify item colors.

**Technical Context:**
- Tags currently display as gray chips
- Color tags should stand out visually
- Can show actual color swatch/dot

**Acceptance Criteria:**

**Color Detection Utility:**
- [ ] Create `src/lib/colorUtils.ts`:
  ```typescript
  // Returns hex color if tag is a color word, null otherwise
  function getColorHex(tag: string): string | null;
  
  // Check if tag contains color word
  function isColorTag(tag: string): boolean;
  
  // Color mapping
  const COLOR_MAP: Record<string, string> = {
    'red': '#EF4444',
    'blue': '#3B82F6',
    'green': '#22C55E',
    // ... etc
  };
  ```

**Tag Display:**
- [ ] Color tags show colored dot before text
- [ ] Dot is 8x8px circle with the actual color
- [ ] Color tags have subtle tinted background matching color
- [ ] Color tags appear first in tag list (already from AI)

**Component Updates:**
- [ ] TagChip component: accept `isColor` prop, render dot
- [ ] Apply in: ItemEditor, ItemDetailPage, GalleryGrid, SearchResult

**Accessibility:**
- [ ] Color dot has `aria-label="Color: blue"`
- [ ] Don't rely on color alone (text still shows color name)

**Files to modify:**
```
src/lib/colorUtils.ts (new)
  - COLOR_MAP constant
  - getColorHex() function
  - isColorTag() function

src/components/TagsInput.tsx
  - Import colorUtils
  - Render color dot for color tags

src/components/GalleryGrid.tsx
  - Show color tag with dot in item card

src/pages/ItemDetailPage.tsx
  - Render color-enhanced tags
```

**Test Cases:**
- [ ] Tag "blue" shows blue dot
- [ ] Tag "cotton" shows no dot (not a color)
- [ ] Tag "navy blue" shows navy blue dot
- [ ] Multiple color tags all show appropriate dots

---

## Implementation Priority

| Story | Priority | Effort | Status | Dependencies |
|-------|----------|--------|--------|--------------|
| US-FIX-007 | P1 | 30 min | ✅ Done | None |
| US-FIX-001 | P0 | 2 hrs | ✅ Done | None |
| US-FIX-003 | P1 | 3 hrs | ⬜ Todo | None |
| US-FIX-002 | P1 | 2 hrs | ✅ Done | US-FIX-001 |
| US-FIX-004 | P2 | 1 hr | ✅ Done | US-FIX-003 (shares logic) |
| US-FIX-005 | P2 | 2 hrs | ⬜ Todo | US-FIX-003 (needs batch_id) |
| US-FIX-008 | P2 | 2 hrs | ⬜ Todo | US-FIX-007 |
| US-FIX-006 | P3 | 4 hrs | ⬜ Todo | None |

---

## Execution Order

0. **US-FIX-000** - Configure Vitest testing framework (prerequisite, 1 hr) ⬜
1. **US-FIX-007** - Color tag enforcement (quick win, 30 min) ✅
2. **US-FIX-001** - HEIC error handling (P0 blocker, 2 hrs) ✅
3. **US-FIX-003** - Batch save multi-item (biggest UX win, 3 hrs) ✅
4. **US-FIX-002** - Server-side HEIC fallback (2 hrs) ✅
5. **US-FIX-004** - Quick add single item (1 hr) ✅
6. **US-FIX-005** - Shared photo indicator (2 hrs) ⬜
7. **US-FIX-008** - Color tag UI highlight (2 hrs) ⬜
8. **US-FIX-006** - Bounding box cropping (4 hrs, optional) ⬜

**Total Estimated Time:** ~17.5 hours

---

## Completion Checklist

For each story:
- [ ] Implementation complete
- [ ] TypeScript types updated
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes (unit tests)
- [ ] Unit tests cover core functionality
- [ ] Manual testing on desktop Chrome
- [ ] Manual testing on mobile Safari (iOS)
- [ ] Edge cases handled
- [ ] Error states have user-friendly messages

---

## Notes

- All database changes require migration files
- Deploy Edge Functions with: `supabase functions deploy <name>`
- Test HEIC with actual iOS device (simulator may differ)
- Color detection doesn't need to be perfect (80% accuracy is fine)
