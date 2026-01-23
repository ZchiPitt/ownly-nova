/**
 * Reset Password Page - Password reset request form
 * Route: /reset-password
 *
 * Features:
 * - Email input for password reset request
 * - Send Reset Email button with loading state
 * - Helper text explaining the process
 * - Always shows success message after submit (security: doesn't reveal if email exists)
 * - Resend button with 60-second cooldown
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Toast } from '@/components/Toast';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Cooldown duration in seconds
const RESEND_COOLDOWN_SECONDS = 60;

export function ResetPasswordPage() {
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'info' } | null>(null);

  // Cooldown timer
  useEffect(() => {
    if (cooldownRemaining <= 0) return;

    const timer = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  // Email validation
  const emailError = useMemo(() => {
    if (email && !EMAIL_REGEX.test(email)) {
      return 'Please enter a valid email address';
    }
    return null;
  }, [email]);

  const isFormValid = useMemo(() => {
    return email.length > 0 && !emailError;
  }, [email, emailError]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    setTouched(true);

    if (!isFormValid || isSubmitting || cooldownRemaining > 0) {
      return;
    }

    setIsSubmitting(true);
    setToast(null);

    try {
      const { error } = await resetPassword(email);

      if (error) {
        // Even on error, we show success message for security
        // Only show error toast for network/unexpected errors
        if (error.message.toLowerCase().includes('network') ||
            error.message.toLowerCase().includes('fetch')) {
          setToast({ message: 'Network connection failed', type: 'error' });
          setIsSubmitting(false);
          return;
        }
        // For other errors (like rate limiting), still show success for security
      }

      // Always show success state (security: don't reveal if email exists)
      setIsSubmitted(true);
      setSubmittedEmail(email);
      setCooldownRemaining(RESEND_COOLDOWN_SECONDS);
    } catch {
      // Network or unexpected error
      setToast({ message: 'Network connection failed', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }, [email, isFormValid, isSubmitting, cooldownRemaining, resetPassword]);

  const handleResend = useCallback(() => {
    handleSubmit();
  }, [handleSubmit]);

  // Mask email for display (e.g., jo***@example.com)
  const maskedEmail = useMemo(() => {
    if (!submittedEmail) return '';
    const [localPart, domain] = submittedEmail.split('@');
    if (localPart.length <= 2) {
      return `${localPart}***@${domain}`;
    }
    return `${localPart.slice(0, 2)}***@${domain}`;
  }, [submittedEmail]);

  // Initial form view
  if (!isSubmitted) {
    return (
      <div className="min-h-screen flex flex-col bg-[#fdf8f2]">
        {/* Header */}
        <div className="flex-shrink-0 pt-12 pb-6 px-6">
          <h1 className="text-3xl font-bold text-[#4a3f35] text-center">
            Reset Password
          </h1>
          <p className="mt-2 text-[#8d7b6d] text-center">
            Enter your registered email address and we'll send you a link to reset your password.
          </p>
        </div>

        {/* Form */}
        <div className="flex-1 px-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[#6f5f52] mb-1"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched(true)}
                disabled={isSubmitting}
                className={`w-full px-4 py-3 rounded-lg border bg-white text-[#4a3f35] placeholder-[#b9a99b] focus:outline-none focus:ring-2 focus:ring-[#d6ccc2] focus:border-transparent transition-colors disabled:bg-[#f3ece4] disabled:cursor-not-allowed ${
                  touched && emailError
                    ? 'border-red-500'
                    : 'border-[#f5ebe0]'
                }`}
              />
              {touched && emailError && (
                <p className="mt-1 text-sm text-red-600">{emailError}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors flex items-center justify-center ${
                isFormValid && !isSubmitting
                  ? 'bg-[#4a3f35] hover:bg-[#3d332b] active:bg-[#332a22]'
                  : 'bg-[#e8dfd5] text-[#b9a99b] cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  {/* Loading Spinner */}
                  <svg
                    className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
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
                  Sending...
                </>
              ) : (
                'Send Reset Email'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 py-8 px-6">
          <p className="text-center text-[#8d7b6d]">
            Remember your password?{' '}
            <Link
              to="/login"
              className="text-[#6f5f52] font-semibold hover:text-[#4a3f35]"
            >
              Log in
            </Link>
          </p>
        </div>

        {/* Toast Notification */}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    );
  }

  // Success view (after submission)
  return (
    <div className="min-h-screen flex flex-col bg-[#fdf8f2]">
      {/* Header with success icon */}
      <div className="flex-shrink-0 pt-12 pb-6 px-6">
        {/* Success checkmark icon */}
        <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-[#4a3f35] text-center">
          Check Your Email
        </h1>
        <p className="mt-4 text-[#8d7b6d] text-center">
          Reset email sent to <span className="font-medium text-[#4a3f35]">{maskedEmail}</span>
        </p>
        <p className="mt-2 text-sm text-[#8d7b6d] text-center">
          If an account exists with this email, you'll receive a password reset link shortly.
        </p>
      </div>

      {/* Resend section */}
      <div className="flex-1 px-6 pt-4">
        <div className="text-center">
          <p className="text-[#8d7b6d] mb-4">
            Didn't receive the email?
          </p>
          <button
            onClick={handleResend}
            disabled={cooldownRemaining > 0 || isSubmitting}
            className={`py-3 px-6 rounded-lg font-semibold transition-colors ${
              cooldownRemaining > 0 || isSubmitting
                ? 'bg-[#efe6dc] text-[#8d7b6d] cursor-not-allowed'
                : 'bg-[#4a3f35] text-white hover:bg-[#3d332b] active:bg-[#332a22]'
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-5 w-5"
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
                Sending...
              </span>
            ) : cooldownRemaining > 0 ? (
              `Resend in ${cooldownRemaining}s`
            ) : (
              'Resend Email'
            )}
          </button>
        </div>

        {/* Tips section */}
        <div className="mt-8 p-4 bg-[#f3ece4] rounded-lg">
          <p className="text-sm text-[#6f5f52] font-medium mb-2">
            Tips if you don't see the email:
          </p>
          <ul className="text-sm text-[#8d7b6d] space-y-1 list-disc list-inside">
            <li>Check your spam or junk folder</li>
            <li>Make sure you entered the correct email</li>
            <li>Wait a few minutes for the email to arrive</li>
          </ul>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 py-8 px-6">
        <p className="text-center text-[#8d7b6d]">
          <Link
            to="/login"
            className="text-[#6f5f52] font-semibold hover:text-[#4a3f35]"
          >
            ← Back to Log in
          </Link>
        </p>
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
