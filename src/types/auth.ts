/**
 * Authentication types for Ownly
 */

import type { User, Session, AuthError } from '@supabase/supabase-js';

/**
 * Authentication context value interface
 */
export interface AuthContextValue {
  /** Current authenticated user */
  user: User | null;
  /** Current session */
  session: Session | null;
  /** Whether auth state is being loaded */
  loading: boolean;
  /** Sign up with email and password */
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  /** Sign in with email and password */
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  /** Sign out the current user */
  signOut: () => Promise<{ error: AuthError | null }>;
  /** Send password reset email */
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  /** Update password (after reset or for logged in user) */
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
  /** Sign in with Google OAuth */
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
}
