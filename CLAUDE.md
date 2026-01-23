# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Ownly** is a Progressive Web App (PWA) for smart home inventory management. Users can track household belongings through AI-powered photo recognition with intelligent tagging, location tracking, and semantic search.

**Tech Stack:**
- React 19.2 + TypeScript + Vite
- Tailwind CSS 4.x (with `@tailwindcss/vite` plugin)
- React Router v6 for navigation
- TanStack React Query for server state
- Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- PWA with vite-plugin-pwa
- heic2any for iOS photo format conversion

## Development Commands

```bash
# Development server (http://localhost:5173)
npm run dev

# Production build (includes TypeScript check)
npm run build

# Type check only
tsc -b

# Lint
npm run lint

# Preview production build
npm run preview
```

## Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
# Required - Get from Supabase project settings
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Optional - For Web Push notifications
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key
```

**Important:** Run `npm run build` before committing to ensure type safety.

## Architecture

### Project Structure

```
src/
├── components/        # Reusable UI components
│   ├── layout/       # AppShell, BottomNav
│   └── *.tsx         # Feature components (ItemEditor, Toast, etc.)
├── contexts/         # React contexts (Auth, Offline, Toast)
├── hooks/            # Custom React hooks (data fetching, features)
├── lib/              # Utilities (supabase client, imageUtils)
├── pages/            # Route components
├── types/            # TypeScript definitions
└── App.tsx           # Root component with routing
```

### Path Aliases

Use `@/` prefix for all imports from `src/`:
```ts
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
```

### Database Schema (Key Tables)

- **profiles** - User profile extending auth.users
- **user_settings** - Reminder/notification preferences
- **categories** - System (preset) and user-defined categories
- **locations** - Hierarchical storage locations with parent_id
- **items** - Core inventory items with soft-delete (deleted_at)
- **notifications** - Reminder notifications
- **push_subscriptions** - Web Push endpoints

**Important patterns:**
- All user-specific tables have `user_id` FK with RLS enabled
- Soft-delete pattern: `deleted_at` timestamp instead of hard deletes
- Location hierarchy: uses `parent_id` self-reference with `path` and `depth` columns
- Items support vector embeddings (pgvector) for semantic search

### Type System

All database types are defined in `src/types/database.ts` with a `Database` type for Supabase client:

```ts
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

// Typed Supabase queries
const { data } = await supabase
  .from('items')
  .select<'id, name', Database['public']['Tables']['items']['Row']>()
```

API request/response types are in `src/types/api.ts`.

### Context Architecture

Four main contexts (exported from `src/contexts/`):

1. **AuthContext** - User authentication state
2. **OfflineContext** - Network status detection
3. **ToastContext** - Toast notifications (replaces old Toast component usage)
4. **ConfirmContext** - Confirmation dialog management

**Pattern:** Context providers wrap the app in `App.tsx` in this order:
```
QueryClientProvider > ToastProvider > ConfirmProvider > OfflineProvider > AuthProvider > BrowserRouter
```

### Routing Structure

**Public routes** (no AppShell):
- `/` - Landing page (marketing/intro)
- `/login`, `/signup`, `/reset-password`, `/reset-password/confirm`

**Protected routes** (with AppShell + bottom nav):
- `/dashboard` - Home dashboard
- `/add` - Add new item (photo capture)
- `/add/edit` - Item editor after photo capture
- `/inventory` - Browse all items
- `/item/:id` - Item detail
- `/item/:id/edit` - Edit item
- `/search` - Search items
- `/settings` - User settings
- `/notifications` - Notification center
- `/shopping` - AI shopping assistant

### Component Patterns

**AppShell** - Main layout wrapper providing:
- Optional header area (sticky)
- Main content with bottom padding
- Fixed bottom navigation (56px/h-14)
- Install banners (Android/iOS)
- Offline status banner

**ItemEditor** - Large reusable component (~1400 lines) for creating/editing items. Handles:
- Photo preview (read-only after capture)
- All item fields (name, quantity, category, location, tags, dates, price, etc.)
- Category selector with create-new option
- Location picker modal
- Tags input with autocomplete
- AI-suggested field indicators (sparkle icon)

**Bottom Sheets** - Used for filters and pickers:
- `BottomSheet` - Base reusable bottom sheet component
- `CategoryFilterBottomSheet` - Multi-select category filter
- `LocationFilterBottomSheet` - Hierarchical location filter
- `SortBottomSheet` - Sort options
- `LocationPickerModal` - Select item location

**Other UI Components:**
- `ConfirmDialog` - Confirmation dialog (via ConfirmProvider)
- `Skeleton` - Loading skeleton placeholders
- `SearchResult` - Search result item display
- `NotificationBell` - Notification indicator with badge
- `PullToRefreshIndicator` - Pull-to-refresh visual feedback
- `GalleryGrid` - Gallery view for items
- `ItemList` - List view for items
- `MultiItemSelection` - Batch selection toolbar

### Data Fetching Patterns

**React Query** for server state (configured in `App.tsx`)

Custom hooks in `src/hooks/` follow this pattern:
```ts
export function useInventoryItems(options: UseInventoryItemsOptions = {}) {
  const { user } = useAuth()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  // ... fetch, refresh, loadMore states
  return { items, isLoading, isRefreshing, refetch, refresh, loadMore, ... }
}
```

**Key hooks:**
- `useAuth` - Authentication state
- `useInventoryItems` - Paginated item list with filters/sort
- `useCategories` - Category list with system presets
- `useLocations` - Hierarchical location tree
- `useSearch` - Text search with debounce
- `useDashboardStats` - Quick stats for dashboard
- `useToast` - Toast notifications (use this instead of Toast component)
- `useConfirm` - Confirmation dialogs
- `useTags` - Tags autocomplete
- `useNotifications` - Notification management
- `usePushNotifications` - Web Push subscription
- `useUserSettings` - User preferences
- `useExpiringItems` - Items nearing expiration
- `useRecentItems` - Recently added items
- `useRecentSearches` - Search history
- `usePullToRefresh` - Pull-to-refresh gesture
- `useOffline` - Network status
- `useInstallPrompt` - PWA install prompt (Android)
- `useIOSInstallPrompt` - PWA install prompt (iOS)
- `useShoppingUsage` - AI shopping rate limits

### Image Handling

**Location:** `src/lib/imageUtils.ts`

Key functions:
- `compressImage()` - Resize to max 2MB
- `convertHeicToJpeg()` - iOS HEIC conversion using heic2any
- `validateImage()` - Min 200x200, supported formats (JPEG, PNG, WebP, HEIC)
- `generateThumbnail()` - Create 200x200 thumbnail
- `uploadToStorage()` - Upload to `items/{user_id}/{uuid}.jpg`

**Storage path pattern:** `items/{user_id}/{filename}.jpg`

### PWA Configuration

**Location:** `vite.config.ts` - VitePWA plugin

Caching strategies:
- App shell (HTML, CSS, JS): CacheFirst
- Supabase API: NetworkFirst with 10s timeout
- Supabase Storage (images): CacheFirst, 30 days
- Images: CacheFirst, 30 days
- Fonts: CacheFirst, 1 year

**Install prompts:**
- Android/Chrome: `InstallBanner.tsx` - Captures beforeinstallprompt event
- iOS Safari: `IOSInstallBanner.tsx` - Shows instructions

### Supabase Edge Functions

Edge functions are located in `supabase/functions/` and must be deployed to Supabase:

| Function | Purpose |
|----------|---------|
| `analyze-image` | OpenAI Vision API for item detection and metadata extraction |
| `generate-embedding` | Create vector embeddings for semantic search |
| `shopping-analyze` | AI shopping assistant - analyzes photos and compares with inventory |
| `shopping-followup` | Conversational follow-ups in shopping assistant |
| `generate-reminders` | Background job to create notification reminders |
| `cleanup-deleted-items` | Background job to permanently delete soft-deleted items |
| `send-push-notification` | Send Web Push notifications to user devices |
| `process-batched-notifications` | Process batched message notifications (call every 5 seconds) |

**Deploy with:**
```bash
supabase functions deploy --all
```

**Important - JWT Verification:** Functions that handle user authentication (`analyze-image`, `shopping-analyze`, `shopping-followup`, `convert-image`) must be deployed with `--no-verify-jwt` to bypass Supabase gateway JWT verification. These functions implement their own auth validation:

```bash
supabase functions deploy analyze-image --no-verify-jwt
supabase functions deploy shopping-analyze --no-verify-jwt
supabase functions deploy shopping-followup --no-verify-jwt
supabase functions deploy convert-image --no-verify-jwt
```

Without this flag, Supabase's gateway may reject valid JWT tokens with "Invalid JWT" errors before they reach the function code.

**VAPID Keys for Web Push:**
The `send-push-notification` function requires VAPID keys for Web Push authorization. Generate them using `web-push generate-vapid-keys` and configure:

```bash
# Supabase secrets (set via Supabase CLI or dashboard)
supabase secrets set VAPID_PUBLIC_KEY=your-vapid-public-key
supabase secrets set VAPID_PRIVATE_KEY=your-vapid-private-key
supabase secrets set VAPID_SUBJECT=mailto:your-email@example.com
```

The public key must also be available in the frontend via `VITE_VAPID_PUBLIC_KEY` environment variable for subscription requests.

### AI Features

**AI Metadata** stored in `items.ai_metadata` (JSONB):
```ts
interface ItemAIMetadata {
  detected_name?: string
  detected_category?: string
  detected_tags?: string[]
  detected_brand?: string
  confidence_score?: number
  analysis_provider?: string
  analysis_model?: string
  analyzed_at?: string
}
```

**Sparkle icon pattern:** AI-suggested values show a sparkle indicator that disappears when user modifies the field.

## Conventions

### Commit Message Format

Follow the PRD commit pattern (Ralph agent):
```
feat: [US-XXX] - Story Title
chore: [US-XXX] - Mark story as complete in PRD
```

### TypeScript Settings

- Strict mode enabled
- `noUnusedLocals` and `noUnusedParameters` enforced
- Path alias: `@/*` → `src/*`

### State Management

- Local component state: `useState`
- Server state: TanStack React Query
- Global app state: React Context (Auth, Offline, Toast)

### File Naming

- Components: PascalCase (e.g., `ItemEditor.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useInventoryItems.ts`)
- Types: lowercase (e.g., `database.ts`, `api.ts`)

### Barrel Exports

Use `index.ts` files for clean imports:
```ts
// Instead of:
import { Button } from '@/components/Button/Button'
import { Input } from '@/components/Input/Input'

// Use:
import { Button, Input } from '@/components'
```

Locations with barrel exports:
- `src/contexts/index.ts` - All contexts and providers
- `src/pages/index.ts` - All page components
- `src/components/layout/index.ts` - AppShell and BottomNav
- `src/types/index.ts` - Database and API types

## Common Gotchas

1. **Location hierarchy** - When querying locations, always consider `parent_id` for tree structure. Use `path` field for display (e.g., "Home > Kitchen > Pantry").

2. **Soft delete** - Items use `deleted_at` timestamp. Always filter with `.is('deleted_at', null)` in queries.

3. **Category filters** - Support both single `categoryId` and multi-select `categoryIds` array. Check existing code for pattern.

4. **Image upload** - Must convert HEIC to JPEG before upload. Use `convertHeicToJpeg()` first.

5. **Toast notifications** - Use `useToast()` hook, NOT the old Toast component pattern. The Toast component now only renders via ToastProvider.

6. **Pull-to-refresh** - Use the `usePullToRefresh()` hook on Dashboard and Inventory pages.

7. **Infinite scroll** - The `useInventoryItems` hook returns `loadMore()` function. Trigger when within 200px of bottom.

8. **URL state** - Filters and sort options should persist in URL params for shareability. Use `replaceState` to avoid history bloat.

## Ralph Agent Integration

This project uses the Ralph autonomous agent system. See `scripts/ralph/CLAUDE.md` for Ralph-specific instructions.

**PRD Location:** `scripts/ralph/prd.json` - Contains 90 user stories with completion status.

**Progress Log:** `scripts/ralph/progress.txt` - Tracks implementation progress and learnings.
