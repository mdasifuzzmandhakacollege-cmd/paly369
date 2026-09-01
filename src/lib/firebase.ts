import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  setPersistence,
  browserLocalPersistence,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  ApplicationVerifier,
  User
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import baseAppletConfig from '../../firebase-applet-config.json';

// Use base applet configuration
export const firebaseConfig = {
  ...baseAppletConfig,
  firestoreDatabaseId: baseAppletConfig.firestoreDatabaseId || "ai-studio-remixigamingseam-f254c3d9-f0b0-442c-9107-66d13db9b3fe"
};

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly'
];

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Ensure local persistence for seamless cross-refresh session retention
try {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('Firebase setPersistence notice:', err);
  });
} catch (e) {
  console.warn('Firebase persistence initialization error:', e);
}

export const FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId;

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const googleAuthProvider = new GoogleAuthProvider();
SCOPES.forEach((scope) => {
  googleAuthProvider.addScope(scope);
});

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;
let cachedAccessToken: string | null = null;

type AuthSuccessCallback = (user: User, token: string) => void;
type AuthFailureCallback = () => void;

// Initialize auth state listener. Call this on app load or component mount.
export const initAuth = (
  onAuthSuccess?: AuthSuccessCallback,
  onAuthFailure?: AuthFailureCallback
) => {
  const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      try {
        const idToken = await user.getIdToken();
        cachedAccessToken = idToken;
        if (onAuthSuccess) {
          onAuthSuccess(user, idToken);
        }
      } catch (e) {
        if (!isSigningIn && onAuthFailure) {
          onAuthFailure();
        }
      }
    } else {
      cachedAccessToken = null;
      if (!isSigningIn && onAuthFailure) {
        onAuthFailure();
      }
    }
  });

  return unsubscribe;
};

// Real Google Sign-in with Firebase Auth
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleAuthProvider);
    const token = await result.user.getIdToken();
    cachedAccessToken = token;
    return { user: result.user, accessToken: token };
  } catch (error: any) {
    console.error('Firebase Google Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Real Email/Password Registration
export const registerWithEmail = async (
  email: string,
  pass: string,
  displayName: string
): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (displayName) {
      try {
        await updateProfile(cred.user, { displayName });
      } catch (profileErr) {
        console.warn('Firebase profile displayName update notice:', profileErr);
      }
    }
    const token = await cred.user.getIdToken();
    cachedAccessToken = token;
    return { user: cred.user, accessToken: token };
  } catch (error: any) {
    console.warn('Firebase Email Register notice:', error?.message || error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Real Email/Password Login
export const loginWithEmail = async (
  email: string,
  pass: string
): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const token = await cred.user.getIdToken();
    cachedAccessToken = token;
    return { user: cred.user, accessToken: token };
  } catch (error: any) {
    console.warn('Firebase Email Login notice:', error?.message || error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Real Firebase Email Password Reset Request
export const sendPasswordReset = async (email: string): Promise<void> => {
  if (!email || !email.trim()) {
    const err = new Error('Please enter your email address.');
    (err as any).code = 'auth/invalid-email';
    throw err;
  }

  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (error: any) {
    console.warn('Firebase Password Reset request notice:', error?.code || error?.message);
    // Throw network/fatal errors so context can present them if needed
    if (error?.code === 'auth/network-request-failed') {
      throw error;
    }
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('Sign out error:', e);
  }
  cachedAccessToken = null;
};

/**
 * Creates and initializes a Firebase RecaptchaVerifier instance.
 * Fails safely if environment cannot support Recaptcha.
 */
export const createRecaptchaVerifier = (
  container: string | HTMLElement,
  invisible: boolean = true
): RecaptchaVerifier => {
  if (typeof window === 'undefined') {
    const err = new Error('Phone authentication is unavailable in this environment.');
    (err as any).code = 'PHONE_AUTH_UNAVAILABLE';
    throw err;
  }

  try {
    const verifier = new RecaptchaVerifier(auth, container, {
      size: invisible ? 'invisible' : 'normal',
      callback: () => {
        // reCAPTCHA solved - allow signInWithPhoneNumber
      },
      'expired-callback': () => {
        // Response expired. Ask user to solve reCAPTCHA again.
      }
    });
    return verifier;
  } catch (error: any) {
    console.warn('RecaptchaVerifier initialization notice:', error?.code || error?.message);
    const err = new Error('Failed to initialize phone verification security layer.');
    (err as any).code = error?.code || 'PHONE_AUTH_UNAVAILABLE';
    throw err;
  }
};

/**
 * Initiates Firebase Phone Authentication with E.164 phone number and RecaptchaVerifier.
 * Never logs raw phone number to console.
 */
export const signInWithPhone = async (
  phoneNumberE164: string,
  appVerifier: ApplicationVerifier
): Promise<ConfirmationResult> => {
  if (typeof window === 'undefined' || !auth) {
    const err = new Error('Phone authentication is unavailable.');
    (err as any).code = 'PHONE_AUTH_UNAVAILABLE';
    throw err;
  }

  try {
    isSigningIn = true;
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumberE164, appVerifier);
    return confirmationResult;
  } catch (error: any) {
    console.warn('Firebase Phone Auth request notice:', error?.code || 'AUTH_ERROR');
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Confirms OTP code against Firebase ConfirmationResult.
 * Never logs OTP code to console or persists it locally.
 */
export const confirmOtpCode = async (
  confirmationResult: ConfirmationResult,
  verificationCode: string
): Promise<{ user: User; accessToken: string }> => {
  if (!confirmationResult || typeof confirmationResult.confirm !== 'function') {
    const err = new Error('Invalid or expired phone verification session.');
    (err as any).code = 'INVALID_CONFIRMATION_RESULT';
    throw err;
  }

  try {
    isSigningIn = true;
    const cred = await confirmationResult.confirm(verificationCode.trim());
    const token = await cred.user.getIdToken();
    cachedAccessToken = token;
    return { user: cred.user, accessToken: token };
  } catch (error: any) {
    console.warn('Firebase OTP confirmation notice:', error?.code || 'OTP_VERIFICATION_FAILED');
    throw error;
  } finally {
    isSigningIn = false;
  }
};


