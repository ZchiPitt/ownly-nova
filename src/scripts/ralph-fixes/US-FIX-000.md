# US-FIX-000: Configure Vitest Testing Framework

## Context
You are working on the Ownly project, a smart home inventory PWA.
Project root: ~/work/ownly

## Problem
The project has no testing infrastructure. We need Vitest configured before implementing other features.

## Your Task
Set up Vitest with React Testing Library for unit testing.

## Requirements

### 1. Install Dependencies

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/coverage-v8
```

### 2. Create Vitest Config

Create `vitest.config.ts` in project root:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### 3. Create Test Setup File

Create `src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: MockResizeObserver,
});
```

### 4. Update package.json Scripts

Add to "scripts" section:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

### 5. Update tsconfig.json

Add to compilerOptions if not present:

```json
"types": ["vitest/globals", "@testing-library/jest-dom"]
```

### 6. Create Sample Test

Create `src/lib/imageUtils.test.ts` to verify setup works:

```typescript
import { describe, it, expect } from 'vitest';

describe('imageUtils', () => {
  it('test setup works', () => {
    expect(true).toBe(true);
  });
});
```

### 7. Fix Existing Lint Errors

Fix the pre-existing lint errors so `npm run lint` passes:

**src/App.tsx** - Fix `any` type errors around lines 114-115
**supabase/functions/analyze-image/index.ts** - Fix unused `error` variable around line 264

## Acceptance Criteria
- [ ] Vitest and testing libraries installed
- [ ] `vitest.config.ts` created with proper config
- [ ] `src/test/setup.ts` created with mocks
- [ ] package.json has test scripts
- [ ] Sample test file exists and passes
- [ ] `npm run build` passes
- [ ] `npm run lint` passes  
- [ ] `npm run test` passes

## Verification
Run these commands and verify they all succeed:
```bash
cd ~/work/ownly && npm run build && npm run lint && npm run test
```

## Done Criteria
All three commands above must exit with code 0.
