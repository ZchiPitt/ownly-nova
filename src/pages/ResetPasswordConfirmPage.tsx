/**
 * Reset Password Confirm Page - Set new password from reset link
 * Route: /reset-password/confirm
 *
 * Features:
 * - New password and confirm password inputs
 * - Password validation (min 8 chars, must match)
 * - On success: redirect to /login with success toast
 * - On expired/invalid token: show error with Request New Link button
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Toast } from '@/components/Toast';
import { supabase } from '@/lib/supabase';

// Password validation constants
const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordConfirmPage() {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState({
    password: false,
    confirmPassword: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  // Track if the token is valid/expired
  const [tokenStatus, setTokenStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');

  // Check for valid session on mount (Supabase handles token verification)
  useEffect(() => {
    const checkSession = async () => {
      // Supabase automatically handles the token from the URL hash
      // and creates a session if valid
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        // Token is invalid or expired
        setTokenStatus('invalid');
      } else {
        setTokenStatus('valid');
      }
    };

    // Listen for auth state changes (in case Supabase is still processing the token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Supabase has processed the recovery link
        setTokenStatus('valid');
      } else if (event === 'SIGNED_IN' && session) {
        // User is signed in via recovery link
        setTokenStatus('valid');
      }
    });

    // Initial check after a short delay to allow Supabase to process the URL
    const timer = setTimeout(checkSession, 500);

    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  // Password validation
  const passwordError = useMemo(() => {
    if (password && password.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }
    return null;
  }, [password]);

  const confirmPasswordError = useMemo(() => {
    if (confirmPassword && password !== confirmPassword) {
      return 'Passwords do not match';
    }
    return null;
  }, [password, confirmPassword]);

  const isFormValid = useMemo(() => {
    return (
      password.length >= MIN_PASSWORD_LENGTH &&
      confirmPassword.length > 0 &&
      password === confirmPassword
    );
  }, [password, confirmPassword]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    setTouched({ password: true, confirmPassword: true });

    if (!isFormValid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setToast(null);

    try {
      const { error } = await updatePassword(password);

      if (error) {
        // Check for specific error types
        const errorMessage = error.message.toLowerCase();

        if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
          setToast({ message: 'Network connection failed', type: 'error' });
        } else if (errorMessage.includes('expired') || errorMessage.includes('invalid')) {
          // Token expired during the process
          setTokenStatus('invalid');
        } else {
          setToast({ message: 'Failed to reset password. Please try again.', type: 'error' });
        }
        setIsSubmitting(false);
        return;
      }

      // Success - sign out and redirect to login
      await supabase.auth.signOut();

      // Navigate to login with success message via state
      navigate('/login', {
        replace: true,
        state: { passwordResetSuccess: true },
      });
    } catch {
      setToast({ message: 'Network connection failed', type: 'error' });
      setIsSubmitting(false);
    }
  }, [password, isFormValid, isSubmitting, updatePassword, navigate]);

  // Loading state while checking token
  if (tokenStatus === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fdf8f2]">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#4a3f35] border-t-transparent" />
        <p className="mt-4 text-[#8d7b6d]">Verifying reset link...</p>
      </div>
    );
  }

  // Invalid/expired token state
  if (tokenStatus === 'invalid') {
    return (
      <div className="min-h-screen flex flex-col bg-[#fdf8f2]">
        {/* Header with error icon */}
        <div className="flex-shrink-0 pt-12 pb-6 px-6">
          {/* Error icon */}
          <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-red-600"
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
          <h1 className="text-2xl font-bold text-[#4a3f35] text-center">
            Link Expired
          </h1>
          <p className="mt-4 text-[#8d7b6d] text-center">
            This password reset link has expired or is invalid.
          </p>
          <p className="mt-2 text-sm text-[#8d7b6d] text-center">
            Password reset links are valid for a limited time for security reasons.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex-1 px-6 pt-4">
          <div className="space-y-4">
            <Link
              to="/reset-password"
              className="block w-full py-3 px-4 rounded-lg font-semibold text-white text-center bg-[#4a3f35] hover:bg-[#3d332b] active:bg-[#332a22] transition-colors"
            >
              Request New Link
            </Link>
            <Link
              to="/login"
              className="block w-full py-3 px-4 rounded-lg font-semibold text-[#6f5f52] text-center bg-[#efe6dc] hover:bg-[#f5ebe0] active:bg-[#e8dfd5] transition-colors"
            >
              Back to Log in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Valid token - show password reset form
  return (
    <div className="min-h-screen flex flex-col bg-[#fdf8f2]">
      {/* Header */}
      <div className="flex-shrink-0 pt-12 pb-6 px-6">
        <h1 className="text-3xl font-bold text-[#4a3f35] text-center">
          Set New Password
        </h1>
        <p className="mt-2 text-[#8d7b6d] text-center">
          Enter your new password below.
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 px-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* New Password Field */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-[#6f5f52] mb-1"
            >
              New Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              autoFocus
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched({ ...touched, password: true })}
              disabled={isSubmitting}
              className={`w-full px-4 py-3 rounded-lg border bg-white text-[#4a3f35] placeholder-[#b9a99b] focus:outline-none focus:ring-2 focus:ring-[#d6ccc2] focus:border-transparent transition-colors disabled:bg-[#f3ece4] disabled:cursor-not-allowed ${
                touched.password && passwordError
                  ? 'border-red-500'
                  : 'border-[#f5ebe0]'
              }`}
            />
            {touched.password && passwordError && (
              <p className="mt-1 text-sm text-red-600">{passwordError}</p>
            )}
          </div>

          {/* Confirm Password Field */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-[#6f5f52] mb-1"
            >
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={() => setTouched({ ...touched, confirmPassword: true })}
              disabled={isSubmitting}
              className={`w-full px-4 py-3 rounded-lg border bg-white text-[#4a3f35] placeholder-[#b9a99b] focus:outline-none focus:ring-2 focus:ring-[#d6ccc2] focus:border-transparent transition-colors disabled:bg-[#f3ece4] disabled:cursor-not-allowed ${
                touched.confirmPassword && confirmPasswordError
                  ? 'border-red-500'
                  : 'border-[#f5ebe0]'
              }`}
            />
            {touched.confirmPassword && confirmPasswordError && (
              <p className="mt-1 text-sm text-red-600">{confirmPasswordError}</p>
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
                Resetting Password...
              </>
            ) : (
              'Reset Password'
            )}
          </button>
        </form>

        {/* Password requirements hint */}
        <div className="mt-6 p-4 bg-[#f3ece4] rounded-lg">
          <p className="text-sm text-[#6f5f52] font-medium mb-2">
            Password requirements:
          </p>
          <ul className="text-sm text-[#8d7b6d] space-y-1 list-disc list-inside">
            <li className={password.length >= MIN_PASSWORD_LENGTH ? 'text-green-600' : ''}>
              At least {MIN_PASSWORD_LENGTH} characters
            </li>
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
