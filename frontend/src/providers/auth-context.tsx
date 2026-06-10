import React, { createContext, useEffect, useState, useCallback } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { authService, UserProfile } from '@/lib/auth-service';

export interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signUp: (email: string, password: string, fullName: string, username: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    // Add a fallback timeout in case Firebase auth hangs (e.g. emulator issues)
    const fallbackTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn('Firebase auth state check timed out. Forcing loading to false.');
        setLoading(false);
      }
    }, 10000);

    let unsubscribe: (() => void) | undefined;
    
    try {
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (!isMounted) return;
        
        try {
          setUser(firebaseUser);

          if (firebaseUser) {
            // Add a timeout specifically for profile fetching
            const profilePromise = authService.getUserProfile(firebaseUser.uid);
            const timeoutPromise = new Promise<null>((resolve) => 
              setTimeout(() => resolve(null), 5000)
            );
            
            // Race the profile fetch against a 5s timeout
            const profile = await Promise.race([profilePromise, timeoutPromise]);
            
            if (isMounted && profile) {
              setUserProfile(profile);
            }
          } else {
            if (isMounted) {
              setUserProfile(null);
            }
          }
        } catch (err) {
          console.error('Auth state change error:', err);
        } finally {
          clearTimeout(fallbackTimeout);
          if (isMounted) {
            setLoading(false);
          }
        }
      });
    } catch (err) {
      console.error('Synchronous error setting up Firebase Auth:', err);
      // If it fails immediately (e.g. invalid API key), force loading false so we don't hang
      if (isMounted) {
        setLoading(false);
      }
    }

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimeout);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, fullName: string, username: string) => {
      try {
        setError(null);
        setLoading(true);
        await authService.signUpWithEmail(email, password, fullName, username);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Sign up failed';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);
      await authService.signInWithEmail(email, password);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sign in failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSignInWithGoogle = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      await authService.signInWithGoogle();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Google sign-in failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      setError(null);
      await authService.signOut();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sign out failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
    error,
    signUp,
    signIn,
    signInWithGoogle: handleSignInWithGoogle,
    signOut: handleSignOut,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
