# US-FIX-001: Improve HEIC Error Handling

## Context
You are working on the Ownly project, a smart home inventory PWA.
Project root: ~/work/ownly

## Problem
When users import HEIC photos from iPhone gallery, the `heic2any` library sometimes fails. Users get a generic error message with no helpful options.

## Your Task
Improve HEIC error handling with retry logic, better error messages, and fallback options.

## Files to Modify
1. `src/lib/imageUtils.ts` - Add retry logic to convertHeicToJpeg()
2. `src/pages/AddItemPage.tsx` - Add HeicErrorModal component for fallback options

## Requirements

### 1. Update convertHeicToJpeg() in src/lib/imageUtils.ts

Add retry logic with decreasing quality:

```typescript
export async function convertHeicToJpeg(file: File): Promise<Blob> {
  const qualityLevels = [0.9, 0.8, 0.6];
  let lastError: Error | null = null;

  for (const quality of qualityLevels) {
    try {
      console.log(`[imageUtils] Attempting HEIC conversion with quality ${quality}`);
      const result = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality,
      });

      // heic2any can return an array for multi-frame images
      if (Array.isArray(result)) {
        return result[0];
      }
      return result;
    } catch (error) {
      console.error(`[imageUtils] HEIC conversion failed at quality ${quality}:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  // All retries failed
  throw new Error(
    `Failed to convert HEIC image after ${qualityLevels.length} attempts. ` +
    `Please try taking a new photo or use a JPEG/PNG image. ` +
    `(${lastError?.message || 'Unknown error'})`
  );
}
```

### 2. Add HeicErrorModal component in src/pages/AddItemPage.tsx

Add this component inside AddItemPage.tsx (before the main export):

```typescript
interface HeicErrorModalProps {
  isOpen: boolean;
  onTakePhoto: () => void;
  onChooseDifferent: () => void;
  onClose: () => void;
}

function HeicErrorModal({ isOpen, onTakePhoto, onChooseDifferent, onClose }: HeicErrorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl mx-4 w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Image Processing Failed
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          This image format couldn't be processed. Some HEIC formats from iOS aren't fully supported. Please try one of these options:
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onTakePhoto}
            className="w-full px-4 py-3 bg-teal-600 rounded-lg text-white font-medium hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Take New Photo
          </button>
          <button
            onClick={onChooseDifferent}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Choose Different Image
          </button>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-gray-500 text-sm hover:text-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 3. Add state and handlers in AddItemPage component

Add state:
```typescript
const [showHeicErrorModal, setShowHeicErrorModal] = useState(false);
```

Add handlers:
```typescript
const handleHeicError = () => {
  setShowHeicErrorModal(true);
};

const handleHeicTakePhoto = () => {
  setShowHeicErrorModal(false);
  // Trigger camera input
  if (cameraInputRef.current) {
    cameraInputRef.current.click();
  }
};

const handleHeicChooseDifferent = () => {
  setShowHeicErrorModal(false);
  // Trigger gallery input
  if (galleryInputRef.current) {
    galleryInputRef.current.click();
  }
};
```

### 4. Update error handling in handleImageSelect or wherever HEIC errors are caught

When catching HEIC conversion errors, check for the specific error message and show the modal:

```typescript
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  
  // Check if it's a HEIC conversion error
  if (errorMessage.includes('HEIC') || errorMessage.includes('heic')) {
    handleHeicError();
  } else {
    setToast({
      message: errorMessage,
      type: 'error',
    });
  }
}
```

### 5. Add the modal to the JSX return

Add near the end of the component's return, before the closing fragment:
```jsx
<HeicErrorModal
  isOpen={showHeicErrorModal}
  onTakePhoto={handleHeicTakePhoto}
  onChooseDifferent={handleHeicChooseDifferent}
  onClose={() => setShowHeicErrorModal(false)}
/>
```

## Acceptance Criteria
- [ ] convertHeicToJpeg() has retry logic with 3 quality levels (0.9, 0.8, 0.6)
- [ ] Error message includes helpful text about trying a new photo
- [ ] HeicErrorModal component exists with Take Photo and Choose Different buttons
- [ ] Modal shows when HEIC conversion fails
- [ ] Take Photo button triggers camera input
- [ ] Choose Different button triggers gallery input
- [ ] Cancel button closes modal
- [ ] `npm run build` passes with no TypeScript errors
- [ ] `npm run lint` passes (or only has pre-existing warnings)

## Verification
1. Run `npm run build` - must succeed
2. Run `npm run lint` - must pass

## Done Criteria
Run these commands and verify they succeed:
```bash
cd ~/work/ownly && npm run build && npm run lint
```

When completely finished, output a summary of changes made.
