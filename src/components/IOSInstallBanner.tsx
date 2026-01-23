/**
 * Install Instructions Banner for iOS Safari PWA installation
 * US-071: Create install instructions for iOS Safari
 *
 * Shows an instructional banner for iOS Safari users explaining how to
 * add the app to their home screen manually via Share > Add to Home Screen.
 *
 * Display conditions (same as Android banner):
 * - Running on iOS Safari (not Chrome, Firefox, etc.)
 * - User has viewed 2+ pages
 * - User has spent 30+ seconds
 * - Banner not dismissed within 30 days
 * - App not already installed (standalone mode)
 */

import { useState } from 'react';
import { useIOSInstallPrompt } from '@/hooks/useIOSInstallPrompt';

interface IOSInstallBannerProps {
  /** Callback when user dismisses the banner */
  onDismiss?: () => void;
}

export function IOSInstallBanner({ onDismiss }: IOSInstallBannerProps) {
  const { shouldShowBanner, dismissBanner } = useIOSInstallPrompt();

  const [isClosing, setIsClosing] = useState(false);

  // Don't render if shouldn't show
  if (!shouldShowBanner || isClosing) {
    return null;
  }

  const handleDismiss = () => {
    // Start closing animation
    setIsClosing(true);

    // Wait for animation then dismiss
    setTimeout(() => {
      dismissBanner();
      onDismiss?.();
    }, 300);
  };

  return (
    <div
      className={`fixed bottom-24 left-0 right-0 z-40 px-4 pb-4 transition-all duration-300 ${
        isClosing ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
      }`}
    >
      <div className="mx-auto max-w-md bg-[#fdf8f2] rounded-2xl shadow-2xl border border-[#f5ebe0] overflow-hidden">
        {/* Main content */}
        <div className="p-4">
          {/* Header with app icon */}
          <div className="flex items-start gap-4">
            {/* App icon */}
            <div className="flex-shrink-0">
              <img
                src="/icons/icon-192x192.png"
                alt="Ownly"
                className="w-14 h-14 rounded-xl shadow-md"
              />
            </div>

            {/* Text content */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[#4a3f35] text-base">
                Install this app
              </h3>
              <p className="text-sm text-[#a89887] mt-0.5">
                Add Ownly to your Home Screen for quick access
              </p>
            </div>
          </div>

          {/* Installation instructions */}
          <div className="mt-4 bg-white rounded-xl p-3">
            <p className="text-sm text-[#4a3f35] flex items-center gap-2">
              <span>Tap</span>
              {/* Share icon (iOS style) */}
              <span className="inline-flex items-center justify-center w-7 h-7 bg-[#f5ebe0] rounded-lg">
                <svg
                  className="w-4 h-4 text-[#4a3f35]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
              </span>
              <span>then</span>
              <span className="font-medium text-[#4a3f35]">"Add to Home Screen"</span>
            </p>
          </div>
        </div>

        {/* Got It button */}
        <div className="px-4 pb-4">
          <button
            onClick={handleDismiss}
            className="w-full px-4 py-2.5 text-sm font-medium text-[#8d7b6d] bg-[#f5ebe0] rounded-xl hover:bg-[#efe5d8] transition-colors"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
