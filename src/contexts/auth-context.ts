/**
 * Auth Context - shared context instance
 * Separated from the Provider component for Fast Refresh compatibility
 */

import { createContext } from 'react';
import type { AuthContextValue } from '@/types/auth';

/**
 * Authentication context
 * Use useAuth() hook to access this context
 */
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
