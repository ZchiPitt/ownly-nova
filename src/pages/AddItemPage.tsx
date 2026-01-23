/**
 * Add Item Page - Photo capture, selection, preview, and AI analysis for adding items
 * Route: /add
 *
 * Features:
 * - Page title: "Add Item"
 * - Two action cards: Take Photo and Choose from Gallery
 * - Helper text explaining AI photo recognition
 * - Camera capture with capture="environment" for rear camera
 * - Gallery selection with image/* accept
 * - Camera permission denied handling with alert and fallback
 * - Full-screen photo preview with pinch-to-zoom
 * - Retake/Continue buttons in preview mode
 * - AI analysis with loading overlay and timeout handling
 * - Success/failure states with appropriate navigation
 * - Toast notifications for errors
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toast } from '@/components/Toast';
import { MultiItemSelection } from '@/components/MultiItemSelection';
import type { ImageInfo } from '@/components/MultiItemSelection';
import {
  validateImage,
  processAndUploadImage,
  deleteFromStorage,
  cropImageToBbox,
  validateBbox,
  clampBbox,
  uploadToStorage,
} from '@/lib/imageUtils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useCategories } from '@/hooks/useCategories';
import type { DetectedItem, AnalyzeImageResponse } from '@/types/api';
import type { ItemAIMetadata } from '@/types';
import { generateItemEmbedding } from '@/lib/embeddingUtils';

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

// View states for the Add Item flow
type ViewState = 'capture' | 'preview' | 'analyzing' | 'results' | 'error';

// Analysis state phases
type AnalysisPhase = 'uploading' | 'analyzing' | 'timeout';

// Result from AI analysis
interface AnalysisResult {
  items: DetectedItem[];
  imageUrl: string;
  thumbnailUrl: string;
  imagePath: string;
  thumbnailPath: string;
}

const DEFAULT_BBOX: [number, number, number, number] = [0, 0, 100, 100];

interface HeicErrorModalProps {
  isOpen: boolean;
  onTakePhoto: () => void;
  onChooseDifferent: () => void;
  onClose: () => void;
}

function HeicErrorModal({
  isOpen,
  onTakePhoto,
  onChooseDifferent,
  onClose,
}: HeicErrorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl mx-4 w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-[#4a3f35] mb-2">
          Image Processing Failed
        </h2>
        <p className="text-sm text-[#8d7b6d] mb-6">
          This image format couldn't be processed. Some HEIC formats from iOS
          aren't fully supported. Please try one of these options:
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onTakePhoto}
            className="w-full px-4 py-3 bg-[#8d7b6d] rounded-lg text-white font-medium hover:bg-[#7c6b5d] transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Take New Photo
          </button>
          <button
            onClick={onChooseDifferent}
            className="w-full px-4 py-3 border border-[#f5ebe0] rounded-lg text-[#6f5f52] font-medium hover:bg-[#fdf8f2] transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Choose Different Image
          </button>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-[#8d7b6d] text-sm hover:text-[#6f5f52] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function AddItemPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { categories } = useCategories();

  // References to hidden file inputs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // State
  const [toast, setToast] = useState<ToastState | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewState, setViewState] = useState<ViewState>('capture');
  const [showHeicErrorModal, setShowHeicErrorModal] = useState(false);

  // AI Analysis state
  const [analysisPhase, setAnalysisPhase] = useState<AnalysisPhase>('uploading');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisSecondsElapsed, setAnalysisSecondsElapsed] = useState(0);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const analysisTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Batch save state
  const [isBatchSaving, setIsBatchSaving] = useState(false);
  const [batchSaveProgress, setBatchSaveProgress] = useState({ current: 0, total: 0 });
  const [showSingleItemChoice, setShowSingleItemChoice] = useState(false);
  const [singleDetectedItem, setSingleDetectedItem] = useState<DetectedItem | null>(null);
  const [isQuickAdding, setIsQuickAdding] = useState(false);

  // Pinch-to-zoom state
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isPinching, setIsPinching] = useState(false);
  const lastTouchDistanceRef = useRef<number | null>(null);
  const lastTouchCenterRef = useRef<{ x: number; y: number } | null>(null);

  // Track whether image was from camera (for "Retake" vs "Reselect" label)
  const [isFromCamera, setIsFromCamera] = useState(false);

  const handleHeicError = () => {
    setShowHeicErrorModal(true);
  };

  const handleHeicTakePhoto = () => {
    setShowHeicErrorModal(false);
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  const handleHeicChooseDifferent = () => {
    setShowHeicErrorModal(false);
    if (galleryInputRef.current) {
      galleryInputRef.current.click();
    }
  };

  // Cleanup preview URL on unmount or when image changes
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  // Cleanup analysis timers on unmount
  useEffect(() => {
    return () => {
      // Clear all timers
      analysisTimersRef.current.forEach((timer) => clearTimeout(timer));
      analysisTimersRef.current = [];
      // Abort any ongoing request
      if (analysisAbortRef.current) {
        analysisAbortRef.current.abort();
      }
    };
  }, []);

  // Track analysis elapsed time
  useEffect(() => {
    if (viewState !== 'analyzing' || analysisPhase !== 'analyzing') {
      setAnalysisSecondsElapsed(0);
      return;
    }

    const interval = setInterval(() => {
      setAnalysisSecondsElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [viewState, analysisPhase]);

  // Get loading text based on phase and elapsed time
  const getAnalysisLoadingText = useCallback(() => {
    if (analysisPhase === 'uploading') {
      return 'Uploading photo...';
    } else if (analysisPhase === 'analyzing') {
      if (analysisSecondsElapsed >= 5) {
        return 'Still analyzing, please wait...';
      }
      return 'Analyzing your photo...';
    } else if (analysisPhase === 'timeout') {
      return 'This is taking longer than expected...';
    }
    return 'Analyzing your photo...';
  }, [analysisPhase, analysisSecondsElapsed]);

  /**
   * Reset zoom state
   */
  const resetZoom = useCallback(() => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  }, []);

  /**
   * Handle touch start for pinch-to-zoom
   */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setIsPinching(true);
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      lastTouchDistanceRef.current = distance;
      lastTouchCenterRef.current = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2,
      };
    }
  }, []);

  /**
   * Handle touch move for pinch-to-zoom
   */
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && isPinching) {
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        const center = {
          x: (touch1.clientX + touch2.clientX) / 2,
          y: (touch1.clientY + touch2.clientY) / 2,
        };

        if (lastTouchDistanceRef.current && lastTouchCenterRef.current) {
          // Calculate scale change
          const scaleChange = distance / lastTouchDistanceRef.current;
          const newScale = Math.max(1, Math.min(5, scale * scaleChange));

          // Calculate pan change (only when zoomed in)
          if (newScale > 1) {
            const dx = center.x - lastTouchCenterRef.current.x;
            const dy = center.y - lastTouchCenterRef.current.y;
            setTranslateX((prev) => prev + dx);
            setTranslateY((prev) => prev + dy);
          }

          setScale(newScale);
        }

        lastTouchDistanceRef.current = distance;
        lastTouchCenterRef.current = center;
      }
    },
    [isPinching, scale]
  );

  /**
   * Handle touch end for pinch-to-zoom
   */
  const handleTouchEnd = useCallback(() => {
    setIsPinching(false);
    lastTouchDistanceRef.current = null;
    lastTouchCenterRef.current = null;

    // Reset position if scale returns to 1
    if (scale <= 1) {
      resetZoom();
    }
  }, [scale, resetZoom]);

  /**
   * Handle double-tap to reset zoom
   */
  const lastTapRef = useRef<number>(0);
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap detected
      if (scale > 1) {
        resetZoom();
      } else {
        setScale(2);
      }
    }
    lastTapRef.current = now;
  }, [scale, resetZoom]);

  /**
   * Handle file selection from camera or gallery
   */
  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
    fromCamera: boolean
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);

    try {
      // Get access token for HEIC conversion fallback
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      // Validate the selected image
      const validation = await validateImage(file, accessToken);

      if (!validation.valid) {
        const validationMessage = validation.error || 'Invalid image';
        if (validationMessage.includes('HEIC') || validationMessage.includes('heic')) {
          handleHeicError();
        } else {
          setToast({
            message: validationMessage,
            type: 'error',
          });
        }
        return;
      }

      // Revoke previous preview URL if exists
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }

      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setSelectedImage(file);
      setImagePreviewUrl(previewUrl);
      setIsFromCamera(fromCamera);
      resetZoom();

      // Navigate to preview state
      setViewState('preview');
    } catch (error) {
      console.error('Error processing image:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to process image. Please try again.';
      if (errorMessage.includes('HEIC') || errorMessage.includes('heic')) {
        handleHeicError();
      } else {
        setToast({
          message: errorMessage,
          type: 'error',
        });
      }
    } finally {
      setIsProcessing(false);
      // Reset input value to allow selecting the same file again
      event.target.value = '';
    }
  };

  /**
   * Handle Take Photo button click
   */
  const handleTakePhoto = () => {
    // Check if device has camera support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setToast({
        message:
          'Camera not supported on this device. Try choosing from gallery instead.',
        type: 'warning',
      });
      return;
    }

    // Trigger camera input
    cameraInputRef.current?.click();
  };

  /**
   * Handle Choose from Gallery button click
   */
  const handleChooseFromGallery = () => {
    galleryInputRef.current?.click();
  };

  /**
   * Handle camera input error (permission denied, etc.)
   */
  const handleCameraError = () => {
    setToast({
      message:
        'Camera access denied. Please allow camera access or choose from gallery instead.',
      type: 'error',
    });
  };

  /**
   * Handle Retake/Reselect button click
   */
  const handleRetake = () => {
    // Clean up current preview
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setSelectedImage(null);
    setImagePreviewUrl(null);
    resetZoom();
    setViewState('capture');
  };

  /**
   * Clear analysis timers
   */
  const clearAnalysisTimers = useCallback(() => {
    analysisTimersRef.current.forEach((timer) => clearTimeout(timer));
    analysisTimersRef.current = [];
  }, []);

  /**
   * Handle Cancel button click during analysis
   */
  const handleCancelAnalysis = useCallback(async () => {
    // Abort any ongoing request
    if (analysisAbortRef.current) {
      analysisAbortRef.current.abort();
    }

    // Clear timers
    clearAnalysisTimers();

    // If we uploaded images, clean them up
    if (analysisResult) {
      try {
        const extraThumbnailPaths = analysisResult.items
          .map((item) => item.thumbnail_path)
          .filter((path): path is string => Boolean(path))
          .filter((path) => path !== analysisResult.thumbnailPath);
        const uniqueExtraPaths = Array.from(new Set(extraThumbnailPaths));

        await Promise.all([
          deleteFromStorage(analysisResult.imagePath),
          deleteFromStorage(analysisResult.thumbnailPath),
          ...uniqueExtraPaths.map((path) => deleteFromStorage(path)),
        ]);
      } catch (error) {
        console.error('Failed to delete uploaded images:', error);
      }
    }

    // Reset state
    setAnalysisResult(null);
    setAnalysisError(null);
    setViewState('preview');
    setAnalysisPhase('uploading');
    setShowSingleItemChoice(false);
    setSingleDetectedItem(null);
    setIsQuickAdding(false);
  }, [analysisResult, clearAnalysisTimers]);

  /**
   * Call the analyze-image Edge Function
   */
  const analyzeImage = async (
    storagePath: string,
    signal: AbortSignal
  ): Promise<AnalyzeImageResponse> => {
    // Pass storage_path with bucket prefix for secure server-side download
    const fullStoragePath = `items/${storagePath}`;
    console.log('[AddItemPage] Calling analyze-image with storage_path:', fullStoragePath);

    // Supabase client automatically includes the Authorization header from the current session
    const { data, error } = await supabase.functions.invoke<AnalyzeImageResponse>(
      'analyze-image',
      {
        body: { storage_path: fullStoragePath },
      }
    );

    if (signal.aborted) {
      throw new Error('Analysis cancelled');
    }

    if (error) {
      throw new Error(error.message || 'Failed to analyze image');
    }

    if (!data) {
      throw new Error('No data returned from analysis');
    }

    return data;
  };

  const buildDetectedItemsWithThumbnails = useCallback(
    async (
      items: DetectedItem[],
      imageUrl: string,
      fallbackThumbnailUrl: string,
      fallbackThumbnailPath: string,
      signal: AbortSignal
    ): Promise<DetectedItem[]> => {
      if (!user) return items;

      const results: DetectedItem[] = [];

      for (const item of items) {
        if (signal.aborted) {
          throw new Error('Analysis cancelled');
        }

        const bbox = validateBbox(item.bbox) ? clampBbox(item.bbox) : DEFAULT_BBOX;
        const isFullImage =
          bbox[0] === 0 && bbox[1] === 0 && bbox[2] === 100 && bbox[3] === 100;
        // Also treat near-full-image bboxes (covering >90% of image) as full image
        const isNearFullImage =
          bbox[2] >= 90 && bbox[3] >= 90;
        const shouldCrop = validateBbox(item.bbox) && !isFullImage && !isNearFullImage;

        if (!shouldCrop) {
          results.push({
            ...item,
            bbox,
            thumbnail_url: fallbackThumbnailUrl,
            thumbnail_path: fallbackThumbnailPath,
          });
          continue;
        }

        try {
          const cropped = await cropImageToBbox(imageUrl, bbox);
          const filename = `${crypto.randomUUID()}_thumb.jpg`;
          const uploaded = await uploadToStorage(cropped, user.id, filename);

          results.push({
            ...item,
            bbox,
            thumbnail_url: uploaded.url,
            thumbnail_path: uploaded.path,
          });
        } catch (error) {
          console.warn('[AddItemPage] Failed to crop thumbnail, using full image.', error);
          results.push({
            ...item,
            bbox,
            thumbnail_url: fallbackThumbnailUrl,
            thumbnail_path: fallbackThumbnailPath,
          });
        }
      }

      return results;
    },
    [user]
  );

  /**
   * Handle Continue button click - starts AI analysis
   */
  const handleContinue = async () => {
    if (!selectedImage || !user) return;

    // Reset state
    setAnalysisPhase('uploading');
    setAnalysisResult(null);
    setAnalysisError(null);
    setShowSingleItemChoice(false);
    setSingleDetectedItem(null);
    setIsQuickAdding(false);
    setViewState('analyzing');

    // Create abort controller
    analysisAbortRef.current = new AbortController();
    const signal = analysisAbortRef.current.signal;

    try {
      // Upload image to storage
      const uploadResult = await processAndUploadImage(selectedImage, user.id);

      if (signal.aborted) {
        // Clean up uploaded files if cancelled during upload
        await Promise.all([
          deleteFromStorage(uploadResult.imagePath),
          deleteFromStorage(uploadResult.thumbnailPath),
        ]);
        return;
      }

      // Store upload result for potential cleanup
      setAnalysisResult({
        items: [],
        imageUrl: uploadResult.imageUrl,
        thumbnailUrl: uploadResult.thumbnailUrl,
        imagePath: uploadResult.imagePath,
        thumbnailPath: uploadResult.thumbnailPath,
      });

      // Start analyzing phase
      setAnalysisPhase('analyzing');

      // Set up timeout handlers
      // 5 seconds: still analyzing message (handled via analysisPhase duration)
      const timeoutTimer = setTimeout(() => {
        if (!signal.aborted) {
          setAnalysisPhase('timeout');
        }
      }, 15000);
      analysisTimersRef.current.push(timeoutTimer);

      // Call AI analysis using storage path for secure server-side download
      const analysisResponse = await analyzeImage(uploadResult.imagePath, signal);

      // Clear timers on success
      clearAnalysisTimers();

      if (signal.aborted) return;

      const detectedItems = analysisResponse.detected_items.length > 0
        ? await buildDetectedItemsWithThumbnails(
          analysisResponse.detected_items,
          uploadResult.imageUrl,
          uploadResult.thumbnailUrl,
          uploadResult.thumbnailPath,
          signal
        )
        : [];

      if (signal.aborted) return;

      // Update result with detected items
      const result: AnalysisResult = {
        items: detectedItems,
        imageUrl: uploadResult.imageUrl,
        thumbnailUrl: uploadResult.thumbnailUrl,
        imagePath: uploadResult.imagePath,
        thumbnailPath: uploadResult.thumbnailPath,
      };
      setAnalysisResult(result);

      // Handle results based on number of items detected
      if (detectedItems.length === 0) {
        // No items detected - show error state
        setAnalysisError("Couldn't identify any items in this photo.");
        setViewState('error');
      } else if (detectedItems.length === 1) {
        // Single item - show quick add choice screen
        setSingleDetectedItem(detectedItems[0]);
        setShowSingleItemChoice(true);
        setViewState('preview');
      } else {
        // Multiple items - show selection UI (US-028)
        setViewState('results');
      }
    } catch (error) {
      clearAnalysisTimers();

      if (signal.aborted) return;

      console.error('Analysis error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Analysis failed. Please try again.';
      if (errorMessage.includes('HEIC') || errorMessage.includes('heic')) {
        handleHeicError();
        setViewState('preview');
      } else {
        setAnalysisError(errorMessage);
        setViewState('error');
      }
    }
  };

  // Render capture view
  const renderCaptureView = () => (
    <div className="min-h-full flex flex-col bg-[#fdf8f2]">
      {/* Header */}
      <div className="flex-shrink-0 pt-6 pb-4 px-4">
        <h1 className="text-2xl font-bold text-[#4a3f35]">Add Item</h1>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-4 pb-6">
        {/* Helper Text */}
        <div className="mb-6 text-center">
          <p className="text-[#8d7b6d]">
            Take a photo of your item and AI will help identify it
          </p>
        </div>

        {/* Action Cards */}
        <div className="space-y-4">
          {/* Take Photo Card */}
          <button
            onClick={handleTakePhoto}
            disabled={isProcessing}
            className="w-full p-6 bg-white rounded-xl shadow-sm border border-[#f5ebe0]/60 hover:border-[#d6ccc2] hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-4">
              {/* Camera Icon */}
              <div className="w-14 h-14 rounded-full bg-[#f5ebe0] flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-7 h-7 text-[#4a3f35]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              {/* Text */}
              <div className="flex-1 text-left">
                <h3 className="text-lg font-semibold text-[#4a3f35]">
                  Take Photo
                </h3>
                <p className="text-sm text-[#8d7b6d]">
                  Use your camera to capture an item
                </p>
              </div>
              {/* Chevron */}
              <svg
                className="w-5 h-5 text-[#b9a99b]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>

          {/* Choose from Gallery Card */}
          <button
            onClick={handleChooseFromGallery}
            disabled={isProcessing}
            className="w-full p-6 bg-white rounded-xl shadow-sm border border-[#f5ebe0]/60 hover:border-[#d6ccc2] hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-4">
              {/* Gallery Icon */}
              <div className="w-14 h-14 rounded-full bg-[#e3ead3] flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-7 h-7 text-[#4a3f35]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              {/* Text */}
              <div className="flex-1 text-left">
                <h3 className="text-lg font-semibold text-[#4a3f35]">
                  Choose from Gallery
                </h3>
                <p className="text-sm text-[#8d7b6d]">
                  Select an existing photo from your device
                </p>
              </div>
              {/* Chevron */}
              <svg
                className="w-5 h-5 text-[#b9a99b]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>
        </div>

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="mt-6 flex items-center justify-center gap-2 text-[#8d7b6d]">
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Processing image...</span>
          </div>
        )}

        {/* Tips Section */}
        <div className="mt-8 p-4 bg-[#fdf8f2] rounded-lg">
          <h4 className="text-sm font-semibold text-[#4a3f35] mb-2">
            Tips for best results
          </h4>
          <ul className="text-sm text-[#8d7b6d] space-y-1">
            <li>• Ensure good lighting</li>
            <li>• Keep the item centered in the frame</li>
            <li>• Avoid blurry or dark photos</li>
            <li>• Include labels or brand names when visible</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderPreviewView = () => (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-black/80">
        <h2 className="text-lg font-semibold text-white">Preview Photo</h2>
        <button
          onClick={handleRetake}
          className="p-2 text-white/80 hover:text-white"
          aria-label="Close preview"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Image Preview with pinch-to-zoom */}
      <div
        ref={imageContainerRef}
        className="flex-1 overflow-hidden flex items-center justify-center touch-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleDoubleTap}
      >
        {imagePreviewUrl && (
          <img
            src={imagePreviewUrl}
            alt="Preview of selected item"
            className="max-w-full max-h-full object-contain select-none"
            style={{
              transform: `scale(${scale}) translate(${translateX / scale}px, ${translateY / scale}px)`,
              transition: isPinching ? 'none' : 'transform 0.2s ease-out',
            }}
            draggable={false}
          />
        )}
      </div>

      {/* Zoom indicator */}
      {scale > 1 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 rounded-full">
          <span className="text-sm text-white">{Math.round(scale * 100)}%</span>
        </div>
      )}

      {/* Helper text */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <p className="text-sm text-white/60">
          Pinch to zoom • Double-tap to reset
        </p>
      </div>

      {/* Bottom action buttons */}
      <div className="flex-shrink-0 px-4 py-4 bg-black/80 safe-area-pb">
        <div className="flex gap-3">
          {/* Retake/Reselect button */}
          <button
            onClick={handleRetake}
            className="flex-1 py-3 px-4 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {isFromCamera ? 'Retake' : 'Reselect'}
          </button>

          {/* Continue button */}
          <button
            onClick={handleContinue}
            className="flex-1 py-3 px-4 bg-[#4a3f35] text-white font-medium rounded-xl hover:bg-[#3d332b] transition-colors flex items-center justify-center gap-2"
          >
            Continue
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  const renderAnalyzingView = () => {
    const loadingText = getAnalysisLoadingText();

    return (
      <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center">
        {/* Background image preview (blurred) */}
        {imagePreviewUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30 blur-sm"
            style={{ backgroundImage: `url(${imagePreviewUrl})` }}
          />
        )}

        {/* Loading content */}
        <div className="relative z-10 flex flex-col items-center">
          {/* Spinner */}
          <div className="mb-6">
            <svg
              className="animate-spin h-16 w-16 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>

          {/* Loading text */}
          <p className="text-lg font-medium text-white mb-2">{loadingText}</p>

          {/* AI sparkle icon */}
          <div className="flex items-center gap-2 text-white/70">
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z" />
            </svg>
            <span className="text-sm">AI-powered recognition</span>
          </div>
        </div>

        {/* Timeout action buttons */}
        {analysisPhase === 'timeout' && (
          <div className="absolute bottom-8 left-4 right-4 flex gap-3">
            <button
              onClick={handleCancelAnalysis}
              className="flex-1 py-3 px-4 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => setAnalysisPhase('analyzing')}
              className="flex-1 py-3 px-4 bg-[#4a3f35] text-white font-medium rounded-xl hover:bg-[#3d332b] transition-colors"
            >
              Keep Waiting
            </button>
          </div>
        )}
      </div>
    );
  };

  /**
   * Handle proceeding with selected items from MultiItemSelection
   * Navigates to Item Editor with first item and queues remaining items
   */
  const handleMultiItemProceed = useCallback(
    (selectedItems: DetectedItem[], imageInfo: ImageInfo, sharedLocationId?: string | null) => {
      if (selectedItems.length === 0) return;

      const sourceBatchId = selectedItems.length > 1 ? crypto.randomUUID() : null;
      const firstItem = selectedItems[0];
      const thumbnailUrl = firstItem.thumbnail_url || imageInfo.thumbnailUrl;
      const thumbnailPath = firstItem.thumbnail_path || imageInfo.thumbnailPath;

      // Navigate to Item Editor with the first selected item
      // Pass remaining items as queue for sequential editing
      navigate('/add/edit', {
        state: {
          detectedItem: firstItem,
          imageUrl: imageInfo.imageUrl,
          thumbnailUrl,
          imagePath: imageInfo.imagePath,
          thumbnailPath,
          // Queue remaining items for sequential editing (US-035)
          itemQueue: selectedItems.slice(1),
          totalItems: selectedItems.length,
          currentItemIndex: 1,
          sourceBatchId,
          sharedLocationId: sharedLocationId ?? null,
        },
      });
    },
    [navigate]
  );

  const handleBatchSave = async (items: DetectedItem[], sharedLocationId?: string | null) => {
    if (!analysisResult || !user) return;

    // If no location selected, fall back to editor flow
    if (!sharedLocationId) {
      setToast({ message: 'Please select a location first to use quick add', type: 'error' });
      return;
    }

    setIsBatchSaving(true);
    setBatchSaveProgress({ current: 0, total: items.length });

    const sourceBatchId = items.length > 1 ? crypto.randomUUID() : null;
    let savedCount = 0;

    try {
      for (const item of items) {
        // Resolve category_suggestion to category_id
        const categoryId = item.category_suggestion
          ? categories.find(
              (c) => c.name.toLowerCase() === item.category_suggestion!.toLowerCase()
            )?.id ?? null
          : null;

        const thumbnailUrl = item.thumbnail_url || analysisResult.thumbnailUrl;

        // Build AI metadata
        const aiMetadata: ItemAIMetadata = {
          detected_name: item.name || undefined,
          detected_category: item.category_suggestion || undefined,
          detected_tags: item.tags || undefined,
          detected_brand: item.brand || undefined,
          confidence_score: item.confidence || undefined,
          detected_bbox: item.bbox || undefined,
          analysis_provider: 'openai',
          analysis_model: 'gpt-4o',
          analyzed_at: new Date().toISOString(),
        };

        const insertData = {
          user_id: user.id,
          photo_url: analysisResult.imageUrl,
          thumbnail_url: thumbnailUrl,
          source_batch_id: sourceBatchId,
          name: item.name || null,
          description: null,
          category_id: categoryId,
          tags: item.tags || [],
          location_id: sharedLocationId,
          quantity: 1,
          price: null,
          currency: 'CNY',
          purchase_date: null,
          expiration_date: null,
          brand: item.brand || null,
          model: null,
          notes: null,
          is_favorite: false,
          keep_forever: false,
          ai_metadata: aiMetadata,
          last_viewed_at: null,
        };

        const { data, error } = await (supabase
          .from('items') as ReturnType<typeof supabase.from>)
          .insert(insertData as Record<string, unknown>)
          .select('id')
          .single();

        if (error) throw error;

        // Generate embedding (non-blocking)
        generateItemEmbedding(data.id);

        savedCount++;
        setBatchSaveProgress({ current: savedCount, total: items.length });
      }

      // All saved — navigate to inventory
      navigate('/inventory', { replace: true });
    } catch (error) {
      console.error('Batch save error:', error);
      setToast({
        message: `Saved ${savedCount} of ${items.length} items. Error on remaining.`,
        type: 'error',
      });
    } finally {
      setIsBatchSaving(false);
    }
  };

  // Render results view - multiple items detected using MultiItemSelection component
  const renderResultsView = () => {
    if (!analysisResult) return null;

    return (
      <MultiItemSelection
        imageUrl={analysisResult.imageUrl}
        thumbnailUrl={analysisResult.thumbnailUrl}
        imagePath={analysisResult.imagePath}
        thumbnailPath={analysisResult.thumbnailPath}
        detectedItems={analysisResult.items}
        onBack={handleCancelAnalysis}
        onProceed={handleMultiItemProceed}
        onBatchSave={handleBatchSave}
        isBatchSaving={isBatchSaving}
        batchSaveProgress={batchSaveProgress}
      />
    );
  };

  const handleQuickAdd = async () => {
    // Location is required, so redirect to editor to select location
    handleEditDetails();
  };

  const handleEditDetails = () => {
    if (!analysisResult || !singleDetectedItem) return;

    navigate('/add/edit', {
      state: {
        detectedItem: singleDetectedItem,
        imageUrl: analysisResult.imageUrl,
        thumbnailUrl: singleDetectedItem.thumbnail_url || analysisResult.thumbnailUrl,
        imagePath: analysisResult.imagePath,
        thumbnailPath: singleDetectedItem.thumbnail_path || analysisResult.thumbnailPath,
        itemQueue: [],
        totalItems: 1,
        currentItemIndex: 1,
        fromQuickAdd: true,
      },
    });
  };

  const SingleItemChoiceView = () => {
    if (!analysisResult || !singleDetectedItem) return null;

    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#f5ebe0]/60">
          <button onClick={handleCancelAnalysis} className="p-2 -ml-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold">Item Detected</h1>
          <div className="w-10" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {/* Image Preview */}
          <div className="aspect-square w-full max-w-sm mx-auto rounded-xl overflow-hidden bg-[#f3ece4] mb-6">
            <img
              src={singleDetectedItem.thumbnail_url || analysisResult.thumbnailUrl || analysisResult.imageUrl}
              alt="Detected item"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Item Info */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-2">
              <h2 className="text-xl font-semibold">{singleDetectedItem.name}</h2>
              <svg className="w-5 h-5 text-[#fbc4ab]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z" />
              </svg>
            </div>
            {singleDetectedItem.category_suggestion && (
              <p className="text-[#8d7b6d]">{singleDetectedItem.category_suggestion}</p>
            )}
            {singleDetectedItem.tags && singleDetectedItem.tags.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mt-3">
                {singleDetectedItem.tags.slice(0, 5).map((tag, i) => (
                  <span key={i} className="px-2 py-1 bg-[#f3ece4] rounded-full text-sm text-[#8d7b6d]">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex-shrink-0 p-4 border-t border-[#f5ebe0]/60 space-y-3 safe-area-pb">
          <button
            onClick={handleQuickAdd}
            disabled={isQuickAdding}
            className="w-full px-4 py-3 bg-[#8d7b6d] rounded-xl text-white font-medium hover:bg-[#7c6b5d] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
            className="w-full px-4 py-3 border border-[#f5ebe0] rounded-xl text-[#6f5f52] font-medium hover:bg-[#fdf8f2] transition-colors disabled:opacity-50"
          >
            Edit Details
          </button>
        </div>
      </div>
    );
  };

  const renderErrorView = () => (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#f5ebe0]/60">
        <button
          onClick={handleCancelAnalysis}
          className="p-2 -ml-2 text-[#8d7b6d] hover:text-[#4a3f35]"
          aria-label="Go back"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-[#4a3f35]">Add Item</h2>
        <div className="w-10" /> {/* Spacer for centering */}
      </div>

      {/* Error content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {/* Error icon */}
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-6">
          <svg
            className="w-10 h-10 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Error message */}
        <h3 className="text-xl font-semibold text-[#4a3f35] mb-2">
          Couldn't Identify Items
        </h3>
        <p className="text-[#8d7b6d] text-center mb-8 max-w-xs">
          {analysisError || "We couldn't identify any items in this photo. You can try again or add the item manually."}
        </p>

        {/* Action buttons */}
        <div className="w-full max-w-xs space-y-3">
          <button
            onClick={() => {
              // Navigate to manual add with just the image
              if (analysisResult) {
                navigate('/add/edit', {
                  state: {
                    detectedItem: null,
                    imageUrl: analysisResult.imageUrl,
                    thumbnailUrl: analysisResult.thumbnailUrl,
                    imagePath: analysisResult.imagePath,
                    thumbnailPath: analysisResult.thumbnailPath,
                    // No queue for manual add
                    itemQueue: [],
                    totalItems: 1,
                    currentItemIndex: 1,
                  },
                });
              }
            }}
            className="w-full py-3 px-4 bg-[#4a3f35] text-white font-medium rounded-xl hover:bg-[#3d332b] transition-colors"
          >
            Add Manually
          </button>
          <button
            onClick={handleCancelAnalysis}
            className="w-full py-3 px-4 bg-[#f3ece4] text-[#6f5f52] font-medium rounded-xl hover:bg-[#efe6dc] transition-colors"
          >
            Try a Different Photo
          </button>
        </div>
      </div>
    </div>
  );

  // Render view based on current state
  const renderCurrentView = () => {
    if (showSingleItemChoice && singleDetectedItem) {
      return <SingleItemChoiceView />;
    }

    switch (viewState) {
      case 'capture':
        return renderCaptureView();
      case 'preview':
        return renderPreviewView();
      case 'analyzing':
        return renderAnalyzingView();
      case 'results':
        return renderResultsView();
      case 'error':
        return renderErrorView();
      default:
        return renderCaptureView();
    }
  };

  return (
    <>
      {renderCurrentView()}

      {/* Hidden File Inputs */}
      {/* Camera Input - uses capture="environment" for rear camera */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleFileSelect(e, true)}
        onError={handleCameraError}
        className="hidden"
        aria-label="Take photo with camera"
      />

      {/* Gallery Input */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => handleFileSelect(e, false)}
        className="hidden"
        aria-label="Choose from gallery"
      />

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <HeicErrorModal
        isOpen={showHeicErrorModal}
        onTakePhoto={handleHeicTakePhoto}
        onChooseDifferent={handleHeicChooseDifferent}
        onClose={() => setShowHeicErrorModal(false)}
      />
    </>
  );
}
