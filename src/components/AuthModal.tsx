import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Shield,
  Crown,
  Sparkles,
  Layers,
  ChevronRight,
  Flame
} from 'lucide-react';
import { Play369AuthCard } from './auth/Play369AuthCard';
import { UserEntity } from '../server/types/seamless';
import { soundEngine } from '../services/soundEngine';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  allUsers?: UserEntity[];
  onSelectUser?: (userId: string) => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  allUsers = [],
  onSelectUser,
  initialMode = 'login'
}) => {
  const [showQuickSwapper, setShowQuickSwapper] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleClose = () => {
    try {
      soundEngine.playClick();
    } catch {
      // safe fallback
    }
    onClose();
  };

  return (
    <AnimatePresence>
      <div
        id="play369-auth-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
          paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 12px)',
          paddingRight: 'calc(env(safe-area-inset-right, 0px) + 12px)'
        }}
        onClick={handleClose}
      >
        <motion.div
          id="play369-auth-modal-dialog"
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-[460px] my-auto"
        >
          {/* Close Floating Button (≥48px touch target on mobile) */}
          <button
            id="play369-modal-close-btn"
            onClick={handleClose}
            aria-label="Close modal"
            className="absolute -top-3 -right-2 sm:-top-3 sm:-right-3 z-30 min-h-[48px] min-w-[48px] p-2 rounded-full bg-[#02180e] border border-amber-500/40 text-amber-300 hover:text-white hover:bg-emerald-900 transition-all flex items-center justify-center shadow-xl cursor-pointer select-none active:scale-[0.99]"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Core Reusable Auth Card (PLAY369 Emerald + Gold Theme) */}
          <Play369AuthCard
            initialMode={initialMode}
            onSuccess={handleClose}
            onClose={handleClose}
            isModal={true}
          />

          {/* Quick Dev/Demo User Switcher (For local dev testing only - NEVER rendered in production) */}
          {Boolean((import.meta as any)?.env?.DEV) && allUsers && allUsers.length > 0 && onSelectUser && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => setShowQuickSwapper(!showQuickSwapper)}
                className="text-[11px] font-mono text-emerald-400/80 hover:text-amber-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer bg-slate-950/60 px-3 py-1.5 rounded-full border border-emerald-900/50"
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>{showQuickSwapper ? 'Hide Fast Profile Picker' : 'Fast Demo Player Profiles'}</span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showQuickSwapper ? 'rotate-90' : ''}`} />
              </button>

              {showQuickSwapper && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-2 p-3 rounded-2xl bg-[#02180e]/95 border border-emerald-800/60 text-left space-y-1.5"
                >
                  <div className="text-[10px] uppercase font-bold text-amber-400 px-1">
                    Instant Demo Vault Logins:
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto pr-1 font-mono text-xs">
                    {allUsers.slice(0, 6).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          onSelectUser(u.id);
                          handleClose();
                        }}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 hover:bg-emerald-950 border border-slate-800 hover:border-amber-400/50 text-slate-200 transition-all cursor-pointer"
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="font-bold text-white text-xs truncate">{u.username}</span>
                        </div>
                        <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded">
                          {u.currency}
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
