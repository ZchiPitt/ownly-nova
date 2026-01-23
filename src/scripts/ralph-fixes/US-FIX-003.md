# US-FIX-003: Batch Save with AI Defaults

## Context
You are working on the Ownly project, a smart home inventory PWA.
Project root: ~/work/ownly

## Problem
When AI detects multiple items in a photo, users must click each item one by one to add them. This is tedious and slow.

## Your Task
Add an "Add All Selected" button that batch saves all selected items using AI-suggested default values.

## Files to Modify
1. `src/components/MultiItemSelection.tsx` - Add batch save button and progress UI
2. `src/pages/AddItemPage.tsx` - Handle batch save logic

## Requirements

### 1. Update MultiItemSelection.tsx

Add a new prop for batch save:
```typescript
interface MultiItemSelectionProps {
  // ... existing props
  onBatchSave?: (selectedItems: ImageInfo[]) => void;
  isBatchSaving?: boolean;
  batchSaveProgress?: { current: number; total: number };
}
```

Add the "Add All Selected" button at the bottom of the component (after the item list):

```typescript
{/* Batch Save Button */}
{selectedItems.length > 0 && onBatchSave && (
  <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
    <button
      onClick={() => onBatchSave(selectedItems)}
      disabled={isBatchSaving}
      className="w-full px-4 py-3 bg-teal-600 rounded-lg text-white font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      {isBatchSaving ? (
        <>
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Saving {batchSaveProgress?.current || 0} of {batchSaveProgress?.total || 0}...</span>
        </>
      ) : (
        <>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Add All ({selectedItems.length} items)</span>
        </>
      )}
    </button>
  </div>
)}
```

### 2. Update AddItemPage.tsx

Add state for batch save:
```typescript
const [isBatchSaving, setIsBatchSaving] = useState(false);
const [batchSaveProgress, setBatchSaveProgress] = useState({ current: 0, total: 0 });
```

Add batch save handler:
```typescript
const handleBatchSave = async (items: DetectedItem[]) => {
  if (!user || !analysisResult) return;

  setIsBatchSaving(true);
  setBatchSaveProgress({ current: 0, total: items.length });

  let successCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    setBatchSaveProgress({ current: i + 1, total: items.length });

    try {
      // Look up category ID from suggestion
      let categoryId: string | null = null;
      if (item.category_suggestion) {
        const { data: categories } = await supabase
          .from('categories')
          .select('id')
          .or(`name.eq.${item.category_suggestion},and(user_id.eq.${user.id},name.eq.${item.category_suggestion})`)
          .limit(1);
        if (categories && categories.length > 0) {
          categoryId = categories[0].id;
        }
      }

      // Create the item
      const { error } = await supabase.from('items').insert({
        user_id: user.id,
        photo_url: analysisResult.imageUrl,
        thumbnail_url: analysisResult.thumbnailUrl,
        name: item.name || 'Unnamed Item',
        category_id: categoryId,
        tags: item.tags || [],
        brand: item.brand,
        quantity: 1,
        ai_metadata: {
          detected_name: item.name,
          detected_category: item.category_suggestion,
          detected_tags: item.tags,
          detected_brand: item.brand,
          confidence_score: item.confidence,
          analysis_provider: 'gemini',
          analyzed_at: new Date().toISOString(),
        },
      });

      if (error) {
        console.error('Failed to save item:', item.name, error);
        errors.push(item.name || 'Unknown');
      } else {
        successCount++;
      }
    } catch (error) {
      console.error('Error saving item:', error);
      errors.push(item.name || 'Unknown');
    }
  }

  setIsBatchSaving(false);

  // Show result
  if (errors.length === 0) {
    setToast({
      message: `✓ ${successCount} items added!`,
      type: 'success',
    });
    // Navigate to inventory after short delay
    setTimeout(() => navigate('/inventory'), 1500);
  } else {
    setToast({
      message: `${successCount} of ${items.length} items added. ${errors.length} failed.`,
      type: errors.length === items.length ? 'error' : 'warning',
    });
  }
};
```

### 3. Pass props to MultiItemSelection

Find where MultiItemSelection is rendered and add the new props:
```typescript
<MultiItemSelection
  items={...}
  // ... existing props
  onBatchSave={handleBatchSave}
  isBatchSaving={isBatchSaving}
  batchSaveProgress={batchSaveProgress}
/>
```

### 4. Add 'warning' type to toast if needed

If the Toast component doesn't support 'warning' type, use 'info' instead or update the Toast types.

## Acceptance Criteria
- [ ] "Add All (X items)" button appears when items are selected
- [ ] Button is disabled during batch save
- [ ] Progress shows "Saving 1 of 5..." during save
- [ ] Success toast shows "✓ X items added!"
- [ ] Navigates to /inventory after successful save
- [ ] Partial success shows "X of Y items added. Z failed."
- [ ] Items are saved with AI-suggested values (name, category, tags, brand)
- [ ] `npm run build` passes with no TypeScript errors
- [ ] `npm run lint` passes

## Verification
1. Run `npm run build` - must succeed
2. Run `npm run lint` - must pass

## Done Criteria
Run these commands and verify they succeed:
```bash
cd ~/work/ownly && npm run build && npm run lint
```

When completely finished, output a summary of changes made.
