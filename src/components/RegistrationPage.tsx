import React from 'react';
import { motion } from 'motion/react';
import {
  Crown,
  Sparkles,
  ShieldCheck,
  Zap,
  Flame,
  Award,
  ChevronLeft,
  Coins,
  Globe
} from 'lucide-react';
import { Play369AuthCard } from './auth/Play369AuthCard';
import { Play369BrandLogo } from './Play369BrandLogo';

interface RegistrationPageProps {
  onBackToHome?: () => void;
  onBackToLobby?: () => void;
  onAuthSuccess?: () => void;
  onLoginSuccess?: (user: any, wallet: any) => void;
  allUsers?: any[];
  initialMode?: 'login' | 'register';
}

export const RegistrationPage: React.FC<RegistrationPageProps> = ({
  onBackToHome,
  onBackToLobby,
  onAuthSuccess,
  onLoginSuccess,
  allUsers = [],
  initialMode = 'register'
}) => {
  const handleExit = onBackToLobby || onBackToHome;
  const handleSuccess = () => {
    if (onLoginSuccess && allUsers.length > 0) {
      onLoginSuccess(allUsers[0], null);
    }
    if (onAuthSuccess) onAuthSuccess();
    if (handleExit) handleExit();
  };
  return (
    <div
      id="play369-registration-page"
      className="min-h-screen min-h-[100dvh] min-h-[100svh] w-full bg-[#021008] text-white flex flex-col justify-between relative overflow-x-hidden overflow-y-auto"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)'
      }}
    >
      {/* Background Ambience & Golden Flare Orbs */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[160px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-emerald-950/30 via-transparent to-black" />
      </div>

      {/* Top Header Bar */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3.5 sm:py-6 flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-3">
          {handleExit && (
            <button
              onClick={handleExit}
              className="min-h-[48px] px-3 sm:px-3.5 rounded-xl bg-slate-900/80 hover:bg-emerald-950 border border-emerald-800/60 text-emerald-300 hover:text-white flex items-center space-x-1 sm:space-x-1.5 text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-md select-none active:scale-[0.99]"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Lobby</span>
            </button>
          )}

          <Play369BrandLogo size="sm" variant="horizontal" />
        </div>

        {/* Live Safety Badge */}
        <div className="hidden sm:flex items-center space-x-2 bg-[#02180e] border border-emerald-800/60 px-3 py-1.5 rounded-full text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-300 font-bold">Player Session Active</span>
        </div>
      </header>

      {/* Main Content: Responsive Split Layout */}
      <main className="relative z-20 flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-10 flex items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Platform Features (5 cols on Desktop) */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="hidden lg:flex lg:col-span-5 flex-col space-y-6"
          >
            <div className="flex flex-col items-start space-y-4">
              <Play369BrandLogo size="xl" glow={true} className="self-start" />

              <h1 className="text-3xl xl:text-4xl font-black text-white leading-tight tracking-tight">
                Unified Player Vault with <span className="text-amber-400">Dual Currency</span> Support
              </h1>

              <p className="text-sm text-emerald-200/80 leading-relaxed font-medium">
                Access interactive games with integrated BDT (৳) and USD ($) balances, real-time transaction updates, and secure player session controls.
              </p>
            </div>

            {/* Feature Cards Grid (Golden Ratio Proportions) */}
            <div className="grid grid-cols-1 gap-3.5 pt-2 font-sans">
              <div className="p-4 rounded-2xl bg-[#042013]/80 border border-emerald-800/60 flex items-start space-x-3.5 shadow-lg">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Dual BDT &amp; USD Wallets</h4>
                  <p className="text-xs text-emerald-200/70 mt-0.5">
                    Maintain balances in Bangladeshi Taka or US Dollars with synchronized records.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#042013]/80 border border-emerald-800/60 flex items-start space-x-3.5 shadow-lg">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Direct Game Synchronization</h4>
                  <p className="text-xs text-emerald-200/70 mt-0.5">
                    Automatic transaction logging and balance refresh across all supported games.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#042013]/80 border border-emerald-800/60 flex items-start space-x-3.5 shadow-lg">
                <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Verified Account Management</h4>
                  <p className="text-xs text-emerald-200/70 mt-0.5">
                    Secure password protection, session controls, and customizable profile settings.
                  </p>
                </div>
              </div>
            </div>

            {/* Platform Badges */}
            <div className="flex items-center space-x-6 pt-2 text-xs text-emerald-300/80 font-medium">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Player Protection</span>
              </div>
              <div className="flex items-center space-x-2">
                <Globe className="w-4 h-4 text-amber-400" />
                <span>18+ Responsible Play</span>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Interactive Golden-Ratio Auth Card (7 cols on Desktop, Full on Mobile) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-full lg:col-span-7 flex justify-center"
          >
            <div className="w-full max-w-[480px]">
              <Play369AuthCard
                initialMode={initialMode}
                onSuccess={handleSuccess}
                onClose={handleExit}
              />
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer Legal & Responsibility Notice */}
      <footer className="relative z-20 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 text-center text-xs text-emerald-300/60 font-sans border-t border-emerald-900/40">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <span className="text-[11px] sm:text-xs">&copy; {new Date().getFullYear()} PLAY369 Interactive Entertainment. All rights reserved.</span>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] sm:text-[11px] text-emerald-300/80">
            <span className="hover:text-white cursor-pointer select-none">Fair Play Certification</span>
            <span>•</span>
            <span className="hover:text-white cursor-pointer select-none">Privacy Policy</span>
            <span>•</span>
            <span className="hover:text-white cursor-pointer select-none">18+ Only</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
