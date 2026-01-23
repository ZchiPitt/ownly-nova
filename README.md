# Ownly

> Smart Home Inventory App - Track household belongings with AI-powered photo recognition

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-blue)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7.2-646CFF)](https://vite.dev/)

**Ownly** is a Progressive Web App (PWA) that helps you track household belongings through AI-powered photo recognition. Never forget where you stored something again!

## Features

- **AI-Powered Photo Recognition** - Automatically identify items, suggest categories, and extract metadata
- **Hierarchical Location Tracking** - Organize items by room, shelf, box, etc.
- **Semantic Search** - Find items by name, category, location, tags, or voice
- **Smart Shopping Assistant** - Check if you already own similar items before buying
- **Expiration Tracking** - Get reminders for food, cosmetics, and other dated items
- **Offline Support** - Works without internet connection (PWA)
- **Push Notifications** - Reminders for unused items and expiring goods
- **Gallery & List Views** - Browse your inventory the way you prefer

## Tech Stack

- **Frontend:** React 19.2 + TypeScript + Vite
- **Styling:** Tailwind CSS 4.x
- **Routing:** React Router v6
- **State Management:** TanStack React Query
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **AI:** OpenAI Vision API + Embeddings (pgvector)

## Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- A Supabase project (create one at [supabase.com](https://supabase.com))

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ownly.git
cd ownly

# Install dependencies
npm install
```

### Environment Setup

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Configure your environment variables in `.env`:

```bash
# Required - Get from your Supabase project settings
# https://app.supabase.com/project/_/settings/api
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Optional - For Web Push notifications
# Generate with: npx web-push generate-vapid-keys
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key
```

### Database Setup

The database schema is managed through Supabase migrations located in `supabase/migrations/`.

### Option 1: Supabase CLI (Recommended)

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Link to your project
supabase link --project-ref <your-project-ref>

# Run all migrations
supabase db push
```

### Option 2: Manual Migration

Run each migration file in order via the Supabase SQL Editor:

| Migration | Purpose |
|-----------|---------|
| `20260123000001_create_profiles_table.sql` | User profiles extending auth.users |
| `20260123000002_create_user_settings_table.sql` | Notification and display preferences |
| `20260123000003_create_categories_table.sql` | Categories with 10 system presets |
| `20260123000004_create_locations_table.sql` | Hierarchical storage locations |
| `20260123000005_create_items_table.sql` | Core inventory items table |
| `20260123000006_create_notifications_table.sql` | Reminder notifications |
| `20260123000007_create_location_item_count_trigger.sql` | Auto-maintain location counts |
| `20260123000008_add_pgvector_embedding.sql` | Vector embeddings for semantic search |
| `20260123000009_create_items_storage_bucket.sql` | Storage bucket for photos |
| `20260123000010_create_push_subscriptions_table.sql` | Web Push endpoints |
| `20260123000011_create_shopping_usage_table.sql` | AI shopping assistant rate limits |

### What Gets Created

- **Tables:** profiles, user_settings, categories, locations, items, notifications, push_subscriptions, shopping_usage
- **Extensions:** pgvector for similarity search
- **RLS Policies:** Row-level security on all user tables
- **Triggers:** Automatic profile/settings creation, location item_count maintenance
- **Functions:** `search_similar_items()` for vector similarity search

### Storage Setup

Create a Supabase Storage bucket named `items`:

1. Go to **Storage** in your Supabase Dashboard
2. Click **New bucket**
3. Configure:
   - **Name:** `items`
   - **Public bucket:** No (unchecked)
   - **File size limit:** 10MB
   - **Allowed MIME types:** `image/jpeg, image/png, image/webp, image/heic`

4. Add RLS policy via SQL Editor:
```sql
-- Allow users to upload to their own folder
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'items' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to read their own files
CREATE POLICY "Users can read own files"
ON storage.objects FOR SELECT
USING (bucket_id = 'items' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
USING (bucket_id = 'items' AND (storage.foldername(name))[1] = auth.uid()::text);
```

### Edge Functions Setup

This project includes 6 Supabase Edge Functions in `supabase/functions/` for AI features and background tasks.

#### Prerequisites

1. **Get an OpenAI API key** from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. **Install Supabase CLI:**
   ```bash
   npm install -g supabase
   ```
3. **Link your project:**
   ```bash
   supabase link --project-ref <your-project-ref>
   ```

#### Set Edge Function Secrets

```bash
# Required for AI features
supabase secrets set OPENAI_API_KEY=sk-your-openai-api-key

# Optional for push notifications
supabase secrets set VAPID_PRIVATE_KEY=your-vapid-private-key
supabase secrets set VAPID_SUBJECT=mailto:your-email@example.com
```

#### Deploy All Functions

```bash
# Deploy background job functions (no auth required)
supabase functions deploy generate-embedding
supabase functions deploy generate-reminders
supabase functions deploy cleanup-deleted-items

# Deploy user-facing functions with --no-verify-jwt
# These functions implement their own JWT validation
# The flag bypasses Supabase gateway JWT verification which may reject valid tokens
supabase functions deploy analyze-image --no-verify-jwt
supabase functions deploy shopping-analyze --no-verify-jwt
supabase functions deploy shopping-followup --no-verify-jwt
supabase functions deploy convert-image --no-verify-jwt
```

> **Note:** The `--no-verify-jwt` flag is required for `analyze-image`, `shopping-analyze`, `shopping-followup`, and `convert-image` because Supabase's gateway JWT verification may reject valid tokens with "Invalid JWT" errors. These functions implement their own authentication which properly validates user tokens.

#### Edge Function Reference

| Function | Purpose | AI Model Used |
|----------|---------|---------------|
| `analyze-image` | Photo recognition - identifies items, suggests categories, extracts tags | GPT-4o Vision |
| `generate-embedding` | Creates vector embeddings for semantic similarity search | text-embedding-3-small |
| `shopping-analyze` | AI shopping assistant - analyzes photos and compares with inventory | GPT-4o Vision |
| `shopping-followup` | Conversational follow-ups in shopping assistant | GPT-4o |
| `generate-reminders` | Background job to create notification reminders | N/A |
| `cleanup-deleted-items` | Background job to permanently delete soft-deleted items after 30 days | N/A |

#### Scheduling Background Jobs (Optional)

For production, set up cron jobs via Supabase Dashboard → Database → Extensions → pg_cron:

```sql
-- Generate reminders daily at 9am UTC
SELECT cron.schedule('generate-reminders', '0 9 * * *',
  $$SELECT net.http_post(url := '<project-url>/functions/v1/generate-reminders')$$);

-- Cleanup deleted items weekly on Sunday at 3am UTC
SELECT cron.schedule('cleanup-deleted', '0 3 * * 0',
  $$SELECT net.http_post(url := '<project-url>/functions/v1/cleanup-deleted-items')$$);
```

## Running the App

```bash
# Development server (http://localhost:5173)
npm run dev

# Type check
npm run build  # or: tsc -b

# Lint
npm run lint

# Production build
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
ownly/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── layout/      # AppShell, BottomNav
│   │   ├── dashboard/   # Dashboard-specific components
│   │   └── *.tsx        # Feature components
│   ├── contexts/        # React contexts (Auth, Offline, Toast, Confirm)
│   ├── hooks/           # Custom React hooks (21 hooks)
│   ├── lib/             # Utilities (supabase, imageUtils)
│   ├── pages/           # Route components
│   ├── types/           # TypeScript definitions
│   └── App.tsx          # Root component with routing
├── supabase/
│   ├── functions/       # Edge Functions (6 functions)
│   │   ├── analyze-image/
│   │   ├── generate-embedding/
│   │   ├── shopping-analyze/
│   │   ├── shopping-followup/
│   │   ├── generate-reminders/
│   │   └── cleanup-deleted-items/
│   └── migrations/      # Database migrations (11 files)
├── docs/
│   ├── requirements.md  # Product requirements
│   └── USAGE.md         # User guide
├── scripts/ralph/       # Ralph autonomous agent files
│   ├── prd.json         # Product requirements with 90 user stories
│   ├── progress.txt     # Implementation progress
│   └── CLAUDE.md        # Ralph agent instructions
├── public/              # Static assets, PWA manifest
├── .env.example         # Environment template
├── vite.config.ts       # Vite + PWA configuration
└── tsconfig.json        # TypeScript configuration
```

## Development

### Path Aliases

Use `@/` prefix for all imports from `src/`:

```ts
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
```

### Type Safety

This project uses strict TypeScript. Always run `npm run build` before committing to ensure type safety.

### Component Patterns

- **AppShell** - Main layout with header, content, and bottom nav
- **ItemEditor** - Reusable form for creating/editing items
- **Bottom Sheets** - Used for filters and pickers (BottomSheet base component)
- **Toast Notifications** - Use `useToast()` hook
- **Confirmation Dialogs** - Use `useConfirm()` hook

### Conventions

- **Commit format:** `feat: [US-XXX] - Story Title` (see PRD for user stories)
- **File naming:** PascalCase for components, camelCase for hooks
- **Barrel exports:** Use `index.ts` files for clean imports

See [CLAUDE.md](./CLAUDE.md) for detailed development guidelines.

## User Documentation

- **[User Guide](./docs/USAGE.md)** - Complete guide for end users
- **[Product Requirements](./docs/requirements.md)** - Feature specifications

## Roadmap

**Current status: ✅ 90 of 90 user stories completed**

The MVP is feature-complete. See `scripts/ralph/prd.json` for the full product roadmap and implementation details.

### Implemented Features

- User authentication (signup, login, password reset)
- AI-powered photo recognition with GPT-4o Vision
- Hierarchical location management
- Category management with system presets
- Full item CRUD with soft-delete
- Gallery and list view modes
- Text and voice search
- AI shopping assistant with conversation mode
- Push notifications and reminders
- PWA with offline support
- App update detection and prompt

## FAQ

**Q: Can I run this without Supabase?**

A: No. Ownly requires Supabase for authentication, database, and storage. You'll need to create a free Supabase account and project.

**Q: Do I need OpenAI API keys?**

A: Yes, for AI features (photo recognition, shopping assistant, embeddings). You need a paid OpenAI account with GPT-4o access. Set `OPENAI_API_KEY` as a Supabase Edge Function secret:
```bash
supabase secrets set OPENAI_API_KEY=sk-your-key
```

**Q: Can I use other LLM providers?**

A: The Edge Functions are written for OpenAI's API. To use other providers (Anthropic, Google, etc.), you would need to modify the functions in `supabase/functions/`. The key functions to modify are `analyze-image` (Vision API) and `generate-embedding` (Embeddings API).

**Q: What OpenAI models are used?**

A:
- **GPT-4o** for photo analysis and shopping assistant (requires GPT-4 API access)
- **text-embedding-3-small** for semantic search embeddings

**Q: How much does the AI cost?**

A: Costs depend on usage. Approximate per-operation:
- Photo analysis: ~$0.01-0.03 per image (GPT-4o Vision)
- Embedding generation: ~$0.0001 per item (text-embedding-3-small)
- Shopping assistant: ~$0.02-0.05 per conversation

**Q: Can I use this offline?**

A: Yes! Ownly is a PWA with offline support. Cached content remains viewable without internet, and an offline banner appears when disconnected. AI features require internet.

**Q: How do I deploy this?**

A:
1. Build the app: `npm run build`
2. Deploy `dist/` folder to any static host (Vercel, Netlify, Cloudflare Pages)
3. Deploy Edge Functions: `supabase functions deploy --all`
4. Set environment secrets: `supabase secrets set OPENAI_API_KEY=...`

**Q: What's the Ralph agent?**

A: Ralph is an autonomous coding agent that implemented this project through 90 user stories. See `scripts/ralph/CLAUDE.md` for details. The project is now complete.

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- Built with [Vite](https://vite.dev/)
- Backend by [Supabase](https://supabase.com/)
- AI powered by [OpenAI](https://openai.com/)
- PWA support from [vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa)
