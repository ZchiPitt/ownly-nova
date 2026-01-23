/**
 * Login Page - User login form
 * Route: /login
 *
 * Features:
 * - Email and password inputs
 * - Log in button with loading state during submission
 * - Forgot password? link to /reset-password
 * - Footer link to signup page
 * - Redirect to dashboard on successful login (or redirect param if present)
 * - Redirect authenticated users to dashboard
 */

import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Toast } from '@/components/Toast';

// Types for location state from password reset
interface LocationState {
  passwordResetSuccess?: boolean;
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormData {
  email: string;
  password: string;
}

interface FormErrors {
  email: string | null;
  password: string | null;
}

interface FormTouched {
  email: boolean;
  password: boolean;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { signIn, user, loading: authLoading } = useAuth();

  // Check for password reset success from location state
  const locationState = location.state as LocationState | null;

  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
  });

  const [touched, setTouched] = useState<FormTouched>({
    email: false,
    password: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Initialize toast state based on location state (password reset success)
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'info' | 'success' } | null>(
    () => locationState?.passwordResetSuccess
      ? { message: 'Password reset successfully', type: 'success' }
      : null
  );

  // Clear location state after showing toast to prevent re-showing on navigation
  useEffect(() => {
    if (locationState?.passwordResetSuccess) {
      // Clear the state to prevent showing the toast again on refresh
      window.history.replaceState({}, document.title);
    }
  }, [locationState]);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!authLoading && user) {
      const redirectTo = searchParams.get('redirect');
      navigate(redirectTo ? decodeURIComponent(redirectTo) : '/dashboard', { replace: true });
    }
  }, [user, authLoading, navigate, searchParams]);

  // Compute validation errors based on current form data
  const errors = useMemo<FormErrors>(() => {
    const newErrors: FormErrors = {
      email: null,
      password: null,
    };

    // Email validation
    if (formData.email && !EMAIL_REGEX.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation (must not be empty)
    if (formData.password && formData.password.length === 0) {
      newErrors.password = 'Password is required';
    }

    return newErrors;
  }, [formData]);

  // Check if form is valid (all fields filled and no errors)
  const isFormValid = useMemo(() => {
    return (
      formData.email.length > 0 &&
      formData.password.length > 0 &&
      !errors.email &&
      !errors.password
    );
  }, [formData, errors]);

  const handleInputChange = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleBlur = (field: keyof FormTouched) => () => {
    setTouched((prev) => ({
      ...prev,
      [field]: true,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched to show any validation errors
    setTouched({
      email: true,
      password: true,
    });

    if (!isFormValid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setLoginError(null);
    setToast(null);

    try {
      const { error } = await signIn(formData.email, formData.password);

      if (error) {
        // Check for invalid credentials error
        if (
          error.message.toLowerCase().includes('invalid login credentials') ||
          error.message.toLowerCase().includes('invalid email or password')
        ) {
          setLoginError('Invalid email or password');
        } else if (
          error.message.toLowerCase().includes('email not confirmed') ||
          error.message.toLowerCase().includes('email_not_confirmed')
        ) {
          setLoginError('Please verify your email address before logging in');
        } else {
          // Other errors - show as toast
          setToast({ message: error.message, type: 'error' });
        }
        setIsSubmitting(false);
        return;
      }

      // Success: redirect to dashboard or redirect param
      // The useEffect will handle the redirect when user state updates
    } catch {
      // Network or unexpected error
      setToast({ message: 'Network connection failed', type: 'error' });
      setIsSubmitting(false);
    }
  };


  return (
    <div className="min-h-screen flex flex-col bg-[#fdf8f2]">
      {/* Header */}
      <div className="flex-shrink-0 pt-12 pb-6 px-6">
        <h1 className="text-3xl font-bold text-[#4a3f35] text-center">
          Welcome Back
        </h1>
        <p className="mt-2 text-[#8d7b6d] text-center">
          Log in to manage your inventory
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
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleInputChange('email')}
              onBlur={handleBlur('email')}
              disabled={isSubmitting}
              className={`w-full px-4 py-3 rounded-xl border bg-white text-[#4a3f35] placeholder-[#b9a99b] focus:outline-none focus:ring-2 focus:ring-[#d6ccc2] focus:border-transparent transition-colors disabled:bg-[#f3ece4] disabled:cursor-not-allowed ${touched.email && errors.email
                  ? 'border-red-500'
                  : 'border-[#f5ebe0]'
                }`}
            />
            {touched.email && errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email}</p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[#6f5f52]"
              >
                Password
              </label>
              <Link
                to="/reset-password"
                className="text-sm text-[#6f5f52] hover:text-[#4a3f35]"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleInputChange('password')}
              onBlur={handleBlur('password')}
              disabled={isSubmitting}
              className={`w-full px-4 py-3 rounded-xl border bg-white text-[#4a3f35] placeholder-[#b9a99b] focus:outline-none focus:ring-2 focus:ring-[#d6ccc2] focus:border-transparent transition-colors disabled:bg-[#f3ece4] disabled:cursor-not-allowed ${touched.password && errors.password
                  ? 'border-red-500'
                  : 'border-[#f5ebe0]'
                }`}
            />
            {touched.password && errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password}</p>
            )}
          </div>

          {/* Login Error Message */}
          {loginError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-600">{loginError}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className={`w-full py-3 px-4 rounded-xl font-semibold text-white transition-colors flex items-center justify-center ${isFormValid && !isSubmitting
                ? 'bg-[#8d7b6d] hover:bg-[#7c6b5d] active:bg-[#332a22]'
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
                Logging in...
              </>
            ) : (
              'Log in'
            )}
          </button>
        </form>

      </div>

      {/* Footer */}
      <div className="flex-shrink-0 py-8 px-6">
        <p className="text-center text-[#8d7b6d]">
          Don't have an account?{' '}
          <Link
            to="/signup"
            className="text-[#6f5f52] font-semibold hover:text-[#4a3f35]"
          >
            Sign up
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
