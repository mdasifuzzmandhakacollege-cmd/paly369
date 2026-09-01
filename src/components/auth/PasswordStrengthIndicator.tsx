import React from 'react';
import { Check, X, Shield, Sparkles } from 'lucide-react';

interface PasswordStrengthProps {
  password?: string;
  confirmPassword?: string;
  showConfirmCheck?: boolean;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthProps> = ({
  password = '',
  confirmPassword = '',
  showConfirmCheck = false
}) => {
  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const isMatched = showConfirmCheck && confirmPassword.length > 0 && password === confirmPassword;

  // Calculate score (0-5)
  const checks = [hasLength, hasUpper, hasLower, hasNumber, hasSpecial];
  const passedCount = checks.filter(Boolean).length;

  let strengthLabel = 'Too Weak';
  let strengthColor = 'bg-rose-500 text-rose-400 border-rose-500/30';
  let barGradient = 'from-rose-500 to-rose-600';
  let strengthPercentage = (passedCount / 5) * 100;

  if (passedCount >= 5) {
    strengthLabel = 'Invincible';
    strengthColor = 'bg-emerald-500 text-emerald-400 border-emerald-500/30';
    barGradient = 'from-emerald-500 via-teal-400 to-amber-300';
  } else if (passedCount >= 4) {
    strengthLabel = 'Strong';
    strengthColor = 'bg-emerald-400 text-emerald-300 border-emerald-400/30';
    barGradient = 'from-emerald-500 to-teal-400';
  } else if (passedCount >= 3) {
    strengthLabel = 'Good';
    strengthColor = 'bg-amber-400 text-amber-300 border-amber-400/30';
    barGradient = 'from-amber-500 to-yellow-400';
  } else if (passedCount >= 2) {
    strengthLabel = 'Fair';
    strengthColor = 'bg-orange-500 text-orange-400 border-orange-500/30';
    barGradient = 'from-orange-500 to-amber-500';
  }

  if (password.length === 0) {
    return null;
  }

  return (
    <div id="play369-password-strength-container" className="space-y-2 pt-1 font-sans">
      {/* Visual meter bar */}
      <div className="flex items-center justify-between text-xs mb-1">
        <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-emerald-200/80">
          <Shield className="w-3.5 h-3.5 text-amber-400" />
          <span>Security Score</span>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${strengthColor} bg-opacity-10`}>
          {strengthLabel}
        </span>
      </div>

      {/* Progress Bar with Golden Ratio Segments */}
      <div className="h-1.5 w-full bg-slate-900/80 rounded-full overflow-hidden p-0.5 border border-emerald-900/40">
        <div
          className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${barGradient}`}
          style={{ width: `${Math.max(10, strengthPercentage)}%` }}
        />
      </div>

      {/* Requirement Pills (Compact, high contrast, non-overflowing) */}
      <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px] sm:text-[11px]">
        <div className={`flex items-center space-x-1.5 min-w-0 ${hasLength ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
          {hasLength ? <Check className="w-3 h-3 text-emerald-400 shrink-0" /> : <X className="w-3 h-3 text-slate-600 shrink-0" />}
          <span className="truncate">8+ characters</span>
        </div>

        <div className={`flex items-center space-x-1.5 min-w-0 ${hasNumber ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
          {hasNumber ? <Check className="w-3 h-3 text-emerald-400 shrink-0" /> : <X className="w-3 h-3 text-slate-600 shrink-0" />}
          <span className="truncate">Includes number</span>
        </div>

        <div className={`flex items-center space-x-1.5 min-w-0 ${hasUpper && hasLower ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
          {hasUpper && hasLower ? <Check className="w-3 h-3 text-emerald-400 shrink-0" /> : <X className="w-3 h-3 text-slate-600 shrink-0" />}
          <span className="truncate">Upper &amp; lowercase</span>
        </div>

        <div className={`flex items-center space-x-1.5 min-w-0 ${hasSpecial ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
          {hasSpecial ? <Check className="w-3 h-3 text-emerald-400 shrink-0" /> : <X className="w-3 h-3 text-slate-600 shrink-0" />}
          <span className="truncate">Special symbol</span>
        </div>
      </div>

      {/* Match check if confirmation is enabled */}
      {showConfirmCheck && confirmPassword.length > 0 && (
        <div className={`flex items-center space-x-1.5 text-[11px] pt-1 ${isMatched ? 'text-emerald-400 font-semibold' : 'text-rose-400'}`}>
          {isMatched ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Passwords match perfectly</span>
            </>
          ) : (
            <>
              <X className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>Passwords do not match yet</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
