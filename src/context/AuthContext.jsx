import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { isSupabaseConfigured } from '../lib/env';
import { supabase } from '../lib/supabase';
import {
  fetchAuthenticatedProfile,
  registerClientAccount,
  requestPasswordResetEmail,
  signInWithEmailPassword,
  signOutCurrentUser,
  updateAuthenticatedPassword,
  updateOwnBasicProfile,
} from '../services/authService';
import { canRolePerform, hasAllowedRole } from '../utils/rbac';
import { AuthContext } from './authContextInstance';

const EMPTY_AUTH_STATE = {
  user: null,
  session: null,
  profile: null,
  role: null,
  isAuthenticated: false,
  isLoading: true,
  isActive: false,
};

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(() =>
    isSupabaseConfigured && supabase
      ? EMPTY_AUTH_STATE
      : { ...EMPTY_AUTH_STATE, isLoading: false },
  );
  const [authNotice, setAuthNotice] = useState(null);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  const mountedRef = useRef(true);
  const requestSeqRef = useRef(0);
  const signingOutDisabledRef = useRef(false);

  const clearPrivateState = useCallback((loading = false) => {
    if (!mountedRef.current) return;
    setAuthState({
      user: null,
      session: null,
      profile: null,
      role: null,
      isAuthenticated: false,
      isLoading: loading,
      isActive: false,
    });
  }, []);

  const hydrateFromSession = useCallback(
    async (nextSession) => {
      const seq = ++requestSeqRef.current;

      if (!nextSession?.user) {
        clearPrivateState(false);
        return;
      }

      const profileResult = await fetchAuthenticatedProfile(nextSession.user.id);

      // Ignorar respuestas obsoletas si ocurrió otro cambio de sesión mientras resolvía
      if (!mountedRef.current || seq !== requestSeqRef.current) {
        return;
      }

      // Bloqueo inmediato y cierre de sesión si la cuenta está desactivada (profiles.is_active === false)
      if (
        profileResult.error?.code === 'ACCOUNT_DISABLED' ||
        profileResult.profile?.is_active === false
      ) {
        setAuthNotice(
          'Tu cuenta se encuentra desactivada. Se cerró la sesión por seguridad.',
        );
        clearPrivateState(false);

        if (!signingOutDisabledRef.current && supabase) {
          signingOutDisabledRef.current = true;
          try {
            await supabase.auth.signOut();
          } finally {
            signingOutDisabledRef.current = false;
          }
        }
        return;
      }

      // Denegación por defecto cuando no es posible verificar perfil o rol en PostgreSQL
      if (
        profileResult.error ||
        !profileResult.profile ||
        !profileResult.role
      ) {
        setAuthNotice(
          profileResult.error?.message ||
            'No fue posible verificar tu perfil de autorización.',
        );
        clearPrivateState(false);

        if (!signingOutDisabledRef.current && supabase) {
          signingOutDisabledRef.current = true;
          try {
            await supabase.auth.signOut();
          } finally {
            signingOutDisabledRef.current = false;
          }
        }
        return;
      }

      setAuthState({
        user: nextSession.user,
        session: nextSession,
        profile: profileResult.profile,
        role: profileResult.role,
        isAuthenticated: true,
        isLoading: false,
        isActive: true,
      });
    },
    [clearPrivateState],
  );

  useEffect(() => {
    mountedRef.current = true;

    if (!isSupabaseConfigured || !supabase) {
      return () => {
        mountedRef.current = false;
      };
    }

    let initialResolved = false;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mountedRef.current || initialResolved) return;
        initialResolved = true;
        if (error || !data?.session) {
          clearPrivateState(false);
          return;
        }
        hydrateFromSession(data.session);
      })
      .catch(() => {
        if (!mountedRef.current || initialResolved) return;
        initialResolved = true;
        clearPrivateState(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mountedRef.current) return;
      initialResolved = true;

      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
      }

      if (event === 'SIGNED_OUT' || !nextSession) {
        requestSeqRef.current += 1;
        setIsRecoveryMode(false);
        clearPrivateState(false);
        return;
      }

      if (
        event === 'INITIAL_SESSION' ||
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED' ||
        event === 'PASSWORD_RECOVERY'
      ) {
        hydrateFromSession(nextSession);
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [clearPrivateState, hydrateFromSession]);

  const signIn = useCallback(async (credentials) => {
    setAuthNotice(null);
    const result = await signInWithEmailPassword(credentials);

    if (!result.error && result.data && mountedRef.current) {
      requestSeqRef.current += 1;
      setAuthState({
        user: result.data.user,
        session: result.data.session,
        profile: result.data.profile,
        role: result.data.role,
        isAuthenticated: true,
        isLoading: false,
        isActive: true,
      });
    }

    return result;
  }, []);

  const signUp = useCallback(async (payload) => {
    setAuthNotice(null);
    return await registerClientAccount(payload);
  }, []);

  const signOut = useCallback(async () => {
    requestSeqRef.current += 1;
    setIsRecoveryMode(false);
    const result = await signOutCurrentUser();
    clearPrivateState(false);
    return result;
  }, [clearPrivateState]);

  const requestPasswordReset = useCallback(async (payload) => {
    return await requestPasswordResetEmail(payload);
  }, []);

  const updatePassword = useCallback(async (payload) => {
    const result = await updateAuthenticatedPassword(payload);
    if (!result.error && mountedRef.current) {
      setIsRecoveryMode(false);
    }
    return result;
  }, []);

  const currentUserId = authState.user?.id ?? null;

  const updateProfile = useCallback(
    async (payload) => {
      if (!currentUserId) {
        return {
          data: null,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Inicia sesión para actualizar tu perfil.',
          },
        };
      }

      const result = await updateOwnBasicProfile(currentUserId, payload);
      if (!result.error && result.profile && mountedRef.current) {
        setAuthState((prev) => ({
          ...prev,
          profile: result.profile,
          role: result.role ?? prev.role,
        }));
      }
      return result;
    },
    [currentUserId],
  );

  const refreshProfile = useCallback(async () => {
    if (!authState.session) return null;
    await hydrateFromSession(authState.session);
    return null;
  }, [authState.session, hydrateFromSession]);

  const clearAuthNotice = useCallback(() => setAuthNotice(null), []);

  const value = useMemo(
    () => ({
      ...authState,
      authNotice,
      isRecoveryMode,
      clearAuthNotice,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      updateProfile,
      refreshProfile,
      hasRole: (allowedRoles) => hasAllowedRole(authState.role, allowedRoles),
      can: (capability) => canRolePerform(authState.role, capability),
    }),
    [
      authState,
      authNotice,
      isRecoveryMode,
      clearAuthNotice,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      updateProfile,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
