import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Crown,
  Globe,
  Coins,
  Loader2,
  Phone,
  KeyRound,
  ArrowLeft,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { useAuth, PhoneRegistrationMeta } from '../../contexts/AuthContext';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
import { InternationalPhoneInput } from './InternationalPhoneInput';
import { Play369BrandLogo } from '../Play369BrandLogo';
import { referralService } from '../../services/referralService';
import { ConfirmationResult } from 'firebase/auth';

export type AuthCardMode = 'login' | 'register' | 'forgot-password';
export type AuthMethod = 'email' | 'phone';

interface Play369AuthCardProps {
  initialMode?: AuthCardMode;
  initialMethod?: AuthMethod;
  onSuccess?: () => void;
  onClose?: () => void;
  className?: string;
  isModal?: boolean;
}

export const Play369AuthCard: React.FC<Play369AuthCardProps> = ({
  initialMode = 'login',
  initialMethod = 'email',
  onSuccess,
  onClose,
  className = '',
  isModal = false
}) => {
  const {
    loginWithEmail,
    registerWithEmail,
    sendPasswordReset,
    signInWithGoogle,
    sendPhoneOtp,
    verifyPhoneOtp,
    loading: authLoading
  } = useAuth();

  const prefersReducedMotion = useReducedMotion();

  const [mode, setMode] = useState<AuthCardMode>(initialMode);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(initialMethod);

  // Email form state
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  // Phone form state
  const [phoneRaw, setPhoneRaw] = useState<string>('');
  const [phoneE164, setPhoneE164] = useState<string | null>(null);
  const [phoneValid, setPhoneValid] = useState<boolean>(false);
  const [phoneStep, setPhoneStep] = useState<'input' | 'otp'>('input');
  const [otpCode, setOtpCode] = useState<string>('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // Shared registration state (CRITICAL: agreeTerms MUST default to false)
  const [displayName, setDisplayName] = useState<string>('');
  const [preferredCurrency, setPreferredCurrency] = useState<'BDT' | 'USD'>('BDT');
  const [referralCode, setReferralCode] = useState<string>('');
  const [agreeTerms, setAgreeTerms] = useState<boolean>(false);

  // UI state
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [showReferralInput, setShowReferralInput] = useState<boolean>(false);
  const [legalModalContent, setLegalModalContent] = useState<'terms' | 'responsible' | 'privacy' | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const otpInputRef = useRef<HTMLInputElement>(null);

  // Resend cooldown countdown effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCooldown]);

  // Focus OTP input when transitioning to OTP step
  useEffect(() => {
    if (phoneStep === 'otp') {
      const t = setTimeout(() => {
        otpInputRef.current?.focus();
      }, 120);
      return () => clearTimeout(t);
    }
  }, [phoneStep]);

  // Validate Email Form
  const validateEmailForm = (): boolean => {
    setErrorMessage(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      setErrorMessage('Please provide a valid email address.');
      return false;
    }

    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return false;
    }

    if (mode === 'register') {
      if (!displayName.trim()) {
        setErrorMessage('Please enter your full name or player username.');
        return false;
      }

      if (password.length < 8) {
        setErrorMessage('For security, registration password must be at least 8 characters.');
        return false;
      }

      if (password !== confirmPassword) {
        setErrorMessage('Password and Confirm Password do not match.');
        return false;
      }

      if (!agreeTerms) {
        setErrorMessage('You must be 18+ and accept the Terms of Service & Responsible Gaming Policy.');
        return false;
      }
    }

    return true;
  };

  // Validate Phone Input Step
  const validatePhoneStep = (): boolean => {
    setErrorMessage(null);

    if (!phoneValid || !phoneE164) {
      setErrorMessage('Please enter a valid international mobile phone number.');
      return false;
    }

    if (mode === 'register') {
      if (!displayName.trim()) {
        setErrorMessage('Please enter your full name or player username.');
        return false;
      }
      if (!agreeTerms) {
        setErrorMessage('You must be 18+ and accept the Terms of Service & Responsible Gaming Policy.');
        return false;
      }
    }

    return true;
  };

  // Handle Email Submission (Login or Register)
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmailForm()) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (mode === 'login') {
        const user = await loginWithEmail(email.trim(), password);
        if (user) {
          setSuccessMessage('Welcome back to PLAY369. Signing in...');
          setTimeout(() => {
            if (onSuccess) onSuccess();
            if (onClose) onClose();
          }, 600);
        }
      } else {
        const user = await registerWithEmail(
          email.trim(),
          password,
          displayName.trim(),
          preferredCurrency
        );
        if (user) {
          const effectiveReferralCode = referralCode.trim() || referralService.getStoredReferralCode();
          if (effectiveReferralCode) {
            try {
              const token = await user.getIdToken();
              await referralService.bindReferralOnServer(effectiveReferralCode, token);
            } catch (refErr) {
              console.warn('[Play369AuthCard] Referral bind notice:', refErr);
            }
          }
          setSuccessMessage('Account registered successfully. Welcome to PLAY369!');
          setTimeout(() => {
            if (onSuccess) onSuccess();
            if (onClose) onClose();
          }, 700);
        }
      }
    } catch (err: any) {
      handleAuthError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Password Recovery Submission (Privacy-Preserving)
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      await sendPasswordReset(email.trim());
      // Always show generic privacy-preserving success message (never reveal if email exists)
      setSuccessMessage('If an account is associated with this email, password reset instructions have been sent.');
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      const code = (err?.code || '').toLowerCase();
      if (code.includes('network') || msg.includes('network')) {
        setErrorMessage('Network connection issue. Please check your connectivity and try again.');
      } else {
        // Safe privacy-preserving default
        setSuccessMessage('If an account is associated with this email, password reset instructions have been sent.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Phone: Send OTP (Step 1)
  const handleSendPhoneOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validatePhoneStep()) return;

    if (!phoneE164) {
      setErrorMessage('Please enter a valid international mobile number.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const container = document.getElementById('play369-recaptcha-container') || 'play369-recaptcha-container';
      const confResult = await sendPhoneOtp(phoneE164, container as any);
      setConfirmationResult(confResult);
      setPhoneStep('otp');
      setResendCooldown(60);
      setSuccessMessage('If this number is eligible, a 6-digit SMS verification code has been dispatched.');
    } catch (err: any) {
      handleAuthError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Phone: Resend OTP
  const handleResendPhoneOtp = async () => {
    if (resendCooldown > 0 || !phoneE164) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const container = document.getElementById('play369-recaptcha-container') || 'play369-recaptcha-container';
      const confResult = await sendPhoneOtp(phoneE164, container as any);
      setConfirmationResult(confResult);
      setResendCooldown(60);
      setSuccessMessage('New SMS verification code dispatched.');
    } catch (err: any) {
      handleAuthError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Phone: Verify OTP (Step 2)
  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanOtp = otpCode.trim();
    if (!cleanOtp || cleanOtp.length < 6) {
      setErrorMessage('Please enter the 6-digit SMS verification code.');
      return;
    }

    if (!confirmationResult) {
      setErrorMessage('Verification session expired. Please request a new verification code.');
      setPhoneStep('input');
      return;
    }

    setIsSubmitting(true);
    try {
      const registrationMeta: PhoneRegistrationMeta = {
        displayName: displayName.trim() || undefined,
        preferredCurrency: preferredCurrency,
        referralCode: referralCode.trim() || referralService.getStoredReferralCode() || undefined
      };

      const user = await verifyPhoneOtp(confirmationResult, cleanOtp, registrationMeta);
      if (user) {
        setSuccessMessage(
          mode === 'login'
            ? 'Mobile verified. Welcome back to PLAY369.'
            : 'Phone verified and account created. Welcome to PLAY369!'
        );
        setTimeout(() => {
          if (onSuccess) onSuccess();
          if (onClose) onClose();
        }, 600);
      }
    } catch (err: any) {
      handleAuthError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Safe Generic Error Formatter
  const handleAuthError = (err: any) => {
    let friendlyError = 'Authentication failed. Please verify your details and try again.';
    const msg = (err?.message || '').toLowerCase();
    const code = (err?.code || '').toLowerCase();

    if (code.includes('phone_auth_unavailable') || msg.includes('phone_auth_unavailable')) {
      friendlyError = 'Phone SMS verification is temporarily unavailable. Please sign in with Email or Google.';
    } else if (code.includes('invalid-verification-code') || msg.includes('invalid-verification-code') || msg.includes('invalid code')) {
      friendlyError = 'The 6-digit verification code entered is incorrect or expired. Please re-enter or request a new code.';
    } else if (code.includes('code-expired') || msg.includes('code-expired')) {
      friendlyError = 'Verification code has expired. Please request a new code.';
    } else if (code.includes('too-many-requests') || msg.includes('too-many-requests') || msg.includes('quota-exceeded')) {
      friendlyError = 'Too many attempts. For security reasons, please wait a few minutes before trying again.';
    } else if (code.includes('invalid-phone-number') || msg.includes('invalid-phone-number') || msg.includes('invalid phone')) {
      friendlyError = 'The phone number format is invalid. Please select your country and enter a valid mobile number.';
    } else if (code.includes('captcha-check-failed') || msg.includes('captcha')) {
      friendlyError = 'Security verification failed. Please try again.';
    } else if (
      code.includes('user-not-found') ||
      msg.includes('user not found') ||
      msg.includes('wrong-password') ||
      code.includes('wrong-password') ||
      code.includes('invalid-credential')
    ) {
      friendlyError = 'Invalid email or password. Please verify your login credentials.';
    } else if (code.includes('email-already-in-use') || msg.includes('email already in use')) {
      friendlyError = 'An account is already associated with this email. Please switch to Sign In.';
    } else if (code.includes('weak-password') || msg.includes('weak password')) {
      friendlyError = 'Password is too weak. Please use at least 8 characters with numbers & symbols.';
    } else if (code.includes('network-request-failed') || msg.includes('network')) {
      friendlyError = 'Network connection issue. Please check your connectivity and try again.';
    }

    setErrorMessage(friendlyError);
  };

  // Handle One-Tap Google Sign-In
  const handleGoogleSignIn = async () => {
    setIsGoogleSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const user = await signInWithGoogle();
      if (user) {
        setSuccessMessage('Signed in with Google. Welcome to PLAY369!');
        setTimeout(() => {
          if (onSuccess) onSuccess();
          if (onClose) onClose();
        }, 600);
      }
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        handleAuthError(err);
      }
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <div
      id="play369-auth-card"
      className={`relative w-full max-w-[460px] mx-auto overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-b from-[#063120] via-[#021b10] to-[#01120a] p-3.5 sm:p-6 md:p-7 shadow-2xl backdrop-blur-xl transition-all ${className}`}
      style={{
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85), 0 0 35px rgba(245, 158, 11, 0.10)'
      }}
    >
      {/* Invisible Recaptcha Mount Point */}
      <div id="play369-recaptcha-container" className="hidden" />

      {/* Ambient Glow Accents */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-emerald-500/15 blur-3xl" />

      {/* Brand Header with Official Emblem Logo */}
      <div className="relative z-10 text-center mb-4 flex flex-col items-center">
        <Play369BrandLogo size="lg" glow={true} className="mb-2" />

        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
          {mode === 'login' && 'Sign In'}
          {mode === 'register' && 'Create Account'}
          {mode === 'forgot-password' && 'Password Recovery'}
        </h2>

        <p className="text-xs text-emerald-200/70 mt-1 font-medium leading-relaxed max-w-sm">
          {mode === 'login' && 'Sign in to access your casino wallet & instant games'}
          {mode === 'register' && 'Register via Email or International Mobile Phone'}
          {mode === 'forgot-password' && 'Enter your email address to receive password reset instructions'}
        </p>
      </div>

      {/* Primary Auth Mode Switcher (Sign In vs Register) - Only shown in login/register modes */}
      {mode !== 'forgot-password' ? (
        <div
          id="play369-mode-toggle"
          role="tablist"
          className="relative z-10 grid grid-cols-2 p-1 mb-4 rounded-2xl bg-[#02140c]/90 border border-emerald-800/50"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            onClick={() => {
              setMode('login');
              setPhoneStep('input');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`min-h-[48px] rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 cursor-pointer select-none active:scale-[0.99] ${
              mode === 'login'
                ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                : 'text-emerald-300/70 hover:text-white hover:bg-emerald-950/40'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Sign In</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            onClick={() => {
              setMode('register');
              setPhoneStep('input');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`min-h-[48px] rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 cursor-pointer select-none active:scale-[0.99] ${
              mode === 'register'
                ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                : 'text-emerald-300/70 hover:text-white hover:bg-emerald-950/40'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            <span>Register</span>
          </button>
        </div>
      ) : (
        /* Back to Sign In Header for Forgot Password mode */
        <div className="relative z-10 mb-4">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className="min-h-[48px] px-3.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/50 text-emerald-300 hover:text-white text-xs sm:text-sm font-semibold flex items-center space-x-2 transition-all cursor-pointer select-none active:scale-[0.99]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Sign In</span>
          </button>
        </div>
      )}

      {/* Auth Method Sub-Toggle (Email vs Mobile Phone) - Only for Login & Register modes */}
      {mode !== 'forgot-password' && (
        <div
          role="tablist"
          className="relative z-10 flex rounded-xl bg-[#01140b] p-1 mb-4 border border-emerald-900/60"
        >
          <button
            type="button"
            id="play369-tab-email"
            role="tab"
            aria-selected={authMethod === 'email'}
            onClick={() => {
              setAuthMethod('email');
              setPhoneStep('input');
              setErrorMessage(null);
            }}
            className={`flex-1 min-h-[48px] rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center space-x-1.5 sm:space-x-2 cursor-pointer select-none active:scale-[0.99] ${
              authMethod === 'email'
                ? 'bg-emerald-900/80 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-emerald-400/70 hover:text-emerald-200'
            }`}
          >
            <Mail className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Email</span>
          </button>

          <button
            type="button"
            id="play369-tab-phone"
            role="tab"
            aria-selected={authMethod === 'phone'}
            onClick={() => {
              setAuthMethod('phone');
              setErrorMessage(null);
            }}
            className={`flex-1 min-h-[48px] rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center space-x-1.5 sm:space-x-2 cursor-pointer select-none active:scale-[0.99] ${
              authMethod === 'phone'
                ? 'bg-emerald-900/80 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-emerald-400/70 hover:text-emerald-200'
            }`}
          >
            <Phone className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate hidden xs:inline">Mobile Phone (OTP)</span>
            <span className="truncate xs:hidden">Mobile OTP</span>
          </button>
        </div>
      )}

      {/* Error & Success Feedback Banners */}
      <AnimatePresence mode="wait">
        {errorMessage && (
          <motion.div
            key="err-banner"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            role="alert"
            aria-live="polite"
            className="relative z-10 mb-4 p-3.5 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-200 text-xs flex items-start space-x-2.5 shadow-lg"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
          </motion.div>
        )}

        {successMessage && (
          <motion.div
            key="succ-banner"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            role="status"
            aria-live="polite"
            className="relative z-10 mb-4 p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-xs flex items-start space-x-2.5 shadow-lg"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">{successMessage}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* METHOD A: EMAIL + PASSWORD AUTHENTICATION (Login or Register)             */}
      {/* ========================================================================= */}
      {mode !== 'forgot-password' && authMethod === 'email' && (
        <form onSubmit={handleEmailSubmit} className="relative z-10 space-y-3.5">
          {/* Registration-only: Display Name */}
          {mode === 'register' && (
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              className="space-y-1.5"
            >
              <label htmlFor="play369-email-display-name" className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                Full Name / Player Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400/80">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  id="play369-email-display-name"
                  type="text"
                  inputMode="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Asif Chowdhury or Player369"
                  required={mode === 'register'}
                  className="w-full min-h-[48px] pl-10 pr-4 rounded-xl bg-[#02180e] border border-emerald-800/60 text-white placeholder-emerald-700/60 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 transition-all font-sans"
                />
              </div>
            </motion.div>
          )}

          {/* Email Field */}
          <div className="space-y-1.5">
            <label htmlFor="play369-email" className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400/80">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="play369-email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="player@example.com"
                required
                autoComplete="email"
                className="w-full min-h-[48px] pl-10 pr-4 rounded-xl bg-[#02180e] border border-emerald-800/60 text-white placeholder-emerald-700/60 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 transition-all font-sans"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="play369-password" className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                {mode === 'login' ? 'Password' : 'Create Secure Password'}
              </label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot-password');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="text-xs text-amber-400/90 hover:text-amber-300 font-semibold cursor-pointer underline-offset-2 hover:underline min-h-[48px] inline-flex items-center select-none"
                >
                  Forgot password?
                </button>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400/80">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="play369-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="w-full min-h-[48px] pl-10 pr-12 rounded-xl bg-[#02180e] border border-emerald-800/60 text-white placeholder-emerald-700/60 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 transition-all font-sans"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 pl-2 flex items-center justify-center text-emerald-400/70 hover:text-amber-300 transition-colors min-h-[48px] min-w-[48px] cursor-pointer select-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Registration Extra Fields */}
          {mode === 'register' && (
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              className="space-y-3.5 pt-1"
            >
              {/* Password Strength Indicator */}
              <PasswordStrengthIndicator
                password={password}
                confirmPassword={confirmPassword}
                showConfirmCheck={confirmPassword.length > 0}
              />

              {/* Confirm Password Field */}
              <div className="space-y-1.5">
                <label htmlFor="play369-confirm-password" className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400/80">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <input
                    id="play369-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your password"
                    required={mode === 'register'}
                    autoComplete="new-password"
                    className="w-full min-h-[48px] pl-10 pr-12 rounded-xl bg-[#02180e] border border-emerald-800/60 text-white placeholder-emerald-700/60 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 transition-all font-sans"
                  />
                  <button
                    type="button"
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 pl-2 flex items-center justify-center text-emerald-400/70 hover:text-amber-300 transition-colors min-h-[48px] min-w-[48px] cursor-pointer select-none"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Preferred Currency Selector */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                  Preferred Account Currency
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPreferredCurrency('BDT')}
                    className={`min-h-[48px] p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer select-none active:scale-[0.99] ${
                      preferredCurrency === 'BDT'
                        ? 'bg-emerald-500/20 border-amber-400 text-amber-300 shadow-md shadow-amber-500/10'
                        : 'bg-[#02180e] border-emerald-800/60 text-emerald-300/70 hover:border-emerald-700'
                    }`}
                  >
                    <Coins className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate">BDT (৳ Taka)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreferredCurrency('USD')}
                    className={`min-h-[48px] p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer select-none active:scale-[0.99] ${
                      preferredCurrency === 'USD'
                        ? 'bg-emerald-500/20 border-amber-400 text-amber-300 shadow-md shadow-amber-500/10'
                        : 'bg-[#02180e] border-emerald-800/60 text-emerald-300/70 hover:border-emerald-700'
                    }`}
                  >
                    <Globe className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="truncate">USD ($ Dollar)</span>
                  </button>
                </div>
              </div>

              {/* Referral / Promo Code */}
              <div className="pt-0.5">
                {!showReferralInput ? (
                  <button
                    type="button"
                    onClick={() => setShowReferralInput(true)}
                    className="min-h-[48px] text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center space-x-1 cursor-pointer select-none"
                  >
                    <span>+ Have an Agent / Promo code?</span>
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    <label htmlFor="play369-email-referral" className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                      Agent / Referral Promo Code
                    </label>
                    <input
                      id="play369-email-referral"
                      type="text"
                      inputMode="text"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      placeholder="e.g. VIP369 or AGENT_CODE"
                      className="w-full min-h-[48px] px-3.5 rounded-xl bg-[#02180e] border border-emerald-800/60 text-white placeholder-emerald-700/60 text-sm focus:outline-none focus:border-amber-400 font-mono uppercase"
                    />
                  </div>
                )}
              </div>

              {/* CRITICAL: Active Terms & 18+ Acknowledgement (Defaults to FALSE) */}
              <div className="pt-1">
                <label className="flex items-start space-x-3 cursor-pointer min-h-[48px] py-2 select-none">
                  <input
                    id="play369-email-terms-checkbox"
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="mt-0.5 h-5 w-5 rounded border-emerald-800 bg-[#02180e] text-amber-500 focus:ring-amber-400 cursor-pointer shrink-0"
                  />
                  <span className="text-xs text-emerald-200/90 leading-snug">
                    I certify that I am <strong>18+ years of age</strong> and accept the{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setLegalModalContent('terms');
                      }}
                      className="text-amber-300 underline font-semibold hover:text-amber-200 inline py-0.5 px-0.5 bg-transparent border-0 cursor-pointer"
                    >
                      Terms of Service
                    </button>{' '}
                    and{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setLegalModalContent('responsible');
                      }}
                      className="text-amber-300 underline font-semibold hover:text-amber-200 inline py-0.5 px-0.5 bg-transparent border-0 cursor-pointer"
                    >
                      Responsible Gaming Policy
                    </button>.
                  </span>
                </label>
              </div>
            </motion.div>
          )}

          {/* Email Submit Button (Min 52px height) */}
          <button
            id="play369-email-submit-btn"
            type="submit"
            disabled={isSubmitting || authLoading}
            className="w-full min-h-[52px] rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center space-x-2 shadow-xl shadow-amber-500/25 hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                <span>Verifying Credentials...</span>
              </>
            ) : (
              <>
                <span>{mode === 'login' ? 'Sign In to PLAY369' : 'Create Account'}</span>
                <ArrowRight className="w-4 h-4 text-slate-950" />
              </>
            )}
          </button>
        </form>
      )}

      {/* ========================================================================= */}
      {/* METHOD B: INTERNATIONAL PHONE + SMS OTP (Login or Register)               */}
      {/* ========================================================================= */}
      {mode !== 'forgot-password' && authMethod === 'phone' && (
        <div>
          {/* Phone Step 1: Input Mobile Number */}
          {phoneStep === 'input' && (
            <form onSubmit={handleSendPhoneOtp} className="relative z-10 space-y-3.5">
              {/* Registration Only: Display Name */}
              {mode === 'register' && (
                <motion.div
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                  className="space-y-1.5"
                >
                  <label htmlFor="play369-phone-display-name" className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                    Full Name / Player Username
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400/80">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <input
                      id="play369-phone-display-name"
                      type="text"
                      inputMode="text"
                      autoComplete="name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Farhan Ahmed or Player369"
                      required={mode === 'register'}
                      className="w-full min-h-[48px] pl-10 pr-4 rounded-xl bg-[#02180e] border border-emerald-800/60 text-white placeholder-emerald-700/60 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 transition-all font-sans"
                    />
                  </div>
                </motion.div>
              )}

              {/* International Mobile Phone Input */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                  International Mobile Number
                </label>
                <InternationalPhoneInput
                  id="play369-phone-input"
                  value={phoneRaw}
                  onChange={(raw, e164, isValid) => {
                    setPhoneRaw(raw);
                    setPhoneE164(e164);
                    setPhoneValid(isValid);
                  }}
                  placeholder="e.g. 1712345678 or +8801712345678"
                  disabled={isSubmitting}
                />
                <p className="text-[10px] text-emerald-400/70 font-mono">
                  Global coverage: 240+ countries supported with auto-detected +E.164 prefix or country selector.
                </p>
              </div>

              {/* Registration Extra Fields */}
              {mode === 'register' && (
                <motion.div
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                  className="space-y-3.5 pt-1"
                >
                  {/* Currency Selection */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                      Preferred Account Currency
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPreferredCurrency('BDT')}
                        className={`min-h-[48px] p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer select-none active:scale-[0.99] ${
                          preferredCurrency === 'BDT'
                            ? 'bg-emerald-500/20 border-amber-400 text-amber-300 shadow-md shadow-amber-500/10'
                            : 'bg-[#02180e] border-emerald-800/60 text-emerald-300/70 hover:border-emerald-700'
                        }`}
                      >
                        <Coins className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="truncate">BDT (৳ Taka)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPreferredCurrency('USD')}
                        className={`min-h-[48px] p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer select-none active:scale-[0.99] ${
                          preferredCurrency === 'USD'
                            ? 'bg-emerald-500/20 border-amber-400 text-amber-300 shadow-md shadow-amber-500/10'
                            : 'bg-[#02180e] border-emerald-800/60 text-emerald-300/70 hover:border-emerald-700'
                        }`}
                      >
                        <Globe className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="truncate">USD ($ Dollar)</span>
                      </button>
                    </div>
                  </div>

                  {/* Promo / Referral Code */}
                  <div className="pt-0.5">
                    {!showReferralInput ? (
                      <button
                        type="button"
                        onClick={() => setShowReferralInput(true)}
                        className="min-h-[48px] text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center space-x-1 cursor-pointer select-none"
                      >
                        <span>+ Have an Agent / Promo code?</span>
                      </button>
                    ) : (
                      <div className="space-y-1.5">
                        <label htmlFor="play369-phone-referral" className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                          Agent / Referral Promo Code
                        </label>
                        <input
                          id="play369-phone-referral"
                          type="text"
                          inputMode="text"
                          value={referralCode}
                          onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                          placeholder="e.g. VIP369 or AGENT_CODE"
                          className="w-full min-h-[48px] px-3.5 rounded-xl bg-[#02180e] border border-emerald-800/60 text-white placeholder-emerald-700/60 text-sm focus:outline-none focus:border-amber-400 font-mono uppercase"
                        />
                      </div>
                    )}
                  </div>

                  {/* CRITICAL: Active Terms & 18+ Acknowledgement (Defaults to FALSE) */}
                  <div className="pt-1">
                    <label className="flex items-start space-x-3 cursor-pointer min-h-[48px] py-2 select-none">
                      <input
                        id="play369-phone-terms-checkbox"
                        type="checkbox"
                        checked={agreeTerms}
                        onChange={(e) => setAgreeTerms(e.target.checked)}
                        className="mt-0.5 h-5 w-5 rounded border-emerald-800 bg-[#02180e] text-amber-500 focus:ring-amber-400 cursor-pointer shrink-0"
                      />
                      <span className="text-xs text-emerald-200/90 leading-snug">
                        I certify that I am <strong>18+ years of age</strong> and accept the{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setLegalModalContent('terms');
                          }}
                          className="text-amber-300 underline font-semibold hover:text-amber-200 inline py-0.5 px-0.5 bg-transparent border-0 cursor-pointer"
                        >
                          Terms of Service
                        </button>{' '}
                        and{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setLegalModalContent('responsible');
                          }}
                          className="text-amber-300 underline font-semibold hover:text-amber-200 inline py-0.5 px-0.5 bg-transparent border-0 cursor-pointer"
                        >
                          Responsible Gaming Policy
                        </button>.
                      </span>
                    </label>
                  </div>
                </motion.div>
              )}

              {/* Action Button: Send OTP */}
              <button
                id="play369-send-otp-btn"
                type="submit"
                disabled={isSubmitting || !phoneValid || authLoading}
                className="w-full min-h-[52px] rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center space-x-2 shadow-xl shadow-amber-500/25 hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2 select-none"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                    <span>Requesting SMS Code...</span>
                  </>
                ) : (
                  <>
                    <span>Send SMS Verification Code</span>
                    <ArrowRight className="w-4 h-4 text-slate-950" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Phone Step 2: Enter 6-digit OTP Code */}
          {phoneStep === 'otp' && (
            <form onSubmit={handleVerifyPhoneOtp} className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setPhoneStep('input');
                    setErrorMessage(null);
                  }}
                  className="min-h-[48px] px-2.5 text-xs text-emerald-400 hover:text-amber-300 flex items-center space-x-1.5 cursor-pointer font-semibold select-none active:scale-[0.99]"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Change Number</span>
                </button>
                <span className="text-xs font-mono text-amber-400 font-bold px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-400/20">
                  {phoneE164}
                </span>
              </div>

              <div className="space-y-2">
                <label htmlFor="play369-otp-input" className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                  6-Digit SMS Verification Code
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400/80">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    ref={otpInputRef}
                    id="play369-otp-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoComplete="one-time-code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="••••••"
                    className="w-full min-h-[52px] pl-10 pr-4 rounded-xl bg-[#02180e] border border-amber-500/50 text-white placeholder-emerald-700/60 text-xl font-mono tracking-[0.35em] text-center focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 transition-all"
                  />
                </div>
              </div>

              {/* Resend Cooldown Section (Zero layout shift with min-w & tabular nums) */}
              <div className="flex items-center justify-between text-xs text-emerald-300/80 pt-1">
                <span>Didn&apos;t receive code?</span>
                {resendCooldown > 0 ? (
                  <span className="font-mono font-semibold text-amber-400/90 bg-amber-500/10 px-2.5 py-1.5 rounded-lg inline-flex items-center min-w-[110px] justify-center tabular-nums text-xs">
                    Resend in {resendCooldown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendPhoneOtp}
                    disabled={isSubmitting}
                    className="min-h-[48px] px-3 text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer disabled:opacity-50 inline-flex items-center select-none"
                  >
                    Resend Code
                  </button>
                )}
              </div>

              {/* Action Button: Verify OTP */}
              <button
                id="play369-verify-otp-btn"
                type="submit"
                disabled={isSubmitting || otpCode.trim().length < 6 || authLoading}
                className="w-full min-h-[52px] rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center space-x-2 shadow-xl shadow-amber-500/25 hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2 select-none"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <span>{mode === 'login' ? 'Verify & Sign In' : 'Verify & Complete Account'}</span>
                    <ArrowRight className="w-4 h-4 text-slate-950" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* METHOD C: FORGOT PASSWORD FLOW                                            */}
      {/* ========================================================================= */}
      {mode === 'forgot-password' && (
        <form onSubmit={handleForgotPasswordSubmit} className="relative z-10 space-y-4">
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-400/30 text-xs text-emerald-100 flex items-start space-x-2.5">
            <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Enter your registered email address and we will dispatch password reset instructions to your inbox.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="play369-recovery-email" className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider">
              Registered Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400/80">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="play369-recovery-email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="player@example.com"
                required
                autoComplete="email"
                className="w-full min-h-[48px] pl-10 pr-4 rounded-xl bg-[#02180e] border border-emerald-800/60 text-white placeholder-emerald-700/60 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 transition-all font-sans"
              />
            </div>
          </div>

          {/* Reset Request Button */}
          <button
            id="play369-reset-password-btn"
            type="submit"
            disabled={isSubmitting || authLoading}
            className="w-full min-h-[52px] rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center space-x-2 shadow-xl shadow-amber-500/25 hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                <span>Sending Reset Link...</span>
              </>
            ) : (
              <>
                <span>Send Password Reset Link</span>
                <ArrowRight className="w-4 h-4 text-slate-950" />
              </>
            )}
          </button>

          {/* Back to Sign In Option */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className="min-h-[48px] text-xs font-semibold text-emerald-300 hover:text-amber-300 transition-colors inline-flex items-center space-x-1.5 cursor-pointer select-none"
            >
              <span>Remembered your password?</span>
              <span className="text-amber-400 font-bold underline">Sign In</span>
            </button>
          </div>
        </form>
      )}

      {/* Google Sign-in & OAuth (Shown on Login and Register modes only) */}
      {mode !== 'forgot-password' && (
        <>
          {/* Divider */}
          <div className="relative my-5 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-emerald-800/40" />
            </div>
            <span className="relative px-3 bg-[#031c11] text-[11px] font-bold text-emerald-400/80 uppercase tracking-widest">
              Or
            </span>
          </div>

          {/* One-Tap Google OAuth Button (Min 48px height) */}
          <button
            id="play369-google-btn"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleSubmitting || authLoading}
            className="w-full min-h-[48px] rounded-2xl bg-[#02180e] hover:bg-[#032314] border border-emerald-700/50 hover:border-amber-400/60 text-white font-bold text-xs sm:text-sm flex items-center justify-center space-x-3 transition-all cursor-pointer disabled:opacity-50 select-none active:scale-[0.99]"
          >
            {isGoogleSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
            )}
            <span>Continue with Google</span>
          </button>
        </>
      )}

      {/* Security Assurance Footer */}
      <div className="mt-5 text-center">
        <div className="inline-flex items-center space-x-1.5 text-[10px] text-emerald-400/80 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Player Identity Protected · Global E.164 SMS Verification · 18+ Only</span>
        </div>
      </div>

      {/* Legal & Policy Modal Viewer */}
      <AnimatePresence>
        {legalModalContent && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setLegalModalContent(null)}
          >
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg bg-[#02180e] border border-amber-500/40 rounded-2xl p-4 sm:p-6 shadow-2xl text-left font-sans max-h-[85dvh] sm:max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-emerald-800/60 mb-4">
                <h3 className="text-sm sm:text-base font-bold text-amber-300">
                  {legalModalContent === 'terms' && 'PLAY369 Terms of Service'}
                  {legalModalContent === 'responsible' && 'Responsible Gaming Policy'}
                  {legalModalContent === 'privacy' && 'Privacy Policy'}
                </h3>
                <button
                  type="button"
                  aria-label="Close policy modal"
                  onClick={() => setLegalModalContent(null)}
                  className="min-h-[48px] min-w-[48px] flex items-center justify-center text-emerald-400 hover:text-white rounded-lg cursor-pointer select-none"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs text-emerald-200/90 leading-relaxed">
                {legalModalContent === 'terms' && (
                  <>
                    <p><strong>1. Age Requirement:</strong> All players must be at least 18 years old or the legal age of majority in their jurisdiction.</p>
                    <p><strong>2. Fair Play &amp; Account Integrity:</strong> Only one account per person is permitted. Collusion, automated botting, or exploiting technical defects is strictly prohibited.</p>
                    <p><strong>3. Wallet Balances:</strong> All wallet operations are logged via a double-entry ledger. Players are responsible for maintaining account confidentiality.</p>
                  </>
                )}

                {legalModalContent === 'responsible' && (
                  <>
                    <p><strong>1. Player Well-being:</strong> Gambling should remain entertaining and never be used as a financial source of income.</p>
                    <p><strong>2. Self-Exclusion:</strong> Players can set daily deposit limits or request cooling-off periods from account preferences.</p>
                    <p><strong>3. Protection of Minors:</strong> We employ strict age verification to prevent underage participation.</p>
                  </>
                )}

                {legalModalContent === 'privacy' && (
                  <>
                    <p><strong>1. Data Handling:</strong> Your email and phone credentials are authenticated securely via Firebase Auth and stored for player identity protection.</p>
                    <p><strong>2. Security:</strong> All communications with the server use encrypted transport protocols.</p>
                  </>
                )}
              </div>

              <div className="mt-5 pt-3 border-t border-emerald-800/60 flex justify-end">
                <button
                  type="button"
                  onClick={() => setLegalModalContent(null)}
                  className="min-h-[48px] px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm cursor-pointer select-none active:scale-[0.99]"
                >
                  I Understand
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
