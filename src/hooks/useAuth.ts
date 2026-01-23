/**
 * useAuth hook for consuming AuthContext
 * Provides type-safe access to authentication state and methods
 */

import { useContext } from 'react';
import { AuthContext } from '@/contexts';

/**
 * Hook to access authentication context
 * @throws Error if used outside of AuthProvider
 * @returns AuthContextValue with user, session, loading, and auth methods
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
