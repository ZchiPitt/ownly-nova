/**
 * Protected Route wrapper component
 * Ensures users are authenticated before accessing protected pages
 * Redirects unauthenticated users to login with redirect param
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Loading spinner component shown while checking auth status
 */
function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fdf8f2]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-[#4a3f35] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#a89887] text-sm">Loading...</p>
      </div>
    </div>
  );
}

/**
 * Wraps protected routes to ensure authentication
 * - Shows loading spinner while checking auth status
 * - Redirects to /login with redirect param if not authenticated
 * - Renders children when authenticated
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking auth status
  if (loading) {
    return <LoadingSpinner />;
  }

  // Redirect to login if not authenticated
  // Preserve original path in redirect param for post-login redirect
  if (!user) {
    const redirectParam = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirectParam}`} replace />;
  }

  // User is authenticated, render children
  return <>{children}</>;
}
