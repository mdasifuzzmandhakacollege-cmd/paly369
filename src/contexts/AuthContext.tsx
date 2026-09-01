import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, RecaptchaVerifier, ConfirmationResult } from 'firebase/auth';
import {
  auth,
  googleSignIn as libGoogleSignIn,
  registerWithEmail as libRegisterWithEmail,
  loginWithEmail as libLoginWithEmail,
  sendPasswordReset as libSendPasswordReset,
  logout as libLogout,
  initAuth,
  createRecaptchaVerifier as libCreateRecaptchaVerifier,
  signInWithPhone as libSignInWithPhone,
  confirmOtpCode as libConfirmOtpCode
} from '../lib/firebase';
import { firebaseFirestore } from '../services/firebaseFirestoreService';
import { referralService } from '../services/referralService';
import { UserEntity } from '../server/types/seamless';

export interface PhoneRegistrationMeta {
  displayName?: string;
  preferredCurrency?: 'BDT' | 'USD';
  referralCode?: string;
}

interface AuthContextType {
  user: User | null;
  firestoreUser: UserEntity | null;
  isAdmin: boolean;
  isPrivileged: boolean;
  userRole: 'ADMIN' | 'PLAYER' | 'VIP' | 'OPERATOR' | 'SUPER_ADMIN';
  loading: boolean;
  token: string | null;
  signInWithGoogle: () => Promise<User | null>;
  registerWithEmail: (email: string, pass: string, displayName: string, preferredCurrency?: 'BDT' | 'USD') => Promise<User | null>;
  loginWithEmail: (email: string, pass: string) => Promise<User | null>;
  sendPasswordReset: (email: string) => Promise<void>;
  createRecaptchaVerifier: (container: string | HTMLElement, invisible?: boolean) => RecaptchaVerifier;
  sendPhoneOtp: (phoneNumberE164: string, appVerifierOrContainer?: string | HTMLElement | RecaptchaVerifier) => Promise<ConfirmationResult>;
  verifyPhoneOtp: (confirmationResult: ConfirmationResult, otpCode: string, registrationMeta?: PhoneRegistrationMeta) => Promise<User | null>;
  logout: () => Promise<void>;
  syncFirestoreProfile: (preferredCurrency?: 'BDT' | 'USD') => Promise<UserEntity | null>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  firestoreUser: null,
  isAdmin: false,
  isPrivileged: false,
  userRole: 'PLAYER',
  loading: true,
  token: null,
  signInWithGoogle: async () => null,
  registerWithEmail: async () => null,
  loginWithEmail: async () => null,
  sendPasswordReset: async () => {},
  createRecaptchaVerifier: () => { throw new Error('AuthContext uninitialized'); },
  sendPhoneOtp: async () => { throw new Error('AuthContext uninitialized'); },
  verifyPhoneOtp: async () => null,
  logout: async () => {},
  syncFirestoreProfile: async () => null,
  refreshRole: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [firestoreUser, setFirestoreUser] = useState<UserEntity | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPrivileged, setIsPrivileged] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<'ADMIN' | 'PLAYER' | 'VIP' | 'OPERATOR' | 'SUPER_ADMIN'>('PLAYER');

  // Authoritative server-side role verification via /api/auth/verify-role
  const verifyServerPrivilege = useCallback(async (authToken: string | null): Promise<{ isPrivileged: boolean; role: string }> => {
    if (!authToken) {
      setIsPrivileged(false);
      setUserRole('PLAYER');
      return { isPrivileged: false, role: 'PLAYER' };
    }

    try {
      const res = await fetch('/api/auth/verify-role', {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        const privileged = data.isPrivileged === true;
        const role = (data.role || (privileged ? 'ADMIN' : 'PLAYER')) as 'ADMIN' | 'PLAYER' | 'VIP' | 'OPERATOR' | 'SUPER_ADMIN';
        setIsPrivileged(privileged);
        setUserRole(role);
        return { isPrivileged: privileged, role };
      }
    } catch (err) {
      console.warn('[AuthContext] /api/auth/verify-role fetch notice:', err);
    }

    // Fail closed
    setIsPrivileged(false);
    setUserRole('PLAYER');
    return { isPrivileged: false, role: 'PLAYER' };
  }, []);

  const refreshRole = useCallback(async () => {
    const currentUser = auth.currentUser || user;
    if (!currentUser) {
      setIsPrivileged(false);
      setUserRole('PLAYER');
      return;
    }
    try {
      const freshToken = await currentUser.getIdToken(true);
      setToken(freshToken);
      await verifyServerPrivilege(freshToken);
    } catch (e) {
      console.warn('[AuthContext] refreshRole error:', e);
      setIsPrivileged(false);
      setUserRole('PLAYER');
    }
  }, [user, verifyServerPrivilege]);

  // Sync profile helper
  const syncFirestoreProfile = useCallback(async (preferredCurrency: 'BDT' | 'USD' = 'BDT'): Promise<UserEntity | null> => {
    const currentUser = auth.currentUser || user;
    if (!currentUser) return null;

    try {
      const profile = await firebaseFirestore.syncUserProfile({
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL,
        phoneNumber: currentUser.phoneNumber
      }, preferredCurrency);

      await firebaseFirestore.ensureUserWallet(currentUser.uid, preferredCurrency, 0);
      setFirestoreUser(profile);
      return profile;
    } catch (err) {
      console.warn('Firestore profile sync during auth notice:', err);
      return null;
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = initAuth(
      async (authUser, authToken) => {
        if (!isMounted) return;
        setUser(authUser);
        setToken(authToken);

        try {
          localStorage.setItem('playall365_session_active', 'true');
          localStorage.setItem('playall365_user_id', authUser.uid);
        } catch {
          // Ignore localStorage errors
        }

        // 1. Authoritative Server-Side Role Verification (Highest priority authorization authority)
        if (authToken) {
          await verifyServerPrivilege(authToken);
        } else {
          try {
            const token = await authUser.getIdToken();
            await verifyServerPrivilege(token);
          } catch {
            setIsPrivileged(false);
            setUserRole('PLAYER');
          }
        }

        // Guarantee user doc & wallet exist in Firestore on session restoration or sign-up
        try {
          const profile = await firebaseFirestore.syncUserProfile({
            uid: authUser.uid,
            email: authUser.email,
            displayName: authUser.displayName,
            photoURL: authUser.photoURL,
            phoneNumber: authUser.phoneNumber
          }, 'BDT');
          await firebaseFirestore.ensureUserWallet(authUser.uid, 'BDT', 0);
          if (isMounted) {
            setFirestoreUser(profile);
          }
        } catch (syncErr) {
          console.warn('Background Firestore profile sync error on state change:', syncErr);
        }

        if (isMounted) {
          setLoading(false);
        }
      },
      () => {
        if (!isMounted) return;
        setUser(null);
        setToken(null);
        setFirestoreUser(null);
        setIsPrivileged(false);
        setUserRole('PLAYER');
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [verifyServerPrivilege]);

  const signInWithGoogle = async (): Promise<User | null> => {
    try {
      setLoading(true);
      const res = await libGoogleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
        try {
          localStorage.setItem('playall365_session_active', 'true');
          localStorage.setItem('playall365_user_id', res.user.uid);
        } catch {}

        if (res.accessToken) {
          await verifyServerPrivilege(res.accessToken);
        }

        // Ensure Firestore document & wallet are linked immediately with 0 initial balance
        try {
          const profile = await firebaseFirestore.syncUserProfile({
            uid: res.user.uid,
            email: res.user.email,
            displayName: res.user.displayName,
            photoURL: res.user.photoURL,
            phoneNumber: res.user.phoneNumber
          }, 'BDT');
          await firebaseFirestore.ensureUserWallet(res.user.uid, 'BDT', 0);
          setFirestoreUser(profile);
        } catch (err) {
          console.warn('Firestore sync during Google Sign In notice:', err);
        }

        return res.user;
      }
      return null;
    } catch (error: any) {
      console.error('Google Sign In error:', error?.message || error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const registerWithEmail = async (
    email: string,
    pass: string,
    displayName: string,
    preferredCurrency: 'BDT' | 'USD' = 'BDT'
  ): Promise<User | null> => {
    try {
      setLoading(true);
      const res = await libRegisterWithEmail(email, pass, displayName);
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
        try {
          localStorage.setItem('playall365_session_active', 'true');
          localStorage.setItem('playall365_user_id', res.user.uid);
        } catch {}

        if (res.accessToken) {
          await verifyServerPrivilege(res.accessToken);
        }

        // Ensure user document and initial wallet with 0 balance are linked in Firestore
        try {
          const profile = await firebaseFirestore.syncUserProfile({
            uid: res.user.uid,
            email: res.user.email || email,
            displayName: displayName || res.user.displayName,
            phoneNumber: res.user.phoneNumber
          }, preferredCurrency);
          await firebaseFirestore.ensureUserWallet(res.user.uid, preferredCurrency, 0);
          setFirestoreUser(profile);
        } catch (err) {
          console.warn('Firestore initial registration sync notice:', err);
        }

        return res.user;
      }
      return null;
    } catch (error: any) {
      console.warn('Email Registration notice:', error?.message || error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginWithEmail = async (email: string, pass: string): Promise<User | null> => {
    try {
      setLoading(true);
      const res = await libLoginWithEmail(email, pass);
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
        try {
          localStorage.setItem('playall365_session_active', 'true');
          localStorage.setItem('playall365_user_id', res.user.uid);
        } catch {}

        if (res.accessToken) {
          await verifyServerPrivilege(res.accessToken);
        }

        try {
          const profile = await firebaseFirestore.syncUserProfile({
            uid: res.user.uid,
            email: res.user.email || email,
            displayName: res.user.displayName
          }, 'BDT');
          await firebaseFirestore.ensureUserWallet(res.user.uid, 'BDT', 0);
          setFirestoreUser(profile);
        } catch (err) {
          console.warn('Firestore login sync notice:', err);
        }

        return res.user;
      }
      return null;
    } catch (error: any) {
      console.warn('Email Login notice:', error?.message || error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async (email: string): Promise<void> => {
    try {
      setLoading(true);
      await libSendPasswordReset(email);
    } catch (error: any) {
      console.warn('[AuthContext] sendPasswordReset notice:', error?.code || error?.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const createRecaptchaVerifier = useCallback(
    (container: string | HTMLElement, invisible: boolean = true): RecaptchaVerifier => {
      return libCreateRecaptchaVerifier(container, invisible);
    },
    []
  );

  const sendPhoneOtp = async (
    phoneNumberE164: string,
    appVerifierOrContainer?: string | HTMLElement | RecaptchaVerifier
  ): Promise<ConfirmationResult> => {
    try {
      setLoading(true);
      let verifier: RecaptchaVerifier;

      if (appVerifierOrContainer && typeof (appVerifierOrContainer as any).verify === 'function') {
        verifier = appVerifierOrContainer as RecaptchaVerifier;
      } else if (appVerifierOrContainer) {
        verifier = libCreateRecaptchaVerifier(appVerifierOrContainer as string | HTMLElement);
      } else {
        const defaultContainer = typeof document !== 'undefined' ? (document.getElementById('play369-recaptcha-container') || document.body) : 'recaptcha-container';
        verifier = libCreateRecaptchaVerifier(defaultContainer);
      }

      const confirmationResult = await libSignInWithPhone(phoneNumberE164, verifier);
      return confirmationResult;
    } catch (error: any) {
      console.warn('Phone OTP dispatch notice:', error?.code || 'DISPATCH_ERROR');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const verifyPhoneOtp = async (
    confirmationResult: ConfirmationResult,
    otpCode: string,
    registrationMeta?: PhoneRegistrationMeta
  ): Promise<User | null> => {
    try {
      setLoading(true);
      const res = await libConfirmOtpCode(confirmationResult, otpCode);
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
        try {
          localStorage.setItem('playall365_session_active', 'true');
          localStorage.setItem('playall365_user_id', res.user.uid);
        } catch {}

        if (res.accessToken) {
          await verifyServerPrivilege(res.accessToken);
        }

        const preferredCurrency = registrationMeta?.preferredCurrency || 'BDT';
        const displayName = registrationMeta?.displayName || res.user.displayName || (res.user.phoneNumber ? `Player_${res.user.phoneNumber.replace(/[^0-9]/g, '').slice(-4)}` : 'PLAY369_Player');

        // Authoritative Firestore profile sync & zero-balance wallet guarantee
        try {
          const profile = await firebaseFirestore.syncUserProfile({
            uid: res.user.uid,
            phoneNumber: res.user.phoneNumber,
            displayName,
            email: res.user.email || null
          }, preferredCurrency);

          await firebaseFirestore.ensureUserWallet(res.user.uid, preferredCurrency, 0);
          setFirestoreUser(profile);

          // Optional authoritative referral binding if specified during registration
          const effectiveReferralCode = registrationMeta?.referralCode?.trim() || referralService.getStoredReferralCode();
          if (effectiveReferralCode && res.accessToken) {
            try {
              await referralService.bindReferralOnServer(effectiveReferralCode, res.accessToken);
            } catch (refErr) {
              console.warn('[AuthContext] Phone Auth referral bind notice:', refErr);
            }
          }
        } catch (syncErr) {
          console.warn('Firestore phone user sync notice:', syncErr);
        }

        return res.user;
      }
      return null;
    } catch (error: any) {
      console.warn('Phone OTP Verification notice:', error?.code || 'VERIFY_ERROR');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await libLogout();
      setUser(null);
      setToken(null);
      setFirestoreUser(null);
      setIsPrivileged(false);
      setUserRole('PLAYER');
      try {
        localStorage.removeItem('playall365_session_active');
        localStorage.removeItem('playall365_user_id');
      } catch {}
    } catch (error) {
      console.warn('Sign Out error:', error);
    }
  };

  // Authority is STRICTLY isPrivileged from server /api/auth/verify-role
  const isAdmin = isPrivileged;

  return (
    <AuthContext.Provider
      value={{
        user,
        firestoreUser,
        isAdmin,
        isPrivileged,
        userRole,
        loading,
        token,
        signInWithGoogle,
        registerWithEmail,
        loginWithEmail,
        sendPasswordReset,
        createRecaptchaVerifier,
        sendPhoneOtp,
        verifyPhoneOtp,
        logout,
        syncFirestoreProfile,
        refreshRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

