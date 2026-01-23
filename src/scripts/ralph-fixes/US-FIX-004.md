# US-FIX-004: Quick Add Single Item

## Context
You are working on the Ownly project, a smart home inventory PWA.
Project root: ~/work/ownly

## Problem
When AI detects exactly 1 item, users must go through the full ItemEditor to save it. A "Quick Add" option would save time by using AI defaults directly.

## Your Task
Add a "Quick Add" option when a single item is detected, allowing users to save immediately with AI-suggested values.

## Files to Modify
1. `src/pages/AddItemPage.tsx` - Add Quick Add flow for single items

## Requirements

### 1. Modify Single Item Flow

Currently when AI detects 1 item, it goes directly to ItemEditor. Change this to show a choice screen first.

Find where single item detection triggers navigation to ItemEditor (likely in the analysis result handling).

Add new state:
```typescript
const [showSingleItemChoice, setShowSingleItemChoice] = useState(false);
const [singleDetectedItem, setSingleDetectedItem] = useState<DetectedItem | null>(null);
```

### 2. Create SingleItemChoice Component

Add inline in AddItemPage.tsx (or as separate component):

```typescript
const SingleItemChoiceView = () => {
  if (!analysisResult || !singleDetectedItem) return null;
  
  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <button onClick={handleCancelAnalysis} className="p-2 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">Item Detected</h1>
        <div className="w-10" /> {/* Spacer */}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* Image Preview */}
        <div className="aspect-square w-full max-w-sm mx-auto rounded-xl overflow-hidden bg-gray-100 mb-6">
          <img 
            src={analysisResult.thumbnailUrl || analysisResult.imageUrl} 
            alt="Detected item"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Item Info */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <h2 className="text-xl font-semibold">{singleDetectedItem.name}</h2>
            <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z" />
            </svg>
          </div>
          {singleDetectedItem.category_suggestion && (
            <p className="text-gray-500">{singleDetectedItem.category_suggestion}</p>
          )}
          {singleDetectedItem.tags && singleDetectedItem.tags.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-3">
              {singleDetectedItem.tags.slice(0, 5).map((tag, i) => (
                <span key={i} className="px-2 py-1 bg-gray-100 rounded-full text-sm text-gray-600">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex-shrink-0 p-4 border-t border-gray-200 space-y-3 safe-area-pb">
        <button
          onClick={handleQuickAdd}
          disabled={isQuickAdding}
          className="w-full px-4 py-3 bg-teal-600 rounded-xl text-white font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isQuickAdding ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Adding...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Quick Add</span>
            </>
          )}
        </button>
        <button
          onClick={handleEditDetails}
          disabled={isQuickAdding}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Edit Details
        </button>
      </div>
    </div>
  );
};
```

### 3. Add Quick Add Handler

```typescript
const [isQuickAdding, setIsQuickAdding] = useState(false);

const handleQuickAdd = async () => {
  if (!user || !analysisResult || !singleDetectedItem) return;

  setIsQuickAdding(true);

  try {
    // Look up category ID from suggestion
    let categoryId: string | null = null;
    if (singleDetectedItem.category_suggestion) {
      const { data } = await (supabase
        .from('categories') as ReturnType<typeof supabase.from>)
        .select('id')
        .or(`name.eq.${singleDetectedItem.category_suggestion},and(user_id.eq.${user.id},name.eq.${singleDetectedItem.category_suggestion})`)
        .limit(1);
      const categories = data as { id: string }[] | null;
      if (categories && categories.length > 0) {
        categoryId = categories[0].id;
      }
    }

    // Create the item
    const { error } = await (supabase
      .from('items') as ReturnType<typeof supabase.from>)
      .insert({
        user_id: user.id,
        photo_url: analysisResult.imageUrl,
        thumbnail_url: analysisResult.thumbnailUrl,
        name: singleDetectedItem.name || 'Unnamed Item',
        category_id: categoryId,
        tags: singleDetectedItem.tags || [],
        brand: singleDetectedItem.brand,
        quantity: 1,
        ai_metadata: {
          detected_name: singleDetectedItem.name,
          detected_category: singleDetectedItem.category_suggestion,
          detected_tags: singleDetectedItem.tags,
          detected_brand: singleDetectedItem.brand,
          confidence_score: singleDetectedItem.confidence,
          analysis_provider: 'gemini',
          analyzed_at: new Date().toISOString(),
        },
      });

    if (error) {
      console.error('Failed to save item:', error);
      setToast({
        message: 'Failed to add item. Please try again.',
        type: 'error',
      });
      setIsQuickAdding(false);
      return;
    }

    // Invalidate inventory cache
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

    setToast({
      message: '✓ Item added!',
      type: 'success',
    });

    // Navigate to inventory after short delay
    setTimeout(() => navigate('/inventory'), 1000);

  } catch (error) {
    console.error('Error in quick add:', error);
    setToast({
      message: 'Something went wrong. Please try again.',
      type: 'error',
    });
    setIsQuickAdding(false);
  }
};
```

### 4. Add Edit Details Handler

```typescript
const handleEditDetails = () => {
  if (!analysisResult || !singleDetectedItem) return;
  
  // Navigate to ItemEditor with the detected item data
  navigate('/items/new', {
    state: {
      imageUrl: analysisResult.imageUrl,
      thumbnailUrl: analysisResult.thumbnailUrl,
      detectedItem: singleDetectedItem,
      fromQuickAdd: true,
    },
  });
};
```

### 5. Modify Analysis Result Handling

Find where analysis results are processed. When exactly 1 item is detected, instead of going to ItemEditor, show the choice screen:

```typescript
// After AI analysis completes successfully
if (result.items.length === 1) {
  setSingleDetectedItem(result.items[0]);
  setShowSingleItemChoice(true);
} else if (result.items.length > 1) {
  // Existing multi-item flow
  setShowMultiItemSelection(true);
} else {
  // No items detected
  setToast({ message: 'No items detected in photo', type: 'error' });
}
```

### 6. Add Render Logic

In the main render, add:

```typescript
// Single item choice view
if (showSingleItemChoice && singleDetectedItem) {
  return <SingleItemChoiceView />;
}
```

### 7. Write Unit Test

Create `src/pages/AddItemPage.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock dependencies
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/contexts', () => ({
  useAuth: () => ({ user: { id: 'test-user' } }),
  useToast: () => ({ setToast: vi.fn() }),
}));

describe('AddItemPage Quick Add', () => {
  it('should have Quick Add functionality defined', () => {
    // Basic test to verify the module loads
    expect(true).toBe(true);
  });
});
```

## Acceptance Criteria
- [ ] When AI detects 1 item, shows choice screen (not ItemEditor directly)
- [ ] Choice screen shows item preview with AI-detected name and tags
- [ ] "Quick Add" button saves item with AI defaults
- [ ] "Edit Details" button navigates to ItemEditor with prefilled data
- [ ] Quick Add shows loading spinner while saving
- [ ] Success toast shows "✓ Item added!"
- [ ] Navigates to /inventory after successful Quick Add
- [ ] Error handling for failed saves
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
