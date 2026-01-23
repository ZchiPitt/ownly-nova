# Repository Guidelines

## Project Structure & Module Organization
- App: `src/` (React + TypeScript). Key folders: `components/`, `pages/`, `hooks/`, `contexts/`, `lib/`, `types/`, `assets/`.
- Public assets: `public/` (PWA icons, `manifest.json`).
- Serverless: `supabase/functions/*` (Edge Functions) and SQL in `supabase/migrations/`.
- Docs & tasks: `docs/`, `tasks/`. Build config in `vite.config.ts`, tests in `src/**/*.test.ts(x)` with setup at `src/test/setup.ts`.

## Build, Test, and Development Commands
- `npm run dev` — Start Vite dev server.
- `npm run build` — Type-check (`tsc -b`) and production build.
- `npm run preview` — Preview the production build locally.
- `npm run test` / `npm run test:watch` — Run Vitest once / in watch mode.
- `npm run test:coverage` — Generate coverage (V8 provider).
- `npm run lint` — Lint with ESLint.

## Coding Style & Naming Conventions
- Language: TypeScript, React 19, Vite.
- Indentation: 2 spaces; include semicolons; prefer named exports when practical.
- File names: Components/Pages in PascalCase (e.g., `ItemEditorPage.tsx`); hooks in camelCase starting with `use` (e.g., `useInventoryItems.ts`); contexts as `*Provider.tsx` and `*-context.ts`.
- Imports: use alias `@` for `src/` (e.g., `import { supabase } from '@/lib/supabase'`).
- Linting: ESLint (JS/TS recommended, React Hooks). Fix issues before PR.

## Testing Guidelines
- Framework: Vitest + Testing Library (`jsdom`).
- Location: Co-locate tests as `*.test.ts(x)` next to source or under `src/`.
- Setup: `src/test/setup.ts` auto-loaded via `vitest.config.ts`.
- Coverage: Reports are generated; keep meaningful tests for changed code.
- Example: `npm run test:watch` during development; `npm run test:coverage` before PR.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`.
  - Examples: `feat: Add Google OAuth sign-in`, `fix: Improve sign-out flow`.
- PRs must include: concise description, linked issue (if any), screenshots/GIFs for UI changes, test/lint status, and notes on Supabase/Env changes.

## Security & Configuration
- Environment: copy `.env.example` to `.env` and set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Never commit secrets.
- Deployment: `vercel.json` present; Supabase functions live in `supabase/functions/`.

## Supabase CLI
- Install: `brew install supabase/tap/supabase` (macOS) or `npm i -g supabase`.
- Auth: `supabase login` and paste your access token from the Supabase dashboard.
- Link project: `supabase link --project-ref <PROJECT_REF>` (find ref in Project Settings).
- Local stack: `supabase start`; apply migrations: `supabase db reset` (recreates DB and runs `supabase/migrations/`). Stop with `supabase stop`.
- Functions (Edge):
  - Serve locally: `supabase functions serve analyze-image --env-file .env`.
  - Deploy one: `supabase functions deploy analyze-image`.
  - Deploy all: `for d in supabase/functions/*; do supabase functions deploy "$(basename "$d")"; done`.
  - **Important:** Functions that handle user authentication (or external webhooks) must be deployed with `--no-verify-jwt` to bypass Supabase gateway JWT verification (the functions implement their own auth validation):
    ```bash
    supabase functions deploy analyze-image --no-verify-jwt
    supabase functions deploy shopping-analyze --no-verify-jwt
    supabase functions deploy shopping-followup --no-verify-jwt
    supabase functions deploy convert-image --no-verify-jwt
    supabase functions deploy stripe-webhook --no-verify-jwt
    supabase functions deploy subscriptions-create-checkout --no-verify-jwt
    ```
- Function secrets: `supabase secrets set KEY=VALUE` (scoped to the linked project).

## Agent-Specific Notes
- Prefer minimal, targeted diffs; follow existing patterns and file locations.
- When adding features, also add tests and update docs as needed.
