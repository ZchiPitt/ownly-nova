/**
 * Signup Page - User registration form
 * Route: /signup
 *
 * Features:
 * - Email, password, confirm password inputs
 * - Real-time validation (email format, password min 8 chars, passwords match)
 * - Inline validation errors below each field
 * - Create Account button disabled until all validations pass
 * - Loading spinner during form submission
 * - Error handling for email exists, network, and other errors
 * - Auto-login and redirect to /dashboard on success
 * - Footer link to login page
 */

import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Toast } from '@/components/Toast';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  email: string | null;
  password: string | null;
  confirmPassword: string | null;
}

interface FormTouched {
  email: boolean;
  password: boolean;
  confirmPassword: boolean;
}

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export function SignupPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [touched, setTouched] = useState<FormTouched>({
    email: false,
    password: false,
    confirmPassword: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showEmailExistsError, setShowEmailExistsError] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Compute validation errors based on current form data
  const errors = useMemo<FormErrors>(() => {
    const newErrors: FormErrors = {
      email: null,
      password: null,
      confirmPassword: null,
    };

    // Email validation
    if (formData.email && !EMAIL_REGEX.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation (min 8 characters)
    if (formData.password && formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    // Confirm password validation
    if (formData.confirmPassword && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    return newErrors;
  }, [formData]);

  // Check if form is valid (all fields filled and no errors)
  const isFormValid = useMemo(() => {
    return (
      formData.email.length > 0 &&
      formData.password.length > 0 &&
      formData.confirmPassword.length > 0 &&
      !errors.email &&
      !errors.password &&
      !errors.confirmPassword
    );
  }, [formData, errors]);

  const handleInputChange = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
    // Clear email exists error when user modifies email
    if (field === 'email') {
      setShowEmailExistsError(false);
      setSubmitError(null);
    }
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
      confirmPassword: true,
    });

    if (!isFormValid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setShowEmailExistsError(false);

    try {
      const { error } = await signUp(formData.email, formData.password);

      if (error) {
        // Handle specific error cases
        const errorMessage = error.message.toLowerCase();

        if (
          errorMessage.includes('user already registered') ||
          errorMessage.includes('email already') ||
          errorMessage.includes('already exists')
        ) {
          // Email already exists
          setShowEmailExistsError(true);
          setSubmitError('This email is already registered');
        } else if (
          errorMessage.includes('network') ||
          errorMessage.includes('fetch') ||
          errorMessage.includes('connection')
        ) {
          // Network error
          setToast({
            message: 'Network connection failed',
            type: 'error',
          });
        } else {
          // Other errors
          setToast({
            message: 'Registration failed. Please try again later',
            type: 'error',
          });
        }
      } else {
        // Success - Supabase auto-signs in after signup (if email confirmation is disabled)
        // Navigate to dashboard
        navigate('/dashboard', { replace: true });
      }
    } catch {
      // Unexpected error (network issues, etc.)
      setToast({
        message: 'Network connection failed',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="min-h-screen flex flex-col bg-[#fdf8f2]">
      {/* Header */}
      <div className="flex-shrink-0 pt-12 pb-6 px-6">
        <h1 className="text-3xl font-bold text-[#4a3f35] text-center">
          Create Account
        </h1>
        <p className="mt-2 text-[#8d7b6d] text-center">
          Start organizing your belongings today
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
              className={`w-full px-4 py-3 rounded-xl border bg-white text-[#4a3f35] placeholder-[#b9a99b] focus:outline-none focus:ring-2 focus:ring-[#d6ccc2] focus:border-transparent transition-colors disabled:bg-[#f3ece4] disabled:cursor-not-allowed ${(touched.email && errors.email) || showEmailExistsError
                ? 'border-red-500'
                : 'border-[#f5ebe0]'
                }`}
            />
            {touched.email && errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email}</p>
            )}
            {showEmailExistsError && submitError && (
              <p className="mt-1 text-sm text-red-600">
                {submitError}{' '}
                <Link
                  to="/login"
                  className="text-[#6f5f52] font-semibold hover:text-[#4a3f35] underline"
                >
                  Log in
                </Link>
              </p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-[#6f5f52] mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="Min. 8 characters"
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
              value={formData.confirmPassword}
              onChange={handleInputChange('confirmPassword')}
              onBlur={handleBlur('confirmPassword')}
              disabled={isSubmitting}
              className={`w-full px-4 py-3 rounded-xl border bg-white text-[#4a3f35] placeholder-[#b9a99b] focus:outline-none focus:ring-2 focus:ring-[#d6ccc2] focus:border-transparent transition-colors disabled:bg-[#f3ece4] disabled:cursor-not-allowed ${touched.confirmPassword && errors.confirmPassword
                ? 'border-red-500'
                : 'border-[#f5ebe0]'
                }`}
            />
            {touched.confirmPassword && errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">
                {errors.confirmPassword}
              </p>
            )}
          </div>

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
                Creating Account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

      </div>

      {/* Footer */}
      <div className="flex-shrink-0 py-8 px-6">
        <p className="text-center text-[#8d7b6d]">
          Already have an account?{' '}
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
