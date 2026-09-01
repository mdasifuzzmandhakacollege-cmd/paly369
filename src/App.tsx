/**
 * @file App.tsx
 * @description Enterprise Full-Stack iGaming Application Shell for "Playall 365".
 * Connects the Global Wallet Game State Manager (Zustand/React Context),
 * Authentic PG Soft & JILI Simulators, Real-Time Audio Engine, Error Boundaries,
 * and Robust State-Based Fallback Routing to eliminate blank screens.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { CelebrationModal } from './components/CelebrationModal';
import { RegistrationPage } from './components/RegistrationPage';
import { GameLobby } from './components/GameLobby';
import { MiniGameLauncher } from './components/MiniGameLauncher';
import { CashierView } from './components/CashierView';
import { UserProfileView } from './components/UserProfileView';
import { AffiliateDashboard } from './components/AffiliateDashboard';
import { VipProgressionView } from './components/VipProgressionView';
import { PromotionHub } from './components/PromotionHub';
import { WageringRequirements } from './components/WageringRequirements';
import { GoogleDrivePickerHub } from './components/GoogleDrivePickerHub';
import { ProviderSimulator } from './components/ProviderSimulator';
import { EndpointPayloadLogViewer } from './components/EndpointPayloadLogViewer';
import { ConcurrencyStressTester } from './components/ConcurrencyStressTester';
import { LedgerExplorer } from './components/LedgerExplorer';
import { CodeViewer } from './components/CodeViewer';
import { ArchitectureGuide } from './components/ArchitectureGuide';
import { HMACDebugger } from './components/HMACDebugger';
import { LatencyMonitor } from './components/LatencyMonitor';
import { DeadlockSimulator } from './components/DeadlockSimulator';
import { TpsCapacityGauge } from './components/TpsCapacityGauge';
import { CacheDiagnostics } from './components/CacheDiagnostics';
import { WalletAutoSync } from './components/WalletAutoSync';
import { ApiRateMonitor } from './components/ApiRateMonitor';
import { IdleSessionLockModal } from './components/IdleSessionLockModal';
import { AuthModal } from './components/AuthModal';
import { InstallPwaButton } from './components/InstallPwaButton';
import { AdminPanel } from './components/AdminPanel';
import { TransactionAuditLog } from './components/TransactionAuditLog';
import { SystemErrorsMonitor } from './components/SystemErrorsMonitor';
import { SecurityDashboard } from './components/SecurityDashboard';
import { WebhookInspector } from './components/WebhookInspector';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SandboxPaymentTestView } from './components/SandboxPaymentTestView';
import { useErrorReporter } from './hooks/useErrorReporter';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { WalletGameProvider, useWalletGame, MainNavTab } from './contexts/WalletGameContext';
import {
  ShieldCheck,
  Zap,
  CheckCircle2,
  Terminal,
  Activity,
  Lock,
  Layers,
  RefreshCw,
  FileCode2,
  BookOpen,
  RotateCcw,
  AlertOctagon,
  ShieldAlert,
  Webhook,
  Home,
  CreditCard,
  Gamepad2,
  HelpCircle
} from 'lucide-react';

export type WorkbenchSubTabType =
  | 'simulator'
  | 'payloadLogs'
  | 'webhooks'
  | 'security'
  | 'latency'
  | 'concurrency'
  | 'deadlock'
  | 'ledger'
  | 'code'
  | 'architecture'
  | 'hmac'
  | 'cache'
  | 'autosync'
  | 'apiRate'
  | 'errors'
  | 'sandboxPayment';

/**
 * Fallback component rendered when an unrecognized tab state is encountered
 */
interface FallbackTabStateProps {
  invalidTab?: string;
  isAdmin?: boolean;
  onReset: () => void;
  onOpenCashier: () => void;
  onOpenWorkbench: () => void;
}

const FallbackTabState: React.FC<FallbackTabStateProps> = ({
  invalidTab,
  isAdmin,
  onReset,
  onOpenCashier,
  onOpenWorkbench
}) => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6 animate-fadeIn">
      <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-xl shadow-amber-500/10">
        <HelpCircle className="w-10 h-10 animate-bounce" />
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl sm:text-3xl font-black text-white font-bengali">
          পৃষ্ঠাটি খুঁজে পাওয়া যায়নি (View Not Found)
        </h2>
        <p className="text-sm text-slate-400 font-mono">
          Requested route tab: <code className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300 font-bold">"{invalidTab || 'undefined'}"</code> is not mapped to a valid view.
        </p>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 max-w-md mx-auto text-xs text-slate-400 space-y-2 font-mono">
        <p className="text-slate-300 font-bold">Automatic Fallback Activated:</p>
        <p>A safe fallback state has intercepted the missing view to guarantee zero blank screens across all device viewports.</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
        <button
          onClick={onReset}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm flex items-center space-x-2 shadow-lg shadow-amber-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer font-bengali"
        >
          <Home className="w-4 h-4" />
          <span>ক্যাসিনো লবিতে ফিরে যান (Lobby)</span>
        </button>

        <button
          onClick={onOpenCashier}
          className="px-6 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-sm flex items-center space-x-2 shadow-md transition-all cursor-pointer font-bengali"
        >
          <CreditCard className="w-4 h-4" />
          <span>ক্যাশিয়ার (Cashier)</span>
        </button>

        {isAdmin && (
          <button
            onClick={onOpenWorkbench}
            className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 font-bold text-sm flex items-center space-x-2 transition-all cursor-pointer font-mono"
          >
            <Terminal className="w-4 h-4" />
            <span>B2B Workbench</span>
          </button>
        )}
      </div>
    </div>
  );
};

function Playall365InnerApp() {
  // Automated Firestore Error Reporting Hook - captures API failures, stack traces & pushes to 'SystemErrors'
  const {
    errors: systemErrors,
    newErrorsCount,
    triggerTestError,
    resolveError,
    markInvestigating,
    clearLocalErrors
  } = useErrorReporter();

  const {
    isAuthenticated,
    setIsAuthenticated,
    currentUser,
    currentWallet,
    isAdmin,
    users,
    currency,
    activeTab,
    setActiveTab,
    activeGameId,
    launchGame,
    loginUser,
    switchUser,
    refreshState,
    toastMessage,
    showToast,
    celebrationData,
    clearCelebration,
    isIdleLocked,
    unlockIdleSession,
    logoutUser
  } = useWalletGame();

  const [workbenchSubTab, setWorkbenchSubTab] = useState<WorkbenchSubTabType>('simulator');
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);

  // Sync workbenchSubTab when activeTab is directly navigated to a workbench view alias
  useEffect(() => {
    const workbenchTabAliases: Record<string, WorkbenchSubTabType> = {
      workbench: 'simulator',
      stress: 'concurrency',
      concurrency: 'concurrency',
      latency: 'latency',
      deadlock: 'deadlock',
      hmac: 'hmac',
      ledger: 'ledger',
      code: 'code',
      architecture: 'architecture',
      security: 'security',
      webhooks: 'webhooks',
      errors: 'errors',
      cache: 'cache',
      autosync: 'autosync',
      apiRate: 'apiRate',
      sandboxPayment: 'sandboxPayment',
      sandbox: 'sandboxPayment'
    };

    if (workbenchTabAliases[activeTab]) {
      setWorkbenchSubTab(workbenchTabAliases[activeTab]);
    }
  }, [activeTab]);

  // Determine if active tab is any workbench view
  const isWorkbenchTab = useMemo(() => {
    return [
      'workbench',
      'latency',
      'stress',
      'concurrency',
      'hmac',
      'ledger',
      'architecture',
      'code',
      'deadlock',
      'security',
      'webhooks',
      'errors',
      'cache',
      'autosync',
      'apiRate',
      'sandboxPayment'
    ].includes(activeTab);
  }, [activeTab]);

  // Route Protection: Prevent unauthorized users from staying on admin/audit/workbench tabs
  useEffect(() => {
    const isPrivilegedTab = activeTab === 'admin' || activeTab === 'audit' || isWorkbenchTab;
    if (isPrivilegedTab && !isAdmin) {
      setActiveTab('lobby');
    }
  }, [activeTab, isAdmin, isWorkbenchTab, setActiveTab]);

  // 1. If not authenticated, display the dedicated Registration & Auth Landing Page with instant Lobby return option
  if (!isAuthenticated) {
    return (
      <RegistrationPage
        onLoginSuccess={(user, wallet) => {
          loginUser(user, wallet);
        }}
        allUsers={users}
        onBackToLobby={() => {
          setIsAuthenticated(true);
          setActiveTab('lobby');
        }}
      />
    );
  }

  /**
   * Safe Renderer for B2B Workbench Sub-tabs with Fallback Protection
   */
  const renderWorkbenchContent = () => {
    switch (workbenchSubTab) {
      case 'simulator':
        return (
          <ProviderSimulator
            currentUser={currentUser}
            currentWallet={currentWallet}
            onLedgerMutated={refreshState}
          />
        );

      case 'payloadLogs':
        return (
          <EndpointPayloadLogViewer
            currentUser={currentUser}
            currentWallet={currentWallet}
            onLedgerMutated={refreshState}
            initialEndpointFilter="all"
          />
        );

      case 'webhooks':
        return <WebhookInspector />;

      case 'security':
        return <SecurityDashboard />;

      case 'errors':
        return (
          <SystemErrorsMonitor
            errors={systemErrors}
            onTriggerTestError={triggerTestError}
            onResolveError={resolveError}
            onMarkInvestigating={markInvestigating}
            onClearLocal={clearLocalErrors}
          />
        );

      case 'latency':
        return <LatencyMonitor />;

      case 'concurrency':
        return (
          <ConcurrencyStressTester
            currentUser={currentUser}
            currentWallet={currentWallet}
            onLedgerMutated={refreshState}
          />
        );

      case 'deadlock':
        return (
          <DeadlockSimulator
            currentUser={currentUser}
            currentWallet={currentWallet}
            onLedgerMutated={refreshState}
          />
        );

      case 'hmac':
        return <HMACDebugger />;

      case 'ledger':
        return <LedgerExplorer onRefresh={refreshState} />;

      case 'code':
        return <CodeViewer />;

      case 'architecture':
        return <ArchitectureGuide />;

      case 'cache':
        return <CacheDiagnostics />;

      case 'autosync':
        return <WalletAutoSync />;

      case 'apiRate':
        return <ApiRateMonitor />;

      case 'sandboxPayment':
        return import.meta.env.DEV ? <SandboxPaymentTestView /> : null;

      default:
        // Safe fallback to simulator if subtab state is desynchronized
        return (
          <ProviderSimulator
            currentUser={currentUser}
            currentWallet={currentWallet}
            onLedgerMutated={refreshState}
          />
        );
    }
  };

  /**
   * Deterministic Main Content View Router with Fallback Protection
   */
  const renderMainContent = () => {
    // 1. CASINO LOBBY
    if (activeTab === 'lobby') {
      return (
        <GameLobby
          currentUser={currentUser}
          currentWallet={currentWallet}
          currency={currency}
          onLaunchGame={launchGame}
          onOpenCashier={() => setActiveTab('cashier')}
          onNavigateTab={setActiveTab}
        />
      );
    }

    // 2. LIVE INTERACTIVE MINI-GAMES & SIMULATORS
    if (activeTab === 'games') {
      return (
        <MiniGameLauncher
          defaultGameId={activeGameId}
          onBackToLobby={() => setActiveTab('lobby')}
          onOpenCashier={() => setActiveTab('cashier')}
        />
      );
    }

    // 3. VIP PROGRESSION & LADDER (V1 to V10)
    if (activeTab === 'vip') {
      return (
        <VipProgressionView
          currentUser={currentUser}
          currentWallet={currentWallet}
          currency={currency}
          onBonusClaimed={refreshState}
        />
      );
    }

    // 4. MULTI-TIER AFFILIATE & COMMISSION ENGINE (MLM Tree)
    if (activeTab === 'affiliate') {
      return (
        <AffiliateDashboard
          currentUser={currentUser}
          currentWallet={currentWallet}
          currency={currency}
          onCommissionClaimed={refreshState}
        />
      );
    }

    // 5. PROMOTION & EVENT HUB (Daily Check-in & Lucky Wheel)
    if (activeTab === 'promo') {
      return (
        <PromotionHub
          currentUser={currentUser}
          currentWallet={currentWallet}
          currency={currency}
          onRewardClaimed={refreshState}
        />
      );
    }

    // 5.1 DEDICATED WAGERING & ROLLOVER TURNOVER PROGRESS VIEW
    if (activeTab === 'wagering') {
      return (
        <div className="max-w-6xl mx-auto px-4 py-6">
          <WageringRequirements
            currentUser={currentUser}
            currentWallet={currentWallet}
            currency={currency}
            onConversionSuccess={refreshState}
          />
        </div>
      );
    }

    // 5.2 GOOGLE DRIVE PICKER & KYC DOCUMENT VAULT
    if (activeTab === 'drive_vault') {
      return (
        <div className="max-w-6xl mx-auto px-4 py-6">
          <GoogleDrivePickerHub
            currentUser={currentUser}
            onKycUpdated={refreshState}
          />
        </div>
      );
    }

    // 6. CASHIER (bKash, Nagad, Rocket, Upay Deposits & Withdrawals)
    if (activeTab === 'cashier') {
      return (
        <CashierView
          currentUser={currentUser}
          currentWallet={currentWallet}
          currency={currency}
          onLedgerMutated={refreshState}
          onClose={() => setActiveTab('lobby')}
        />
      );
    }

    // 7. VIP PROFILE & DOUBLE-ENTRY LEDGER
    if (activeTab === 'profile') {
      return (
        <UserProfileView
          currentUser={currentUser}
          currentWallet={currentWallet}
          currency={currency}
          onOpenCashier={() => setActiveTab('cashier')}
        />
      );
    }

    // 7.1 ROLE-BASED OPERATOR ADMIN PANEL (Strictly Guarded with Server & Firestore Check)
    if (activeTab === 'admin') {
      if (!isAdmin) {
        return (
          <GameLobby
            currentUser={currentUser}
            currentWallet={currentWallet}
            currency={currency}
            onLaunchGame={launchGame}
            onOpenCashier={() => setActiveTab('cashier')}
            onNavigateTab={setActiveTab}
          />
        );
      }
      return (
        <AdminPanel
          onStateMutated={refreshState}
          onClose={() => setActiveTab('lobby')}
          onRedirect={(targetTab) => setActiveTab(targetTab as any)}
        />
      );
    }

    // 7.2 CRYPTOGRAPHIC TRANSACTION AUDIT LOG
    if (activeTab === 'audit') {
      if (!isAdmin) {
        return (
          <GameLobby
            currentUser={currentUser}
            currentWallet={currentWallet}
            currency={currency}
            onLaunchGame={launchGame}
            onOpenCashier={() => setActiveTab('cashier')}
            onNavigateTab={setActiveTab}
          />
        );
      }
      return (
        <TransactionAuditLog
          onNavigateToLedger={() => {
            setActiveTab('workbench');
            setWorkbenchSubTab('ledger');
          }}
        />
      );
    }

    // 8. B2B SEAMLESS WORKBENCH (Developer & Architect View)
    if (isWorkbenchTab) {
      if (!isAdmin) {
        return (
          <GameLobby
            currentUser={currentUser}
            currentWallet={currentWallet}
            currency={currency}
            onLaunchGame={launchGame}
            onOpenCashier={() => setActiveTab('cashier')}
            onNavigateTab={setActiveTab}
          />
        );
      }
      return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Workbench Navigation Header */}
          <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-base font-black text-white flex items-center space-x-2">
                <Terminal className="w-5 h-5 text-cyan-400" />
                <span>B2B Seamless Integration Workbench</span>
              </h1>
              <p className="text-xs text-slate-400 font-mono">
                Test HTTP HMAC calls, &lt;4s SLA Latency Telemetry, 100-thread race conditions, row-level locks, and deadlock resolution.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  refreshState();
                  showToast('PostgreSQL Ledger & Wallets synced');
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Sync DB State</span>
              </button>
            </div>
          </div>

          {/* Live TPS Capacity Gauge Widget */}
          <TpsCapacityGauge
            onStressTestClick={() => {
              setWorkbenchSubTab('concurrency');
            }}
          />

          {/* Workbench Subtabs */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 font-mono text-xs scrollbar-none">
            {[
              { id: 'simulator', label: 'HTTP / API Simulator', icon: Zap },
              { id: 'payloadLogs', label: 'Payload Logs (/balance, /bet, /win)', icon: Terminal },
              { id: 'webhooks', label: 'Webhook Inspector', icon: Webhook },
              { id: 'security', label: 'Security & HMAC Guard', icon: ShieldCheck },
              {
                id: 'errors',
                label: `Firestore Errors (${systemErrors.length})`,
                icon: ShieldAlert,
                badge: newErrorsCount > 0 ? newErrorsCount : undefined
              },
              { id: 'latency', label: 'Latency SLA Monitor', icon: Activity },
              { id: 'cache', label: 'Cache & State Sync', icon: Layers },
              { id: 'autosync', label: 'Live Auto-Sync', icon: RefreshCw },
              { id: 'apiRate', label: 'API Rate Monitor', icon: Activity },
              { id: 'concurrency', label: '100-Thread Stress Test', icon: Activity },
              { id: 'deadlock', label: 'Deadlock Simulation', icon: AlertOctagon },
              { id: 'hmac', label: 'HMAC SHA-256 Inspector', icon: Lock },
              { id: 'ledger', label: 'PostgreSQL Ledger', icon: Layers },
              { id: 'code', label: 'API Code & Schema', icon: FileCode2 },
              { id: 'architecture', label: 'Architecture SLA Spec', icon: BookOpen },
              ...(import.meta.env.DEV
                ? [{ id: 'sandboxPayment', label: '🧪 Sandbox Payments (Task 6.2C)', icon: ShieldCheck }]
                : [])
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = workbenchSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setWorkbenchSubTab(tab.id as WorkbenchSubTabType);
                  }}
                  className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? tab.id === 'errors'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-md'
                        : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-md'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      tab.id === 'errors' && newErrorsCount > 0 ? 'text-rose-400 animate-pulse' : ''
                    }`}
                  />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span className="bg-rose-500 text-slate-950 font-black px-1.5 py-0.2 rounded-full text-[9px]">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Subtab Contents Protected by ErrorBoundary */}
          <div className="pt-2">
            <ErrorBoundary fallbackTitle="ওয়ার্কবেঞ্চ সাব-কম্পোনেন্ট রেন্ডারিং ত্রুটি">
              {renderWorkbenchContent()}
            </ErrorBoundary>
          </div>
        </div>
      );
    }

    // 9. DEFAULT FALLBACK STATE: Renders graceful fallback instead of returning null / blank page
    return (
      <FallbackTabState
        invalidTab={String(activeTab)}
        isAdmin={isAdmin}
        onReset={() => setActiveTab('lobby')}
        onOpenCashier={() => setActiveTab('cashier')}
        onOpenWorkbench={() => setActiveTab('workbench')}
      />
    );
  };

  // 2. Once Registered / Logged In, display the authenticated PLAY369 Application Shell
  return (
    <div
      id="play369-app-shell"
      className="min-h-screen bg-[#02180e] bg-gradient-to-b from-[#02180e] via-[#042013] to-[#02180e] text-slate-100 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950 w-full max-w-full overflow-x-hidden"
    >
      {/* Responsive Top Header */}
      <Navbar
        onOpenCashier={() => setActiveTab('cashier')}
        onOpenProfile={() => setActiveTab('profile')}
      />

      {/* Main Content Container with Golden-Ratio-based spacing and Safe-Area Support */}
      <main
        id="play369-main-container"
        className="flex-1 w-full pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-10 transition-all duration-300"
      >
        <ErrorBoundary fallbackTitle="ভিউ রেন্ডারিং সমস্যা">
          {renderMainContent()}
        </ErrorBoundary>
      </main>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        allUsers={users}
        onSelectUser={(userId) => {
          switchUser(userId);
          showToast('VIP Player authentication successful');
        }}
      />

      {/* Global Mega Win & Celebration Modal */}
      {celebrationData && (
        <CelebrationModal
          isOpen={!!celebrationData}
          onClose={clearCelebration}
          title={celebrationData.title}
          subtitle={celebrationData.gameTitle || 'Mega Payout Triggered!'}
          rewardAmount={celebrationData.amount}
          currency={celebrationData.currency}
          type="MEGA_WIN"
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 lg:bottom-6 right-6 z-50 bg-[#02180e]/95 backdrop-blur-md border border-amber-400/60 text-amber-300 px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 text-xs font-mono">
          <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Global Idle Auto-Lock Modal (5 minutes inactivity) */}
      <IdleSessionLockModal
        isOpen={isIdleLocked}
        username={currentUser?.username || 'Player'}
        userEmail={currentUser?.email}
        onUnlock={unlockIdleSession}
        onLogout={logoutUser}
      />

      {/* Floating PWA Install Button for Mobile */}
      <InstallPwaButton isFloating />

      {/* Mobile Sticky Bottom Navigation (PWA / Mobile-First with Safe-Area support) */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCashier={() => setActiveTab('cashier')}
      />

      {/* Emerald & Gold Footer */}
      <footer className="bg-[#02180e] border-t border-emerald-800/80 py-6 text-xs text-emerald-300/80 pb-24 lg:pb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-bold text-white font-mono">
              PLAY369 Platform • High Performance Gaming Architecture
            </span>
          </div>

          <div className="flex items-center space-x-6 text-[11px] font-mono text-emerald-300/80">
            <span>🇧🇩 bKash / Nagad Direct Gateway</span>
            <span>🔒 HMAC-SHA256 Signed</span>
            <span>⚡ SLA &lt; 4s Response Time</span>
            <span>🛡️ PostgreSQL ACID Row-Locked</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary fallbackTitle="অ্যাপ্লিকেশন ইনিশিয়ালাইজেশন ত্রুটি">
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <WalletGameProvider>
              <Playall365InnerApp />
            </WalletGameProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
