# PRD: Smart Home Inventory App (Ownly)

## Introduction

A Progressive Web App that helps users track and retrieve their household belongings through AI-powered photo recognition. Users can photograph storage boxes, trunks, and containers to automatically catalog items with intelligent tagging, location tracking, and smart search capabilities. The app promotes mindful consumption by providing visibility into existing inventory and offering shopping advice.

## Goals

- Enable effortless item tracking and retrieval without memorizing storage locations
- Reduce time spent searching for belongings by 80%
- Promote smarter consumption through inventory awareness and duplicate detection
- Support decluttering decisions with unused item insights
- Provide AI-powered shopping advice based on existing inventory

## User Stories

### US-001a: User Registration [P0]
**Description:** As a new user, I want to create an account with my email so that I can start using the app.

**Technical Context:** Uses Supabase Auth for authentication. Passwords are securely stored and managed by Supabase.

**Acceptance Criteria:**

**UI Components:**
- [ ] Registration page at route `/signup`
- [ ] Contains: email input, password input, confirm password input, "Create Account" button
- [ ] Page footer: "Already have an account? [Log in]" link to `/login`

**Input Validation (real-time frontend validation):**
- [ ] Email: valid email format, validated on blur, shows "Please enter a valid email address" on error
- [ ] Password: minimum 8 characters, validated on blur, shows "Password must be at least 8 characters" on error
- [ ] Confirm password: must match password, shows "Passwords do not match" on error
- [ ] "Create Account" button disabled (grayed out) until all validations pass

**Registration Flow:**
- [ ] Click "Create Account" → button shows loading spinner, text changes to "Creating..."
- [ ] Calls `supabase.auth.signUp({ email, password })`
- [ ] Success: auto-login, create Profile record, redirect to `/dashboard`
- [ ] New user Dashboard shows empty state card: "📷 Take your first photo to start tracking your items"

**Error Handling:**
- [ ] Email already registered (Supabase returns `User already registered`): red text below email input "This email is already registered" with "Log in" link
- [ ] Network error: red toast at top "Network connection failed. Please check your connection and try again", auto-dismiss after 3s, button re-enabled
- [ ] Other errors: toast "Registration failed. Please try again later"

**Data Changes:**
- [ ] Supabase `auth.users` creates new user record (automatic)
- [ ] `public.profiles` creates new record: `{ user_id, display_name: email prefix, created_at }`
- [ ] `public.user_settings` creates new record with default values

- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-001b: User Login and Logout [P0]
**Description:** As a returning user, I want to log in to access my inventory and log out to secure my account.

**Technical Context:** Uses Supabase Auth. Session managed automatically by Supabase SDK.

**Acceptance Criteria:**

**Login Page UI (route `/login`):**
- [ ] Contains: email input, password input, "Log in" button
- [ ] Below button: "Forgot password?" link → `/reset-password`
- [ ] Page footer: "Don't have an account? [Sign up]" link → `/signup`

**Login Flow:**
- [ ] Click "Log in" → button shows loading state
- [ ] Calls `supabase.auth.signInWithPassword({ email, password })`
- [ ] Success: redirect to `/dashboard` (or original target page if redirected from protected route)
- [ ] Session token automatically stored in localStorage by Supabase SDK

**Login Error Handling:**
- [ ] Email not registered: shows "Email not registered" with "Sign up" link
- [ ] Wrong password: shows "Invalid email or password" (doesn't specify which for security)
- [ ] Network error: toast "Network connection failed. Please try again"

**Logout Flow:**
- [ ] Settings page (`/settings`) shows red text button "Log out" at bottom
- [ ] Click → confirmation dialog: title "Log out", body "Are you sure you want to log out?", buttons [Cancel] [Log out]
- [ ] Confirm → calls `supabase.auth.signOut()` → redirect to `/login` → toast "Logged out successfully"

**Session Management:**
- [ ] On app start: call `supabase.auth.getSession()` to check login status
- [ ] Listen to `onAuthStateChange` event, redirect to login when token expires

- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-001c: Password Reset [P1]
**Description:** As a user who forgot my password, I want to reset it via email so that I can regain access.

**Technical Context:** Uses Supabase Auth built-in password reset. Email sent by Supabase.

**Acceptance Criteria:**

**Request Reset Page (route `/reset-password`):**
- [ ] Contains: email input, "Send Reset Email" button
- [ ] Helper text: "Enter your registered email and we'll send you a password reset link"

**Request Flow:**
- [ ] Click send → loading state → calls `supabase.auth.resetPasswordForEmail(email)`
- [ ] Always shows success page regardless of email existence (security): "Reset email sent to xxx@xxx.com. Please check your inbox."
- [ ] Success page shows: "Didn't receive the email? [Resend]" button with 60-second cooldown countdown

**Reset Password Page (from Supabase email link, route `/reset-password/confirm`):**
- [ ] URL contains token parameter from Supabase
- [ ] Contains: new password input, confirm password input, "Reset Password" button
- [ ] New password must meet requirements (≥8 characters)
- [ ] Success → redirect to `/login` → toast "Password reset successfully. Please log in."
- [ ] Expired/invalid link → shows "This link has expired. Please request a new one." with [Request New Link] button

- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-001d: Route Protection [P0]
**Description:** As a system, I need to protect authenticated routes so that only logged-in users can access the inventory.

**Acceptance Criteria:**

- [ ] Protected routes: `/dashboard`, `/inventory`, `/item/*`, `/settings`, `/add`, `/shopping`
- [ ] Public routes: `/login`, `/signup`, `/reset-password`, `/reset-password/confirm`
- [ ] Unauthenticated user accessing protected route → redirect to `/login?redirect={original_path}`
- [ ] After successful login → check `redirect` URL param → if exists, navigate there; otherwise, go to `/dashboard`
- [ ] Authenticated user accessing `/login` or `/signup` → redirect to `/dashboard`
- [ ] API requests without valid token return 401 → frontend redirects to `/login`

- [ ] Typecheck/lint passes

---

### US-002a: Photo Capture [P0]
**Description:** As a user, I want to take a photo or select from gallery so that I can add items to my inventory.

**Acceptance Criteria:**

**Entry Points:**
- [ ] Bottom navigation "Add" button (center, prominent) navigates to `/add`
- [ ] Dashboard empty state "Take your first photo" button navigates to `/add`
- [ ] Floating action button (FAB) on Inventory page navigates to `/add`

**Add Page UI (route `/add`):**
- [ ] Page title: "Add Item"
- [ ] Two large action cards side by side:
  - 📷 "Take Photo" - opens device camera
  - 🖼️ "Choose from Gallery" - opens device file picker
- [ ] Helper text below: "Take a photo of your item and AI will help identify it"

**Camera Capture:**
- [ ] Clicking "Take Photo" triggers `<input type="file" accept="image/*" capture="environment">`
- [ ] If camera permission denied: show alert "Camera access required. Please enable camera permission in your browser settings." with [Open Settings] button (if supported) or [Use Gallery Instead] button
- [ ] After capture: proceed to preview step

**Gallery Selection:**
- [ ] Clicking "Choose from Gallery" triggers `<input type="file" accept="image/jpeg,image/png,image/heic,image/webp">`
- [ ] After selection: proceed to preview step

**Photo Preview:**
- [ ] Full-screen preview of selected/captured image
- [ ] Bottom actions: [Retake/Reselect] button (left), [Continue] button (right, primary)
- [ ] User can pinch-to-zoom to verify photo clarity
- [ ] If image is blurry (optional detection): show warning "This image may be blurry. Continue anyway?" with [Retake] [Continue Anyway] buttons

**Image Processing (before upload):**
- [ ] Supported formats: JPEG, PNG, HEIC, WebP
- [ ] Unsupported format: show toast "Unsupported image format. Please use JPEG, PNG or HEIC."
- [ ] Max file size: 10MB original, compressed to ≤2MB before upload
- [ ] Min resolution: 200x200 pixels, below this show "Image too small. Please use a clearer photo."
- [ ] HEIC auto-converted to JPEG on client side

**Error Handling:**
- [ ] File picker cancelled: stay on Add page, no error message
- [ ] File read error: toast "Failed to read image. Please try again."

- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-002b: AI Analysis & Results [P0]
**Description:** As a user, I want AI to analyze my photo and identify items so that I don't have to manually enter everything.

**Acceptance Criteria:**

**Upload & Analysis Flow:**
- [ ] User clicks "Continue" from preview → full-screen loading overlay appears
- [ ] Loading UI: centered spinner + text "Analyzing your photo..." + subtle animation
- [ ] Background process: upload image to Supabase Storage → get URL → call AI analysis API
- [ ] Target completion time: ≤5 seconds total

**Loading State Details:**
- [ ] Loading overlay prevents all interaction (modal blocking)
- [ ] After 5 seconds still loading: text changes to "Still analyzing, please wait..."
- [ ] After 15 seconds: show timeout message "Analysis is taking longer than expected." with [Cancel] [Keep Waiting] buttons
- [ ] Cancel: return to preview page, delete uploaded image

**AI Analysis Success - Single Item:**
- [ ] Loading dismisses → show Item Editor (US-002c) pre-filled with AI results
- [ ] AI-suggested fields marked with ✨ icon to indicate "AI suggested"

**AI Analysis Success - Multiple Items Detected:**
- [ ] Loading dismisses → show "Multiple Items Detected" page
- [ ] Display: original photo with numbered bounding boxes (if available) or list of detected items
- [ ] Each detected item shows: suggested name, suggested category, confidence indicator (high/medium/low)
- [ ] User can check/uncheck which items to add (default: all checked)
- [ ] [Add Selected Items] button (count shown: "Add 3 Items")
- [ ] Clicking proceeds to Item Editor for FIRST selected item (others queued)

**AI Analysis Failure:**
- [ ] API error or no items detected: show message "Couldn't identify items in this photo. You can add details manually."
- [ ] [Add Manually] button → proceeds to Item Editor with only photo pre-filled
- [ ] [Try Different Photo] button → return to Add page

**Data Flow:**
- [ ] Image uploaded to Supabase Storage path: `items/{user_id}/{uuid}.jpg`
- [ ] Thumbnail generated: `items/{user_id}/{uuid}_thumb.jpg` (200x200)
- [ ] AI results stored temporarily in component state (not persisted until save)

- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-002c: Item Editor [P0]
**Description:** As a user, I want to review and edit item details so that my inventory is accurate.

**Acceptance Criteria:**

**Editor Page Layout:**
- [ ] Top: item photo thumbnail (tappable to view full size in modal)
- [ ] Below: form fields in logical groups
- [ ] Bottom: sticky [Save Item] button

**Form Fields (in order):**

| Field | Type | Required | AI Pre-filled | Notes |
|-------|------|----------|---------------|-------|
| Name | text input | ❌ | ✅ | Placeholder: "e.g., Blue Coffee Mug", max 200 chars |
| Category | dropdown + create | ❌ | ✅ | Shows AI suggestion first, can change or create new |
| Location | hierarchical picker | ❌ | ❌ | Opens location picker modal |
| Tags | tag input | ❌ | ✅ | Comma-separated, AI suggests 3-5 tags |
| Quantity | number stepper | ✅ | Default: 1 | Min 1, Max 999 |
| Description | textarea | ❌ | ❌ | Placeholder: "Add notes about this item...", max 1000 chars |
| Price | number input | ❌ | ❌ | With currency selector (default CNY), max 99999999.99 |
| Purchase Date | date picker | ❌ | ❌ | Cannot be future date |
| Expiration Date | date picker | ❌ | ❌ | Shows warning if past date selected |
| Brand | text input | ❌ | ✅ | AI may detect from logo/text, max 100 chars |
| Model | text input | ❌ | ❌ | Max 100 chars |

**Category Selection:**
- [ ] Dropdown shows: AI suggestion (if any) at top with ✨, then user's custom categories, then system categories
- [ ] "➕ Create new category" option at bottom of dropdown
- [ ] Creating new category: inline input appears, enter name (max 50 chars) → save → auto-select
- [ ] Empty category name: show validation error "Category name cannot be empty"

**Location Picker Modal:**
- [ ] Tapping Location field opens full-screen modal
- [ ] Modal header: "Select Location" with [✕ Close] button
- [ ] Shows hierarchical tree of user's locations with expand/collapse
- [ ] Each location shows item count badge (e.g., "Kitchen (12)")
- [ ] Can expand/collapse nested locations by tapping chevron
- [ ] [➕ Add New Location] button at bottom to create new inline
- [ ] Adding location: show input field with parent selector dropdown
- [ ] Selecting a location: closes modal, shows full path in field (e.g., "Kitchen → Pantry → Top Shelf")
- [ ] "📍 No location assigned" option at top (item not assigned to any location)

**Tags Input:**
- [ ] AI-suggested tags shown as removable chips with ✕ button
- [ ] User can remove any tag by clicking ✕
- [ ] User can type to add new tags, press Enter or comma to confirm
- [ ] Autocomplete dropdown suggests from user's existing tags (matching typed text)
- [ ] Max 20 tags per item
- [ ] Each tag max 50 characters

**Validation & Warnings:**
- [ ] Form always valid as long as photo exists (all other fields optional)
- [ ] Expiration date in past: show yellow warning below field "⚠️ This item may already be expired"
- [ ] Purchase date in future: show error "Purchase date cannot be in the future"
- [ ] [Save Item] button always enabled

**AI Suggestion Indicators:**
- [ ] Fields pre-filled by AI show small ✨ icon next to label
- [ ] Tooltip on ✨: "Suggested by AI"
- [ ] If user modifies AI-filled field, ✨ icon disappears
- [ ] Helps user understand what was auto-detected vs. manually entered

- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-002d: Save Item [P0]
**Description:** As a user, I want to save the item and receive confirmation so that I know it was added successfully.

**Acceptance Criteria:**

**Save Flow:**
- [ ] User clicks [Save Item] → button shows loading spinner, text changes to "Saving..."
- [ ] Button disabled during save to prevent double-submit
- [ ] API call: create Item record in database with all form data
- [ ] If multiple items were detected and queued: show "Item 1 of 3 saved" and proceed to next item's editor
- [ ] After last/only item saved: show success state

**Success State (single item or last item in queue):**
- [ ] Full-screen success overlay with animation
- [ ] Content: ✅ checkmark animation + "Item Added!" heading
- [ ] Shows item thumbnail and name below heading
- [ ] Action buttons (vertical stack):
  - [Add Another Item] (primary) → return to `/add` page
  - [View Item] (secondary) → navigate to `/item/{id}` detail page
  - [Go to Inventory] (text link) → navigate to `/inventory`
- [ ] Auto-dismiss after 5 seconds if no interaction → navigate to `/inventory`

**Multiple Items Queue Flow:**
- [ ] If user selected 3 items from AI detection:
  1. Save first item → brief success toast (1.5s) "Item 1 saved" → auto-proceed to second item's editor
  2. Progress indicator at top: "Adding item 2 of 3"
  3. Repeat until all items saved
  4. After all saved: show summary screen "🎉 3 items added successfully!" with [View Inventory] button

**Error Handling:**
- [ ] Network/server error: toast "Failed to save item. Please try again." (red background)
- [ ] Button re-enabled after error for retry
- [ ] Automatic retry once before showing error to user
- [ ] If retry also fails: show error with option to [Try Again] or [Save Offline] (saves to localStorage for later sync - stretch goal)

**Data Changes on Success:**
- [ ] `public.items`: new record created with all form data
- [ ] `public.locations.item_count`: incremented by 1 if location assigned (via database trigger)
- [ ] `embedding` field: populated asynchronously via background job (not blocking save)

- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-003: Home Dashboard [P0]
**Description:** As a user, I want to see a dashboard with summary statistics and quick access sections so I can efficiently manage my inventory.

**Acceptance Criteria:**

**Page Structure (route `/dashboard`, also `/` redirects here when logged in):**
- [ ] Bottom navigation "Home" tab links to this page
- [ ] Page layout from top to bottom:
  1. Header with greeting and user avatar
  2. Search bar (sticky on scroll)
  3. Quick stats cards row
  4. "Expiring Soon" section (conditional)
  5. "Recently Added" section
  6. Empty state (for new users only)

**Header:**
- [ ] Greeting text: "Good morning/afternoon/evening, {display_name}" based on local time
- [ ] User avatar (or initials fallback) on right, tappable → navigates to `/settings`
- [ ] Time ranges: Morning 5:00-11:59, Afternoon 12:00-17:59, Evening 18:00-4:59

**Search Bar:**
- [ ] Full-width search input with 🔍 icon left, placeholder "Search items..."
- [ ] Tapping focuses input and navigates to `/search` page (dedicated search page)
- [ ] Microphone icon on right for voice search (shows only if Web Speech API supported)
- [ ] Sticky positioning: stays at top when scrolling down

**Quick Stats Cards (horizontal scrollable row):**
- [ ] Card 1: "📦 Total Items" - shows item count, tap → `/inventory`
- [ ] Card 2: "📍 Locations" - shows location count, tap → `/inventory?view=locations`
- [ ] Card 3: "⚠️ Expiring" - shows count expiring within 30 days, tap → `/inventory?filter=expiring`
- [ ] Card styling: icon + label above + count below, subtle colored background, rounded corners
- [ ] Cards horizontally scrollable if screen narrow

**Expiring Soon Section:**
- [ ] Section header: "⚠️ Expiring Soon" (left) + "See All →" link (right) → `/inventory?filter=expiring`
- [ ] Shows up to 3 items expiring within 7 days, sorted by expiration date ascending
- [ ] Each item card: thumbnail (60x60), name (truncate if long), expiration date, days remaining badge
- [ ] Days remaining badge colors: red (≤3 days), orange (4-7 days)
- [ ] If 0 expiring items: entire section hidden (not shown)
- [ ] Tap item card → `/item/{id}`

**Recently Added Section:**
- [ ] Section header: "🕐 Recently Added" (left) + "See All →" link (right) → `/inventory?sort=newest`
- [ ] Shows up to 5 most recently created items, horizontal scroll
- [ ] Each item card: thumbnail (80x80), name below (truncate 2 lines), category badge, relative time
- [ ] Relative time format: "Just now", "2 hours ago", "Yesterday", "3 days ago"
- [ ] Tap item card → `/item/{id}`

**Empty State (when user has 0 items):**
- [ ] Replaces stats cards and sections entirely
- [ ] Centered content: illustration/icon (📦 or custom graphic)
- [ ] Heading: "Your inventory is empty"
- [ ] Subtext: "Take a photo of your first item to get started"
- [ ] Primary CTA button: [📷 Add Your First Item] → `/add`
- [ ] Search bar still visible above empty state

**Loading State:**
- [ ] Skeleton loaders matching layout of each section
- [ ] Stats cards: 3 gray pulsing rectangles
- [ ] Sections: title skeleton + 3-5 card skeletons
- [ ] Search bar renders immediately (not skeleton)
- [ ] Loading duration target: <1 second

**Error State:**
- [ ] API failure: inline error card "Couldn't load your inventory. Pull down to retry."
- [ ] Error card has retry icon, tappable to retry
- [ ] Does not block entire page if partial data available

**Pull to Refresh:**
- [ ] Pull down gesture anywhere on scrollable area triggers refresh
- [ ] Refresh indicator spinner at top during reload
- [ ] All dashboard data reloaded on refresh
- [ ] Success: data updates silently. Failure: show toast "Refresh failed"

- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-004: Inventory Page [P0]
**Description:** As a user, I want to browse all my items in either gallery or list view so I can quickly find and manage my inventory.

**Acceptance Criteria:**

**Page Structure (route `/inventory`):**
- [ ] Bottom navigation "Inventory" tab links to this page
- [ ] Page layout from top to bottom:
  1. Header with title and action buttons
  2. Filter & Sort bar
  3. View toggle (Gallery/List)
  4. Items grid/list area
  5. Floating Action Button (FAB) for Add

**Header:**
- [ ] Page title: "My Inventory"
- [ ] Right side: Search icon (🔍) → navigates to `/search`
- [ ] Item count subtitle: "{n} items" (updates with active filters)

**Filter & Sort Bar:**
- [ ] Horizontal scrollable row of filter chips
- [ ] Chips: [All Categories ▾] [All Locations ▾] [Sort: Newest ▾]
- [ ] Active filter chip shows filled/highlighted style with selected value
- [ ] Tapping chip opens bottom sheet with options
- [ ] "Clear All" text button appears when any filter is active

**View Toggle:**
- [ ] Toggle button group in header or below filter bar: [Grid icon] [List icon]
- [ ] Default: Gallery (grid) view
- [ ] Active view icon highlighted/filled
- [ ] View preference saved to `user_settings.default_view`, persists across sessions

**Gallery View (Grid):**
- [ ] Responsive grid: 2 columns on mobile (<640px), 3 on tablet (640-1024px), 4+ on desktop (>1024px)
- [ ] Each cell: square thumbnail (aspect-ratio 1:1, object-fit cover)
- [ ] Item name below thumbnail (max 2 lines, ellipsis truncate)
- [ ] Category color dot indicator on thumbnail top-right corner
- [ ] Expiring soon badge (⚠️) overlay if expiring within 7 days
- [ ] Tap cell → navigates to `/item/{id}`

**List View:**
- [ ] Full-width rows, vertically stacked
- [ ] Each row layout:
  - Left: Thumbnail (60x60, rounded corners)
  - Center: Item name (bold, single line truncate), location path below (gray, smaller text)
  - Right: Category badge (colored chip), chevron icon (>)
- [ ] Row height: 72px
- [ ] Subtle divider line between rows
- [ ] Tap row → navigates to `/item/{id}`

**Sorting Options (Sort chip bottom sheet):**
- [ ] "Newest First" (default) - `created_at` DESC
- [ ] "Oldest First" - `created_at` ASC
- [ ] "Name A-Z" - alphabetical ASC
- [ ] "Name Z-A" - alphabetical DESC
- [ ] "Expiring Soon" - `expiration_date` ASC, nulls last
- [ ] "Recently Viewed" - `last_viewed_at` DESC, nulls last
- [ ] Current sort option shows checkmark indicator
- [ ] Selecting option closes sheet and reloads with new sort

**Infinite Scroll Pagination:**
- [ ] Initial load: 20 items
- [ ] Scroll threshold: trigger load when within 200px of bottom
- [ ] Loading indicator: spinner at list bottom while fetching next batch
- [ ] Batch size: 20 items per load
- [ ] End of list: show subtle "You've seen all {n} items" message
- [ ] Scroll position preserved when returning from item detail

**Empty States:**
- [ ] No items at all (new user):
  - Centered illustration (empty box icon)
  - Heading: "No items yet"
  - Subtext: "Start by adding your first item"
  - Button: [📷 Add Your First Item] → `/add`
- [ ] No items matching current filters:
  - Centered icon (filter with X)
  - Text: "No items match your filters"
  - Button: [Clear Filters] → removes all filters, reloads

**Loading State:**
- [ ] Initial page load: skeleton matching current view mode
- [ ] Gallery skeleton: 6 placeholder cards in grid, pulsing animation
- [ ] List skeleton: 5 placeholder rows, pulsing animation
- [ ] Filter bar renders immediately (not skeleton)

**Error State:**
- [ ] Centered error message: "Couldn't load your items"
- [ ] [Try Again] button to retry
- [ ] Pull-to-refresh also triggers retry

**Floating Action Button (FAB):**
- [ ] Fixed position: bottom-right corner, 16px margin from edges, above bottom nav
- [ ] Circular button (56x56), primary color background, white "+" icon
- [ ] Tap → navigates to `/add`
- [ ] Shadow for elevation effect

**Pull to Refresh:**
- [ ] Pull down gesture triggers full reload
- [ ] Refresh spinner at top while loading
- [ ] Resets to page 1 with current filters/sort

- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-005: Filter System [P1]
**Description:** As a user, I want to filter my inventory by location and/or category so I can find specific groups of items.

**Acceptance Criteria:**

**Filter Entry Points (integrates with US-004 Inventory Page):**
- [ ] Location filter chip: [All Locations ▾] on Inventory page filter bar
- [ ] Category filter chip: [All Categories ▾] on Inventory page filter bar
- [ ] Tapping either chip opens respective filter bottom sheet

**Location Filter Bottom Sheet:**
- [ ] Sheet header: "Filter by Location" + [✕] close button (top-right)
- [ ] Search input at top: placeholder "Search locations..." for filtering long lists
- [ ] Location tree display:
  - Top option: "📍 All Locations" (selecting clears location filter)
  - Hierarchical tree of user's locations with expand/collapse chevrons
  - Each location shows item count badge: e.g., "Kitchen (24)"
  - Nested locations indented visually (16px padding per level)
- [ ] Selection behavior:
  - Tap location name → select that location AND all its children
  - Example: Selecting "Kitchen" includes items in "Kitchen", "Kitchen → Pantry", "Kitchen → Pantry → Top Shelf"
  - Checkmark icon (✓) appears on selected location row
  - Only one location (branch) can be selected at a time
- [ ] [Apply Filter] button fixed at bottom → closes sheet, applies filter, reloads inventory
- [ ] Tap outside sheet or [✕] → closes without applying changes

**Category Filter Bottom Sheet:**
- [ ] Sheet header: "Filter by Category" + [✕] close button (top-right)
- [ ] Top option: checkbox "All Categories" (checking clears category filter)
- [ ] List of categories with multi-select checkboxes:
  - System categories first (ordered by `sort_order`)
  - User's custom categories below (alphabetical order)
  - Each row: checkbox + icon + name + item count badge (e.g., "📱 Electronics (15)")
- [ ] Multi-select allowed (OR logic: items matching ANY selected category shown)
- [ ] Selected count indicator near Apply button: "3 selected"
- [ ] [Apply Filter] button fixed at bottom → closes sheet, applies filter
- [ ] Tap outside sheet or [✕] → closes without applying changes

**Combined Filtering Logic:**
- [ ] Location AND Category filters combine with AND logic
- [ ] Example: Location="Kitchen" + Categories=["Food", "Kitchen"] → shows items that are (in Kitchen or its children) AND (have category Food OR Kitchen)
- [ ] Inventory header item count updates to show filtered results: "{n} items"

**Active Filter Visual Indicators:**
- [ ] Inactive chip style: outlined border, gray text
- [ ] Active chip style: filled primary color background, white text, shows selected value
- [ ] Location chip when active: "📍 Kitchen" (truncate with ellipsis if >15 chars)
- [ ] Category chip when active: "🏷️ Food" (single) or "🏷️ 3 categories" (multiple)
- [ ] "Clear All" text link appears in filter bar when any filter is active
- [ ] Tapping "Clear All" → removes all filters, URL params cleared, inventory reloads unfiltered

**URL State Persistence:**
- [ ] Filters encoded in URL query parameters for bookmarking and sharing
- [ ] URL format: `/inventory?location={location_id}&categories={id1,id2,id3}&sort={sort_key}`
- [ ] On page load: read URL params → apply filters → load filtered data
- [ ] On filter change: update URL using `replaceState` (no browser history push)
- [ ] Shared URL opens with same filters applied for recipient

**Edge Cases & Error Handling:**
- [ ] Location deleted while filter active: show toast "Selected location no longer exists", auto-clear location filter, reload
- [ ] Category deleted while filter active: silently remove from filter, keep other selected categories
- [ ] No items match combined filters: show empty state from US-004 "No items match your filters"
- [ ] User has no locations yet: Location filter shows only "All Locations" option with message "Create locations to filter by area"

- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-006: Item Detail View [P0]
**Description:** As a user, I want to view and edit complete details of an item so I can see all information and make updates.

**Acceptance Criteria:**

**Page Structure (route `/item/{id}`):**
- [ ] Accessed by tapping item from Inventory, Dashboard, or Search results
- [ ] Page layout from top to bottom:
  1. Header with back button and action menu
  2. Photo section (hero image)
  3. Expiration alert banner (conditional)
  4. Primary info section (name, category, location, tags)
  5. Details section (collapsible)
  6. Metadata section (dates)
  7. Action buttons (sticky bottom)

**Header:**
- [ ] Left: Back arrow (←) → returns to previous page via browser history
- [ ] Center: "Item Details" title
- [ ] Right: Overflow menu (⋮) with options: [Share], [Add to Favorites], [Mark as Keep Forever]

**Photo Section:**
- [ ] Full-width hero image (aspect ratio preserved, max height 300px on mobile)
- [ ] Tap photo → opens full-screen photo viewer modal
- [ ] Full-screen viewer features: pinch to zoom, swipe down to close, dark overlay background
- [ ] If no photo exists (edge case): show placeholder with 📷 icon and gray background

**Expiration Alert Banner (conditional):**
- [ ] Only shown if `expiration_date` exists
- [ ] Position: below photo, above primary info, full width
- [ ] ≤0 days (expired): Red banner "⚠️ Expired {n} days ago"
- [ ] 1-7 days: Red banner "⚠️ Expires in {n} days" (or "Expires today" if n=0)
- [ ] 8-30 days: Orange/yellow banner "⏰ Expires in {n} days"
- [ ] >30 days: No banner shown
- [ ] Tap banner → smooth scroll to expiration date in details section

**Primary Info Section:**
- [ ] Item name: large bold text (24px font), display full text without truncation
- [ ] If name is null/empty: display "Unnamed Item" in gray italic
- [ ] Category: colored badge chip with category icon, tappable → navigates to `/inventory?categories={id}`
- [ ] Location path: "📍 Kitchen → Pantry → Top Shelf", tappable → navigates to `/inventory?location={id}`
- [ ] If no location assigned: show "📍 No location assigned" in gray text
- [ ] Tags: horizontal scrollable row of small chips (if tags exist), each tappable → search by tag

**Details Section:**
- [ ] Section header: "Details" with expand/collapse chevron (▼/▲), default: expanded
- [ ] Only show fields that have values (hide empty fields entirely):
  - Description: multi-line text block
  - Quantity: "Quantity: {n}" (only shown if quantity > 1)
  - Brand: "Brand: {value}"
  - Model: "Model: {value}"
  - Price: "Price: ¥{value}" (formatted with currency symbol from `currency` field)
  - Purchase Date: "Purchased: {formatted date}" (e.g., "Jan 15, 2024")
  - Expiration Date: "Expires: {formatted date}" with color coding matching banner
  - Notes: multi-line text block
- [ ] Collapse animation: smooth height transition (200ms)

**Metadata Section:**
- [ ] Light gray background strip, smaller text (14px), muted color
- [ ] Line 1: "Added {date} at {time}" (e.g., "Added Jan 10, 2024 at 3:45 PM")
- [ ] Line 2: "Modified {date}" (only if `updated_at` differs from `created_at` by >1 minute)
- [ ] Line 3: "Last viewed {relative time}" (e.g., "Last viewed 2 hours ago")

**Action Buttons (sticky bottom bar):**
- [ ] Fixed position at bottom, above any bottom navigation
- [ ] White background with top shadow/border
- [ ] Two buttons side by side with 12px gap:
  - Left: [✏️ Edit Item] - primary filled style → navigates to `/item/{id}/edit`
  - Right: [🗑️ Delete] - red outline/destructive style → triggers delete flow (US-012)

**Edit Mode (route `/item/{id}/edit`):**
- [ ] Page title: "Edit Item"
- [ ] Reuses form layout from US-002c Item Editor
- [ ] Photo displayed at top but NOT editable (read-only, shows current photo)
- [ ] All other fields pre-filled with current values and editable
- [ ] Bottom buttons: [Cancel] (left, text style) and [Save Changes] (right, primary style)
- [ ] Save success: returns to `/item/{id}`, shows toast "Item updated successfully"
- [ ] Cancel: returns to `/item/{id}` without saving
- [ ] Unsaved changes protection: if user navigates away with unsaved changes, show dialog "You have unsaved changes. Discard?" with [Stay] [Discard] buttons

**Overflow Menu Actions:**
- [ ] "Share": triggers Web Share API with item name, photo, and location text
  - If Web Share API unavailable: fallback to copy item URL to clipboard, show toast "Link copied to clipboard"
- [ ] "Add to Favorites" / "Remove from Favorites": toggles `is_favorite` field
  - Icon changes: outline heart (☆) when not favorite, filled heart (★) when favorite
  - Toast: "Added to favorites" / "Removed from favorites"
- [ ] "Mark as Keep Forever" / "Unmark Keep Forever": toggles `keep_forever` field
  - Toast: "This item won't trigger unused reminders" / "Unused reminders enabled for this item"

**Data Updates on View:**
- [ ] On page load (after successful data fetch): send API request to update `last_viewed_at` to current timestamp
- [ ] This update is fire-and-forget (don't block UI, don't show errors)
- [ ] Enables "unused item reminders" feature to track item engagement

**Loading State:**
- [ ] Show skeleton immediately on navigation:
  - Photo area: gray rectangle placeholder with pulse animation
  - Text areas: 3-4 gray line placeholders with pulse animation
- [ ] Target load time: <500ms

**Error States:**
- [ ] Item not found (404 or deleted): centered message "This item no longer exists" + [Back to Inventory] button
- [ ] Network error: centered message "Couldn't load item details" + [Try Again] button
- [ ] Permission error (accessing other user's item): redirect to `/inventory` with toast "Item not found"

- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-007: Search Page [P0]
**Description:** As a user, I want to search my inventory by text or voice so I can quickly find specific items.

**Acceptance Criteria:**

**Page Structure (route `/search`):**
- [ ] Accessed from: Dashboard search bar tap, Inventory page search icon tap
- [ ] Page layout:
  1. Search input bar (sticky top)
  2. Recent searches section (when input empty)
  3. Search results list (when query entered)
  4. Empty/No results states

**Search Input Bar:**
- [ ] Full-width input field, auto-focused on page load (keyboard opens on mobile)
- [ ] Left: Back arrow (←) → returns to previous page
- [ ] Center: Text input with placeholder "Search items, tags, locations..."
- [ ] Right: Microphone icon (🎤) for voice input (shown only if browser supports Speech Recognition)
- [ ] Far right: Clear button (✕) appears when input has text, tap clears input
- [ ] Input bar sticky at top when scrolling through results

**Text Search Behavior:**
- [ ] Search triggers automatically on input change, debounced 300ms
- [ ] Searches across fields: `name`, `description`, `tags[]`, `category.name`, `location.path`, `brand`
- [ ] Search matching: case-insensitive, partial match (contains)
- [ ] Minimum query length: 1 character triggers search
- [ ] Query preserved in URL: `/search?q={encoded_query}` for bookmarking/sharing
- [ ] Navigating back preserves search state

**Voice Search (conditional feature):**
- [ ] Microphone icon visible only if `window.SpeechRecognition` or `window.webkitSpeechRecognition` exists
- [ ] Tap microphone → check/request microphone permission
- [ ] Permission denied: toast "Microphone access required for voice search" with no further action
- [ ] Permission granted → enter listening state:
  - Microphone icon replaced with pulsing red dot animation
  - Full-screen semi-transparent overlay with "Listening..." text
  - Partial transcription appears in input field in real-time
- [ ] Speech end auto-detected → dismiss overlay, execute search with transcribed text
- [ ] Tap overlay or pulsing indicator → cancel listening, return to normal state
- [ ] No speech detected after 5 seconds: auto-cancel, toast "Didn't catch that. Tap to try again."
- [ ] Recognition error: toast "Voice search unavailable. Please type your search."

**Recent Searches Section (shown when input is empty):**
- [ ] Section header: "Recent Searches" (left) + "Clear All" link (right)
- [ ] Display last 10 unique search queries, newest first
- [ ] Storage: localStorage key `ownly_recent_searches`, JSON array of strings
- [ ] Each row: query text, full width tappable area
- [ ] Tap query → populate input field and execute search
- [ ] Delete single: swipe left reveals red Delete button (mobile), or hover shows ✕ (desktop)
- [ ] "Clear All" tap → confirmation dialog "Clear all recent searches?" → [Cancel] [Clear]
- [ ] Empty state: "Your recent searches will appear here" in gray text

**Search Results Display:**
- [ ] Results header: "{n} results for \"{query}\""  (e.g., "12 results for \"coffee\"")
- [ ] Results as vertical list, each row:
  - Left: Thumbnail (60x60, rounded corners)
  - Center: Item name (bold, single line, matching text highlighted with yellow background)
  - Below name: Location path in gray smaller text (also highlighted if matches)
  - Right: Category badge chip
- [ ] Results sorting: relevance-based (name match weight: 3, tag match: 2, description/location: 1)
- [ ] Pagination: initial load 20 items, infinite scroll loads 20 more
- [ ] Tap result row → navigate to `/item/{id}`

**Search Term Highlighting:**
- [ ] Matching substrings wrapped with yellow background highlight (`<mark>` element)
- [ ] Highlight applied to: item name, location path, visible tags
- [ ] Matching is case-insensitive; highlight preserves original case

**No Results State:**
- [ ] Shown when query returns 0 results
- [ ] Centered layout:
  - Icon: magnifying glass with X or empty state illustration
  - Heading: "No items found"
  - Subtext: "Try different keywords or check your spelling"
- [ ] If filters active: show additional button [Clear Filters and Search Again]

**Loading State:**
- [ ] During search API call: show skeleton list (5 placeholder rows) with pulse animation
- [ ] Search input remains interactive during loading
- [ ] New keystroke while loading → abort previous request, start new search

**Error State:**
- [ ] API error: inline message below input "Search failed. Check your connection and try again." + [Retry] button
- [ ] Retry button re-executes current query

**Data Persistence:**
- [ ] Save to recent searches when: query length ≥2 AND results count ≥1
- [ ] Recent searches max: 10 items, FIFO (oldest removed when adding 11th)
- [ ] Duplicate query moves to top instead of adding duplicate

- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-008: Reminder System & Notifications [P1]
**Description:** As a user, I want to receive reminders about unused items and expiring items so I can make informed decisions about my inventory.

**Acceptance Criteria:**

**Settings Page - Reminders Section (within `/settings`):**
- [ ] Section header: "Reminders & Notifications"
- [ ] Master toggle: "Enable Reminders" (maps to `user_settings.reminder_enabled`, default: true)
- [ ] When enabled, show sub-options indented below:
  - "Unused Item Reminder": dropdown selector [30 days, 60 days, 90 days, 180 days, 1 year]
    - Maps to `user_settings.reminder_threshold_days`
    - Helper text: "Get reminded about items you haven't viewed"
  - "Expiration Reminder": dropdown selector [3 days, 7 days, 14 days, 30 days]
    - Maps to `user_settings.expiration_reminder_days`
    - Helper text: "Get reminded before items expire"
- [ ] Toggle: "Push Notifications" (maps to `user_settings.push_notifications_enabled`, default: false)
- [ ] When Push toggle tapped while OFF → trigger browser notification permission request

**Push Notification Permission Flow:**
- [ ] Permission not yet requested: system shows browser permission dialog
- [ ] Permission denied previously: show inline message "Notifications are blocked. Please enable in your browser settings."
  - [How to Enable] link → opens help modal with browser-specific instructions
- [ ] Permission granted: toggle turns ON, toast "Push notifications enabled"
- [ ] On grant: register service worker push subscription, store endpoint in database

**Notification Generation (Server-side Background Job):**
- [ ] Scheduled job runs daily at 9:00 AM user local time (or configurable)
- [ ] For each user with `reminder_enabled = true`:
  - **Unused items**: Find items where `last_viewed_at < (now - reminder_threshold_days)` AND `keep_forever = false` AND `deleted_at IS NULL`
  - **Expiring items**: Find items where `expiration_date BETWEEN now AND (now + expiration_reminder_days)` AND not already notified (check `Notification` table)
- [ ] Create `Notification` record for each triggered reminder (prevents duplicate notifications)
- [ ] If `push_notifications_enabled = true`: send Web Push notification

**Push Notification Content:**
- [ ] Unused item notification:
  - Title: "Haven't used this lately?"
  - Body: "{item_name} — last viewed {n} days ago"
  - Icon: App icon
  - Click action: opens `/item/{item_id}`
- [ ] Expiring item notification:
  - Title: "Item expiring soon"
  - Body: "{item_name} expires in {n} days"
  - Icon: App icon with warning badge
  - Click action: opens `/item/{item_id}`

**In-App Notification Center:**
- [ ] Entry point: Bell icon (🔔) in app header (Dashboard, Inventory pages)
- [ ] Bell icon shows red badge with unread count (number, or "9+" if >9)
- [ ] Tap bell → navigates to `/notifications`

**Notifications Page (route `/notifications`):**
- [ ] Header: "Notifications" with back button
- [ ] Header right: "Mark All Read" text button (only if unread exist)
- [ ] Notification list, each row contains:
  - Left: Type icon (💤 unused / ⚠️ expiring / ℹ️ system)
  - Center: Title (bold if unread), body preview (1 line truncate), relative time
  - Unread indicator: subtle background highlight or dot
- [ ] Tap notification → mark as read, navigate to `/item/{item_id}`
- [ ] Swipe left on row (mobile): reveals red [Dismiss] button
- [ ] Dismiss: sets `is_read = true`, removes from list (soft hide, not delete)
- [ ] Pull to refresh: reload notifications

**Notification Row Styling:**
- [ ] Unread: white/light background, bold title, blue dot indicator on left
- [ ] Read: gray/muted background, normal weight title, no indicator
- [ ] Type icons: 💤 (unused, blue), ⚠️ (expiring, orange), ℹ️ (system, gray)

**Empty State:**
- [ ] No notifications: centered content
  - Icon: 🔔 with checkmark
  - Text: "You're all caught up!"
  - Subtext: "No new notifications"

**Badge Count Logic:**
- [ ] Count = number of notifications where `is_read = false`
- [ ] Badge updates in real-time when notifications page visited
- [ ] Badge hidden when count = 0

- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-009: AI Shopping Assistant [P2]
**Description:** As a user, I want to photograph potential purchases and get AI advice based on my existing inventory so I can make smarter buying decisions.

**Note:** AI Similarity Detection during item creation is covered in US-002b. This story covers the dedicated Shopping Assistant feature.

**Acceptance Criteria:**

**Entry Point:**
- [ ] Bottom navigation: 4th tab labeled "Shop" with 🛒 icon
- [ ] Route: `/shopping`
- [ ] Alternative: accessible via Dashboard quick action (optional)

**Shopping Assistant Page - Initial State:**
- [ ] Header: "Shopping Assistant" with back button (if not from bottom nav)
- [ ] Centered welcome content:
  - Icon/illustration: shopping bag + AI sparkle (🛒✨)
  - Heading: "Smart Shopping Assistant"
  - Subtext: "Take a photo of something you're thinking of buying. I'll check if you already have something similar."
  - Primary button: [📷 Take Photo]
  - Secondary button: [🖼️ Choose from Gallery]
- [ ] Below: "Recent" section showing last 3 shopping queries (if any)

**Photo Capture Flow:**
- [ ] Tap [Take Photo] → camera capture (same as US-002a)
- [ ] Tap [Choose from Gallery] → file picker (same as US-002a)
- [ ] After photo obtained → transition to chat interface

**Chat Interface Layout:**
- [ ] Scrollable message area (main content)
- [ ] Sticky bottom bar with: text input + camera button + send button
- [ ] Messages stack vertically, newest at bottom

**Message Bubbles:**
- [ ] User messages: right-aligned, primary color (blue) background, white text, rounded corners
- [ ] Assistant messages: left-aligned, light gray background, dark text, rounded corners
- [ ] Photo messages: image thumbnail (max 200px width) inside bubble
- [ ] Timestamps: small gray text below each message group

**AI Analysis Flow:**
- [ ] User photo appears as user message bubble
- [ ] Immediately below: assistant typing indicator (three dots animation)
- [ ] After 2-5 seconds: assistant response bubble appears

**AI Response Structure:**
```
[Assistant bubble]

📸 **Analyzing your photo...**

**What I found:**
[If similar items exist]
• [40px thumbnail] Coffee Mug — 92% match
  📍 Kitchen → Cabinet
• [40px thumbnail] Ceramic Cup — 78% match
  📍 Kitchen → Shelf

**My take:**
You already have 2 similar items. Consider whether you really need another one!

[If no similar items]
**My take:**
I didn't find anything like this in your inventory. Looks like it would be a new addition!
```

**Similar Items in Response:**
- [ ] Show top 3 items with similarity >60%
- [ ] Each item: thumbnail (40x40), name, similarity percentage badge, location
- [ ] Similarity badge colors: green (>90%), yellow (70-90%), gray (60-70%)
- [ ] Tap item row → opens `/item/{id}` in modal overlay (stay in shopping flow)
- [ ] Modal has [✕ Close] to return to chat
- [ ] If 0 similar items: show "No similar items found in your inventory"

**Follow-up Questions:**
- [ ] Text input placeholder: "Ask a follow-up..."
- [ ] Example questions users might ask:
  - "Do I have anything in blue?"
  - "What kitchen items do I have?"
  - "Would this match my existing mugs?"
- [ ] Send button (→) submits question
- [ ] User question appears as user bubble, AI responds with relevant info

**Adding Another Photo:**
- [ ] Camera icon (📷) in input bar
- [ ] Tap → capture/select new photo
- [ ] New photo appears in chat: "Let me check this one..."
- [ ] AI analyzes new photo with conversation context

**Conversation Behavior:**
- [ ] Chat history maintained during session
- [ ] Leaving page clears conversation (not persisted to database)
- [ ] "New Chat" button in header → clears conversation, returns to initial state

**Loading States:**
- [ ] Photo uploading: "Uploading photo..." text with spinner in chat
- [ ] AI analyzing: typing indicator (•••) animation, 2-5 seconds typical
- [ ] Follow-up processing: typing indicator, 1-2 seconds typical

**Error Handling:**
- [ ] Photo upload failed: assistant message "I couldn't upload that photo. Please try again." + [Retry] button
- [ ] AI API error: assistant message "Sorry, I'm having trouble analyzing this. Please try again." + [Retry] button
- [ ] Network offline: toast "You're offline. Please check your connection."

**Usage Limits (Cost Management):**
- [ ] Track daily API usage per user in database
- [ ] Soft limit: 20 photo analyses per day
- [ ] At 15 uses: show subtle warning "5 analyses remaining today"
- [ ] At 20 uses: show message "You've reached today's limit. Try again tomorrow!"
- [ ] Follow-up text questions: limit 50 per day (less expensive)
- [ ] Limits reset at midnight UTC

- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-010: Delete Item [P0]
**Description:** As a user, I want to delete items from my inventory so I can keep it accurate and remove things I no longer have.

**Acceptance Criteria:**

**Delete Entry Points:**
- [ ] Item Detail page (`/item/{id}`): [🗑️ Delete] button in bottom action bar
- [ ] Item Detail page: Overflow menu (⋮) → "Delete Item" option

**Delete Confirmation Dialog:**
- [ ] Triggered by any delete action
- [ ] Modal dialog with semi-transparent backdrop overlay
- [ ] Dialog content (centered card):
  - Item thumbnail (60x60) at top
  - Heading: "Delete this item?"
  - Item name displayed below heading
  - Body text: "This will be permanently deleted after 30 days."
  - Button row: [Cancel] (left, outlined/text style) and [Delete] (right, red filled)
- [ ] Tap backdrop → dismiss dialog, no action taken
- [ ] Tap Cancel → dismiss dialog, no action taken
- [ ] Tap Delete → execute soft delete

**Soft Delete Execution:**
- [ ] API call: set `deleted_at = NOW()` on item record
- [ ] Item immediately hidden from: Inventory, Search results, Dashboard sections
- [ ] Database trigger: decrement `locations.item_count` for item's location
- [ ] On API success:
  - Dismiss confirmation dialog
  - Navigate back to previous page (typically `/inventory`)
  - Show toast notification at bottom

**Undo Toast:**
- [ ] Toast content: "Item deleted" (left) + [Undo] button (right)
- [ ] Toast visible for 5 seconds with countdown indicator
- [ ] Tap [Undo] within 5 seconds:
  - API call: set `deleted_at = NULL` on item record
  - Restore `locations.item_count`
  - Toast changes to: "Item restored" (no undo button)
  - Navigate to `/item/{id}` to show restored item
- [ ] Toast auto-dismisses after 5 seconds if no interaction
- [ ] After dismissal: undo no longer available via UI

**Permanent Deletion (Background Job):**
- [ ] Scheduled job runs daily
- [ ] Find items where `deleted_at < NOW() - INTERVAL '30 days'`
- [ ] Hard delete: remove item record from database
- [ ] Delete associated files from Supabase Storage (photo, thumbnail)
- [ ] No user notification for permanent deletion

**Error Handling:**
- [ ] Delete API fails: toast "Couldn't delete item. Please try again." (red background)
- [ ] Confirmation dialog remains open for retry
- [ ] Undo API fails: toast "Couldn't restore item." (red background)
- [ ] Network offline: toast "You're offline. Please try again when connected."

- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-011: PWA Installation [P1]
**Description:** As a user, I want to install the app on my device so I can access it like a native app with quick launch and home screen icon.

**Acceptance Criteria:**

**Web App Manifest Configuration (`/manifest.json`):**
```json
{
  "name": "Ownly - Smart Home Inventory",
  "short_name": "Ownly",
  "description": "Track and find your belongings with AI-powered inventory management",
  "start_url": "/?source=pwa",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#3B82F6",
  "background_color": "#FFFFFF",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "categories": ["lifestyle", "utilities"]
}
```
- [ ] Manifest file served at `/manifest.json`
- [ ] HTML includes: `<link rel="manifest" href="/manifest.json">`
- [ ] All icon files exist and are properly sized

**Service Worker (`/sw.js`):**
- [ ] Registered on initial app load via `navigator.serviceWorker.register()`
- [ ] Caching strategies:
  - App shell (HTML, CSS, JS bundles): cache on install, serve cache-first
  - API responses: network-first, fallback to cache if offline
  - Images and static assets: cache-first with network fallback
- [ ] Cache versioning: cache name includes version number for updates
- [ ] Update detection: check for SW updates on page focus
- [ ] Update available: show toast "App update available" with [Refresh] button

**Install Prompt - Android/Chrome:**
- [ ] Capture `beforeinstallprompt` event on window, store event reference
- [ ] Defer native prompt (call `event.preventDefault()`)
- [ ] Show custom install banner when ALL conditions met:
  - `beforeinstallprompt` event was captured
  - User has viewed ≥2 different pages
  - User has spent ≥30 seconds in app
  - User hasn't dismissed prompt in last 7 days (check localStorage)
  - App not already installed (not in standalone mode)
- [ ] Custom banner UI (fixed bottom, above nav):
  - App icon (32x32) + "Add Ownly to Home Screen" text
  - Subtext: "Quick access anytime, even offline"
  - [Not Now] text button (left) + [Install] primary button (right)
- [ ] [Install] tap → call stored `event.prompt()`, track outcome
- [ ] [Not Now] tap → hide banner, set localStorage `install_dismissed_at` timestamp
- [ ] After successful install: hide all install UI, show toast "App installed!"

**Install Prompt - Desktop Chrome:**
- [ ] Show install button (⊕ icon) in app header when `beforeinstallprompt` available
- [ ] Tooltip on hover: "Install Ownly app"
- [ ] Click → trigger install prompt
- [ ] Hide button after install or if prompt not available

**Install Instructions - iOS Safari:**
- [ ] Detect iOS Safari: check user agent for iPhone/iPad + Safari
- [ ] iOS doesn't support `beforeinstallprompt`
- [ ] Show instructional banner for iOS users (same trigger conditions):
  - "Install this app: tap [Share icon ⬆️] then 'Add to Home Screen'"
  - [Got It] button to dismiss
- [ ] Dismissing sets localStorage flag, don't show again for 30 days

**Standalone Mode Detection:**
- [ ] Check: `window.matchMedia('(display-mode: standalone)').matches`
- [ ] Or check: `navigator.standalone === true` (iOS)
- [ ] When in standalone mode:
  - Hide all install prompts and banners
  - Adjust UI padding for notch/safe areas if needed
  - Track analytics: `source=pwa` from start_url

**Offline Experience:**
- [ ] Listen to `online` and `offline` events on window
- [ ] Check `navigator.onLine` on page load
- [ ] When offline detected:
  - Show persistent banner at top: "You're offline" (gray background)
  - Cached content remains viewable (inventory list, item details if cached)
  - Actions requiring network show: toast "This requires an internet connection"
- [ ] When back online:
  - Hide offline banner
  - Auto-retry any queued/failed operations (future enhancement)

- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

## Functional Requirements

### Priority Legend
- **[P0]** Must Have - Core MVP functionality, blocks launch if missing
- **[P1]** Should Have - Important features, MVP can launch without but should add soon
- **[P2]** Nice to Have - Enhancements for future iterations

---

### Authentication & Security
- FR-1 [P0]: System must support email/password registration via Supabase Auth
- FR-2 [P0]: System must support email/password login with session management
- FR-3 [P1]: System must support password reset via email link
- FR-4 [P0]: System must protect routes, redirecting unauthenticated users to login
- FR-5 [P0]: System must isolate user data via Row Level Security (RLS)

### Photo & Image Management
- FR-6 [P0]: System must accept photo capture via device camera (`capture="environment"`)
- FR-7 [P0]: System must accept image upload from device gallery (JPEG, PNG, HEIC, WebP)
- FR-8 [P0]: System must compress images to max 2MB before upload
- FR-9 [P0]: System must reject images below 200x200 pixels
- FR-10 [P0]: System must auto-convert HEIC to JPEG on client side
- FR-11 [P0]: System must store images in Supabase Storage (`items/{user_id}/{uuid}.jpg`)
- FR-12 [P0]: System must auto-generate thumbnails (200x200) for list views

### AI Analysis & Recognition
- FR-13 [P0]: System must send images to OpenAI Vision API (GPT-4o) for analysis
- FR-14 [P0]: System must extract item name, category suggestion, and tags from AI response
- FR-15 [P0]: System must support multi-item detection in single photo
- FR-16 [P0]: System must allow user to select which detected items to add
- FR-17 [P0]: System must handle AI analysis timeout (>15 seconds) gracefully
- FR-18 [P0]: System must generate image embeddings via OpenAI Embeddings API (1536 dimensions)
- FR-19 [P2]: System must calculate similarity scores between item embeddings for shopping assistant

### Item Management
- FR-20 [P0]: System must create items with only `photo_url` as required field
- FR-21 [P0]: System must support item fields: name, description, category, tags, location, quantity, price, purchase_date, expiration_date, brand, model
- FR-22 [P0]: System must support soft delete with 30-day retention before permanent deletion
- FR-23 [P0]: System must provide undo functionality within 5 seconds of deletion
- FR-24 [P0]: System must update `last_viewed_at` when user opens item detail page
- FR-25 [P0]: System must support item editing (all fields except photo)
- FR-26 [P1]: System must support `is_favorite` and `keep_forever` flags

### Category System
- FR-27 [P0]: System must provide 10 system preset categories (Clothing, Food, Electronics, etc.)
- FR-28 [P0]: System must allow users to create custom categories (name, icon, color)
- FR-29 [P0]: System must suggest AI-detected category with ability to change or create new
- FR-30 [P0]: System must indicate AI-suggested values with ✨ icon

### Location System
- FR-31 [P0]: System must support unlimited nesting hierarchy for locations (via `parent_id`)
- FR-32 [P0]: System must auto-calculate full path string (e.g., "Kitchen → Pantry → Top Shelf")
- FR-33 [P0]: System must maintain `item_count` per location via database trigger
- FR-34 [P0]: System must block location deletion if it contains items or child locations
- FR-35 [P0]: System must support soft delete for locations

### Dashboard
- FR-36 [P0]: System must display time-based greeting (Good morning/afternoon/evening)
- FR-37 [P0]: System must display quick stats: Total Items, Locations count, Expiring count
- FR-38 [P0]: System must display "Expiring Soon" section (items expiring within 7 days)
- FR-39 [P0]: System must display "Recently Added" section (last 5 items)
- FR-40 [P0]: System must display empty state with CTA for new users

### Inventory Browsing
- FR-41 [P0]: System must support Gallery view (responsive grid: 2/3/4+ columns)
- FR-42 [P0]: System must support List view (thumbnail + name + location + category)
- FR-43 [P0]: System must persist view preference to `user_settings.default_view`
- FR-44 [P0]: System must support infinite scroll pagination (20 items per load)
- FR-45 [P0]: System must support sorting: newest, oldest, A-Z, Z-A, expiring soon, recently viewed

### Filtering
- FR-46 [P1]: System must support filtering by location (single-select, includes children)
- FR-47 [P1]: System must support filtering by category (multi-select, OR logic)
- FR-48 [P1]: System must combine filters with AND logic (location AND categories)
- FR-49 [P1]: System must persist filter state in URL query parameters
- FR-50 [P1]: System must provide "Clear All" to reset filters

### Search
- FR-51 [P0]: System must support text search across name, description, tags, category, location, brand
- FR-52 [P0]: System must debounce search input (300ms)
- FR-53 [P0]: System must highlight matching text in search results
- FR-54 [P0]: System must store and display recent searches (max 10, localStorage)
- FR-55 [P1]: System must support voice search via Web Speech API (where supported)

### Notifications & Reminders
- FR-56 [P1]: System must support user-configurable reminder settings (enable/disable, thresholds)
- FR-57 [P1]: System must generate unused item reminders based on `last_viewed_at` threshold
- FR-58 [P1]: System must generate expiration reminders based on configurable days-before
- FR-59 [P1]: System must support Web Push notifications (with permission)
- FR-60 [P1]: System must provide in-app notification center with unread badge count
- FR-61 [P1]: System must exclude items with `keep_forever=true` from unused reminders

### AI Shopping Assistant
- FR-62 [P2]: System must provide chat interface for shopping assistance
- FR-63 [P2]: System must analyze photos of potential purchases against existing inventory
- FR-64 [P2]: System must display similar items with similarity percentage (>60% threshold)
- FR-65 [P2]: System must support follow-up text questions in chat
- FR-66 [P2]: System must enforce daily usage limits (20 photo analyses, 50 text questions)

### PWA & Offline
- FR-67 [P1]: System must provide valid web app manifest for installability
- FR-68 [P1]: System must register service worker for caching
- FR-69 [P1]: System must show custom install prompt (Android/Chrome) after engagement criteria met
- FR-70 [P1]: System must show install instructions for iOS Safari users
- FR-71 [P1]: System must detect and display offline status banner
- FR-72 [P1]: System must serve cached content when offline

### Performance
- FR-73 [P0]: Initial page load must complete in <3 seconds on 3G
- FR-74 [P0]: AI analysis must complete in <5 seconds (with timeout handling at 15s)
- FR-75 [P0]: Search results must return in <300ms
- FR-76 [P0]: Image upload feedback must appear within 1 second

## Non-Goals (Out of Scope for MVP)

- Native iOS/Android apps (PWA only for MVP)
- Multi-user/household sharing
- Integration with purchase history or shopping apps
- Barcode/QR code scanning
- Offline-first functionality (cloud-only for MVP)
- Item lending/borrowing tracking
- Automatic receipt scanning
- Integration with smart home devices
- Export/import functionality
- Item valuation or insurance tracking
- Social features (sharing inventory)

## Design Considerations

### UI/UX Requirements
- Mobile-first responsive design
- Bottom navigation bar: Home, Add, Inventory, Settings
- Clean, minimal interface with focus on photos
- Large touch targets for mobile use
- Dark mode support (optional for MVP)

### Accessibility
- WCAG 2.1 AA compliance
- Alt text for all images
- Keyboard navigable
- Screen reader compatible

### Visual Hierarchy
- Item photos as primary visual element
- Location breadcrumbs for context
- Color-coded categories
- Visual badges for expiring items

## Data Model

### Design Principles

| Principle | Description |
|-----------|-------------|
| **Supabase Auth Integration** | User authentication managed by Supabase Auth, `auth.users` as user master table |
| **Row Level Security (RLS)** | All tables enable RLS, users can only access their own data |
| **Soft Delete** | Important data uses `deleted_at` for soft delete, supports recovery |
| **Timestamps** | All tables include `created_at` and `updated_at` |

---

### Entity: Profile

> Extends Supabase Auth user information, stores app-specific user data.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | uuid | ✅ | `gen_random_uuid()` | Primary key |
| `user_id` | uuid | ✅ | - | References `auth.users.id`, unique |
| `display_name` | varchar(50) | ❌ | email prefix | Display name |
| `avatar_url` | text | ❌ | null | Avatar URL |
| `created_at` | timestamptz | ✅ | `now()` | Created timestamp |
| `updated_at` | timestamptz | ✅ | `now()` | Updated timestamp |

**Business Rules:**
- Profile record created automatically on user registration
- `display_name` defaults to the portion of email before `@`

---

### Entity: UserSettings

> Stores user personalization settings.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | uuid | ✅ | `gen_random_uuid()` | Primary key |
| `user_id` | uuid | ✅ | - | References `auth.users.id`, unique |
| `reminder_enabled` | boolean | ✅ | `true` | Enable reminders |
| `reminder_threshold_days` | integer | ✅ | `90` | Unused item reminder threshold (days) |
| `expiration_reminder_days` | integer | ✅ | `7` | Days before expiration to remind |
| `push_notifications_enabled` | boolean | ✅ | `false` | Enable push notifications |
| `default_view` | varchar(20) | ✅ | `'gallery'` | Default view: `gallery` or `list` |
| `created_at` | timestamptz | ✅ | `now()` | Created timestamp |
| `updated_at` | timestamptz | ✅ | `now()` | Updated timestamp |

**Business Rules:**
- Created automatically on user registration with default values
- `reminder_threshold_days` allowed values: 30, 60, 90, 180, 365

---

### Entity: Category

> Item categories, includes system presets and user-defined.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | uuid | ✅ | `gen_random_uuid()` | Primary key |
| `user_id` | uuid | ❌ | null | Owner user, null = system preset |
| `name` | varchar(50) | ✅ | - | Category name |
| `icon` | varchar(10) | ❌ | `'📦'` | Category icon (emoji) |
| `color` | varchar(7) | ❌ | `'#6B7280'` | Category color (HEX) |
| `is_system` | boolean | ✅ | `false` | Is system preset |
| `sort_order` | integer | ✅ | `0` | Sort order |
| `created_at` | timestamptz | ✅ | `now()` | Created timestamp |

**System Preset Categories (is_system = true, user_id = null):**

| name | icon | color | sort_order |
|------|------|-------|------------|
| Clothing | 👕 | #8B5CF6 | 1 |
| Food & Beverage | 🍎 | #EF4444 | 2 |
| Electronics | 📱 | #3B82F6 | 3 |
| Kitchen | 🍳 | #F59E0B | 4 |
| Sports & Fitness | ⚽ | #10B981 | 5 |
| Tools | 🔧 | #6B7280 | 6 |
| Books & Documents | 📚 | #8B4513 | 7 |
| Personal Care | 💄 | #EC4899 | 8 |
| Home Decor | 🏠 | #14B8A6 | 9 |
| Other | 📦 | #9CA3AF | 99 |

**Business Rules:**
- System categories visible to all users, cannot be deleted/modified
- User-defined categories visible only to owner
- Category name unique per user
- AI suggests matching existing categories first; suggests creating new if no match

---

### Entity: Location

> Storage locations, supports unlimited nesting hierarchy.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | uuid | ✅ | `gen_random_uuid()` | Primary key |
| `user_id` | uuid | ✅ | - | Owner user |
| `name` | varchar(100) | ✅ | - | Location name |
| `parent_id` | uuid | ❌ | null | Parent location, null = top level |
| `path` | text | ✅ | - | Full path, e.g., `"Living Room/TV Cabinet/Shelf 2"` |
| `depth` | integer | ✅ | `1` | Hierarchy depth, top level = 1 |
| `icon` | varchar(10) | ❌ | `'📍'` | Location icon (emoji) |
| `photo_url` | text | ❌ | null | Location photo (optional) |
| `item_count` | integer | ✅ | `0` | Item count (cached field) |
| `created_at` | timestamptz | ✅ | `now()` | Created timestamp |
| `updated_at` | timestamptz | ✅ | `now()` | Updated timestamp |
| `deleted_at` | timestamptz | ❌ | null | Soft delete timestamp |

**Business Rules:**
- Top-level locations (`parent_id = null`) typically represent rooms: "Bedroom", "Kitchen"
- `path` field auto-calculated on create/move, used for display and search
- On delete (soft delete):
  - If has child locations: block deletion, show "Please delete or move child locations first"
  - If has items: block deletion, show "Please move the N items in this location first"
- `item_count` maintained automatically via database trigger
- Soft delete: `deleted_at` not null means deleted, default queries exclude deleted

**Common Location Templates (optional import on first use):**
```
Living Room, Bedroom, Kitchen, Bathroom, Balcony, Study, Storage Room, Garage
```

---

### Entity: Item

> Core entity, stores user's item information.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | uuid | ✅ | `gen_random_uuid()` | Primary key |
| `user_id` | uuid | ✅ | - | Owner user |
| `photo_url` | text | ✅ | - | Item photo URL |
| `thumbnail_url` | text | ❌ | null | Thumbnail URL (auto-generated) |
| `name` | varchar(200) | ❌ | null | Item name (AI-generated or user input) |
| `description` | text | ❌ | null | Item description |
| `category_id` | uuid | ❌ | null | Category ID |
| `tags` | text[] | ❌ | `'{}'` | Tags array |
| `location_id` | uuid | ❌ | null | Storage location ID |
| `quantity` | integer | ✅ | `1` | Quantity |
| `price` | decimal(10,2) | ❌ | null | Price/value |
| `currency` | varchar(3) | ✅ | `'CNY'` | Currency code |
| `purchase_date` | date | ❌ | null | Purchase date |
| `expiration_date` | date | ❌ | null | Expiration date |
| `brand` | varchar(100) | ❌ | null | Brand |
| `model` | varchar(100) | ❌ | null | Model |
| `notes` | text | ❌ | null | Notes |
| `is_favorite` | boolean | ✅ | `false` | Is favorited |
| `keep_forever` | boolean | ✅ | `false` | Keep forever (excludes from unused reminders) |
| `embedding` | vector(1536) | ❌ | null | Image vector (for similarity detection) |
| `ai_metadata` | jsonb | ❌ | null | AI analysis raw result |
| `last_viewed_at` | timestamptz | ❌ | null | Last viewed timestamp |
| `created_at` | timestamptz | ✅ | `now()` | Created timestamp |
| `updated_at` | timestamptz | ✅ | `now()` | Updated timestamp |
| `deleted_at` | timestamptz | ❌ | null | Soft delete timestamp |

**Business Rules:**
- **Only `photo_url` is required**, other fields auto-filled by AI or manually input by user
- If `name` is empty after AI analysis, defaults to "Unnamed Item"
- `thumbnail_url` auto-generated by backend after image upload (200x200)
- `last_viewed_at` updated when user opens item detail page
- Soft delete: `deleted_at` not null means deleted, default queries exclude deleted
- `embedding` uses OpenAI text-embedding-3-small (1536 dimensions)

**ai_metadata Structure Example:**
```json
{
  "provider": "openai",
  "model": "gpt-4o",
  "analyzed_at": "2024-01-15T10:30:00Z",
  "confidence": 0.92,
  "detected_objects": [
    { "name": "coffee mug", "confidence": 0.95 },
    { "name": "ceramic cup", "confidence": 0.88 }
  ],
  "suggested_category": "Kitchen",
  "suggested_tags": ["mug", "coffee", "ceramic"],
  "detected_text": ["Starbucks", "2023"],
  "detected_brand": "Starbucks"
}
```

---

### Entity: Notification

> Stores notification records sent to users.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | uuid | ✅ | `gen_random_uuid()` | Primary key |
| `user_id` | uuid | ✅ | - | Owner user |
| `type` | varchar(30) | ✅ | - | Type: `unused_item`, `expiring_item`, `system` |
| `title` | varchar(200) | ✅ | - | Notification title |
| `body` | text | ✅ | - | Notification content |
| `item_id` | uuid | ❌ | null | Related item (if applicable) |
| `is_read` | boolean | ✅ | `false` | Is read |
| `is_pushed` | boolean | ✅ | `false` | Is pushed |
| `pushed_at` | timestamptz | ❌ | null | Push timestamp |
| `created_at` | timestamptz | ✅ | `now()` | Created timestamp |

---

### Entity Relationship Diagram

```
auth.users (Supabase managed)
    │
    ├── 1:1 ── Profile
    ├── 1:1 ── UserSettings
    ├── 1:N ── Location (parent_id self-reference for unlimited nesting)
    ├── 1:N ── Category (user-defined categories)
    ├── 1:N ── Item
    │            ├── N:1 ── Category
    │            └── N:1 ── Location
    └── 1:N ── Notification
                 └── N:1 ── Item (optional)
```

---

## Technical Considerations

### Frontend Stack
- React 18+ with TypeScript
- Tailwind CSS for styling
- React Query for server state
- React Router for navigation
- PWA with Workbox

### Backend Stack
- Supabase (PostgreSQL + Auth + Storage + Realtime)
- Edge Functions for AI API calls
- Row Level Security for data isolation

### AI Integration
- OpenAI Vision API (GPT-4V) for image analysis
- OpenAI Embeddings API for similarity vectors
- Vector storage in Supabase (pgvector extension)

### Performance Requirements
- Initial load < 3 seconds on 3G
- Image upload feedback within 1 second
- AI analysis complete within 5 seconds
- Search results within 300ms

### Database Schema (Simplified)
```
users (managed by Supabase Auth)

locations
- id, user_id, name, parent_id, created_at

items
- id, user_id, name, description, photo_url
- category, tags[], location_id
- price, expiration_date
- embedding (vector)
- created_at, updated_at, last_viewed_at

user_settings
- id, user_id, reminder_threshold_days
- push_notifications_enabled
```

## Success Metrics

- Users can add an item (photo → saved) in under 60 seconds
- 90% of AI-suggested tags accepted without modification
- Users find items via search in under 10 seconds
- Duplicate detection catches 80% of similar items
- 70% of users enable push notifications
- PWA installation rate > 30% of active users

## Open Questions

1. Should we implement bulk photo upload for initial inventory setup?
2. What's the maximum number of items per user account for free tier?
3. Should AI shopping assistant have usage limits (API cost management)?
4. Do we need item quantity tracking (e.g., "5 cans of beans")?
5. Should locations support photos (e.g., photo of the storage box itself)?
6. What happens to items when a location is deleted? Orphan or cascade?
