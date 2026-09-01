/**
 * @file WalletGameContext.tsx
 * @description Enterprise Global State Manager for Playall 365 B2B Seamless Wallet & Mobile UX.
 * Provides unified, reactive access to authenticated user profile, real-time animated balances,
 * seamless transaction dispatchers, sound engine, and tab navigation.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { UserEntity, WalletEntity, TransactionEntity } from '../server/types/seamless';
import { seamlessEngine } from '../services/simulatedWalletEngine';
import { soundEngine } from '../services/soundEngine';
import { useAuth } from './AuthContext';
import { firebaseFirestore } from '../services/firebaseFirestoreService';

export type MainNavTab =
  | 'lobby'
  | 'games'
  | 'cashier'
  | 'profile'
  | 'admin'
  | 'audit'
  | 'affiliate'
  | 'vip'
  | 'promo'
  | 'wagering'
  | 'drive_vault'
  | 'workbench'
  | 'latency'
  | 'stress'
  | 'concurrency'
  | 'hmac'
  | 'ledger'
  | 'architecture'
  | 'code'
  | 'deadlock'
  | 'security'
  | 'webhooks'
  | 'errors'
  | 'cache'
  | 'autosync'
  | 'apiRate'
  | 'sandboxPayment';

interface BetRequestParams {
  providerId: string;
  gameId: string;
  amount: number;
  roundId?: string;
  customTxId?: string;
}

interface WinRequestParams {
  providerId: string;
  gameId: string;
  amount: number;
  roundId: string;
  referenceBetTxId: string;
  customTxId?: string;
}

interface RefundRequestParams {
  providerId: string;
  gameId: string;
  amount: number;
  roundId: string;
  referenceBetTxId: string;
  reason?: string;
}

export interface LiveActivityItem {
  id: string;
  username: string;
  userId: string;
  gameId: string;
  gameTitle: string;
  provider: string;
  type: 'WIN' | 'BET' | 'JACKPOT' | 'REFUND';
  amount: number;
  currency: string;
  multiplier?: number;
  timestamp: number;
  isCurrentPlayer?: boolean;
}

export interface CelebrationData {
  title: string;
  amount: number;
  currency: string;
  multiplier?: number;
  gameTitle?: string;
}

interface WalletGameContextType {
  // Auth & User Profile
  isAuthenticated: boolean;
  setIsAuthenticated: (auth: boolean) => void;
  isAdmin: boolean;
  userRole: 'ADMIN' | 'PLAYER' | 'VIP';
  currentUser: UserEntity;
  currentWallet: WalletEntity | undefined;
  users: UserEntity[];
  wallets: WalletEntity[];
  transactions: TransactionEntity[];
  liveActivities: LiveActivityItem[];
  selectedUserId: string;
  setSelectedUserId: (id: string) => void;
  currency: 'BDT' | 'USD';
  setCurrency: (curr: 'BDT' | 'USD') => void;
  toggleCurrency: () => void;
  switchUser: (userId: string) => void;
  loginUser: (user: UserEntity, wallet: WalletEntity) => void;
  logoutUser: () => void;
  refreshState: () => void;
  topUpWallet: (amount: number, targetUserId?: string, targetCurrency?: string) => void;
  resetWalletToZero: (targetUserId?: string, targetCurrency?: 'BDT' | 'USD') => Promise<WalletEntity>;
  registerNewUser: (params: {
    username: string;
    email?: string;
    phone?: string;
    currency?: 'BDT' | 'USD';
    promoCode?: string;
  }) => Promise<{ user: UserEntity; wallet: WalletEntity }>;

  // Real-time Animated Balance
  animatedBalance: number;
  formattedBalance: string;
  balanceFlash: 'idle' | 'deduct' | 'credit';

  // Navigation Tabs
  activeTab: MainNavTab;
  setActiveTab: (tab: MainNavTab) => void;
  activeGameId: string;
  setActiveGameId: (gameId: string) => void;
  launchGame: (gameId: string) => void;

  // Seamless Wallet Operations
  placeSeamlessBet: (params: BetRequestParams) => Promise<{ success: boolean; txId: string; roundId: string; error?: string }>;
  settleSeamlessWin: (params: WinRequestParams) => Promise<{ success: boolean; txId: string; error?: string }>;
  settleSeamlessRefund: (params: RefundRequestParams) => Promise<{ success: boolean; txId: string; error?: string }>;

  // Sound Engine
  soundMuted: boolean;
  toggleSound: () => void;
  audioEngine: typeof soundEngine;

  // Toast & Celebrations
  toastMessage: string | null;
  showToast: (msg: string) => void;
  celebrationData: CelebrationData | null;
  triggerCelebration: (data: CelebrationData) => void;
  clearCelebration: () => void;

  // Global Idle Auto-Lock (5 minutes of inactivity)
  isIdleLocked: boolean;
  unlockIdleSession: () => void;
  lockIdleSession: () => void;
  recordUserActivity: () => void;
}

const WalletGameContext = createContext<WalletGameContextType | undefined>(undefined);

export const useWalletGame = () => {
  const context = useContext(WalletGameContext);
  if (!context) {
    throw new Error('useWalletGame must be used within a WalletGameProvider');
  }
  return context;
};

export const WalletGameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: authUser, logout: authLogout, isAdmin: authIsAdmin, userRole: authUserRole } = useAuth();

  // Tab & Game State with Navigation Audio Feedback
  const [activeTab, setActiveTabState] = useState<MainNavTab>('lobby');
  const [activeGameId, setActiveGameId] = useState<string>('pgsoft_mahjong_ways2');

  const setActiveTab = useCallback((tab: MainNavTab) => {
    setActiveTabState((prev) => {
      if (prev !== tab) {
        soundEngine.playNavClick();
      }
      return tab;
    });
  }, []);

  // Currency State
  const [currency, setCurrency] = useState<'BDT' | 'USD'>('BDT');

  // Real-time Entities State
  const [currentUser, setCurrentUser] = useState<UserEntity>(() => {
    const localUsers = seamlessEngine.getUsers();
    return {
      id: authUser?.uid || localUsers[0]?.id || 'u_sakib_01',
      username: authUser?.displayName || (authUser?.email ? authUser.email.split('@')[0] : localUsers[0]?.username || 'Sakib_VIP'),
      operator_id: 'GAMEPLAY365_LIVE',
      currency: 'BDT',
      status: 'ACTIVE',
      country_code: 'BD',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  });

  // Authority is STRICTLY server-verified isPrivileged / authIsAdmin from AuthContext
  const isAdmin = Boolean(authIsAdmin);

  const userRole: 'ADMIN' | 'PLAYER' | 'VIP' = isAdmin
    ? 'ADMIN'
    : (authUserRole === 'VIP' ? 'VIP' : 'PLAYER');

  const [currentWallet, setCurrentWallet] = useState<WalletEntity>(() => {
    const localWallets = seamlessEngine.getWallets();
    const uid = authUser?.uid || currentUser.id;
    const w = localWallets.find((item) => item.user_id === uid && item.currency === 'BDT') || localWallets[0];
    return w || {
      id: `w_${uid}_bdt`,
      user_id: uid,
      currency: 'BDT',
      real_balance: 0,
      bonus_balance: 0,
      locked_balance: 0,
      version: 1,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  });

  const [users, setUsers] = useState<UserEntity[]>(() => seamlessEngine.getUsers());
  const [wallets, setWallets] = useState<WalletEntity[]>(() => seamlessEngine.getWallets());
  const [transactions, setTransactions] = useState<TransactionEntity[]>(() => seamlessEngine.getTransactions());
  const [selectedUserId, setSelectedUserId] = useState<string>(authUser?.uid || 'u_sakib_01');

  const [sessionAuthenticated, setSessionAuthenticated] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('playall365_session_active');
      if (stored === 'false') return false;
      return true; // Default to active session for instant casino lobby entry
    } catch {
      return true;
    }
  });

  const isAuthenticated = authUser !== null || sessionAuthenticated;
  const setIsAuthenticated = useCallback((authStatus: boolean) => {
    setSessionAuthenticated(authStatus);
    try {
      if (authStatus) {
        localStorage.setItem('playall365_session_active', 'true');
      } else {
        localStorage.removeItem('playall365_session_active');
        localStorage.removeItem('playall365_user_id');
        authLogout();
      }
    } catch {
      // Ignore storage errors
    }
  }, [authLogout]);

  // Real-time Live Activity Feed
  const [liveActivities, setLiveActivities] = useState<LiveActivityItem[]>([]);

  // Sound State
  const [soundMuted, setSoundMuted] = useState<boolean>(() => soundEngine.getIsMuted());

  // Toast & Celebration Modal State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [celebrationData, setCelebrationData] = useState<CelebrationData | null>(null);

  // Global Idle Auto-Lock State (5 minutes = 300,000 ms)
  const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
  const [isIdleLocked, setIsIdleLocked] = useState<boolean>(false);
  const lastActivityTimestampRef = useRef<number>(Date.now());
  const idleCheckIntervalRef = useRef<any>(null);

  const recordUserActivity = useCallback(() => {
    lastActivityTimestampRef.current = Date.now();
  }, []);

  const lockIdleSession = useCallback(() => {
    setIsIdleLocked(true);
  }, []);

  const unlockIdleSession = useCallback(() => {
    lastActivityTimestampRef.current = Date.now();
    setIsIdleLocked(false);
  }, []);

  // Global Listeners for UI interaction & Transaction/Game activity
  useEffect(() => {
    if (!isAuthenticated || isIdleLocked) return;

    const handleUserInteraction = () => {
      recordUserActivity();
    };

    const interactionEvents = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    interactionEvents.forEach((evt) => {
      window.addEventListener(evt, handleUserInteraction, { passive: true });
    });

    // Background interval checking for 5 minutes of inactivity
    idleCheckIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastActivityTimestampRef.current;
      if (elapsed >= IDLE_TIMEOUT_MS) {
        setIsIdleLocked(true);
      }
    }, 10000); // Check every 10s

    return () => {
      interactionEvents.forEach((evt) => {
        window.removeEventListener(evt, handleUserInteraction);
      });
      if (idleCheckIntervalRef.current) {
        clearInterval(idleCheckIntervalRef.current);
      }
    };
  }, [isAuthenticated, isIdleLocked, recordUserActivity, IDLE_TIMEOUT_MS]);

  // Animated Balance State for smooth interpolation
  const [animatedBalance, setAnimatedBalance] = useState<number>(0);
  const [balanceFlash, setBalanceFlash] = useState<'idle' | 'deduct' | 'credit'>('idle');
  const animationTimerRef = useRef<any>(null);

  // Sync real-time Firebase Auth user and attach real-time Firestore listeners
  useEffect(() => {
    // Test server connection on boot
    firebaseFirestore.testConnection();

    if (authUser && authUser.uid) {
      let isMounted = true;
      const targetUid = authUser.uid;

      // Sync and ensure initial user profile in Firestore
      firebaseFirestore.syncUserProfile({
        uid: targetUid,
        email: authUser.email || `${currentUser.username}@playall365.vip`,
        displayName: authUser.displayName || currentUser.username,
        photoURL: authUser.photoURL,
        phoneNumber: authUser.phoneNumber || currentUser.phone
      }, currency).then((syncedProfile) => {
        if (isMounted && syncedProfile) {
          setCurrentUser(syncedProfile);
          setSelectedUserId(syncedProfile.id);
          setUsers((prev) => {
            const others = prev.filter((u) => u.id !== syncedProfile.id);
            return [syncedProfile, ...others];
          });
        }
      }).catch(console.error);

      // 1. Real-time User Profile Listener
      const unsubProfile = firebaseFirestore.subscribeToUserProfile(targetUid, (liveProfile) => {
        if (isMounted && liveProfile) {
          setCurrentUser(liveProfile);
          setUsers((prev) => {
            const others = prev.filter((u) => u.id !== liveProfile.id);
            return [liveProfile, ...others];
          });
        }
      });

      // 2. Real-time Active Currency Wallet Listener
      const unsubWallet = firebaseFirestore.subscribeToWallet(targetUid, currency, (liveWallet) => {
        if (isMounted && liveWallet) {
          setCurrentWallet(liveWallet);
        }
      });

      // 3. Real-time All User Wallets Listener (Multi-currency reactive sync)
      const unsubAllWallets = firebaseFirestore.subscribeToAllWallets(targetUid, (liveWallets) => {
        if (isMounted && liveWallets.length > 0) {
          setWallets(liveWallets);
          const activeW = liveWallets.find((w) => w.currency === currency);
          if (activeW) {
            setCurrentWallet(activeW);
          }
        }
      });

      // 4. Real-time Financial Transactions Ledger Listener
      const unsubTx = firebaseFirestore.subscribeToTransactions(targetUid, (liveTxs) => {
        if (isMounted) {
          setTransactions(liveTxs);
        }
      });

      return () => {
        isMounted = false;
        unsubProfile();
        unsubWallet();
        unsubAllWallets();
        unsubTx();
      };
    } else {
      // Local fallback using seamless engine
      const localUsers = seamlessEngine.getUsers();
      const localWallets = seamlessEngine.getWallets();
      const targetUser = localUsers.find((u) => u.id === selectedUserId) || localUsers[0];
      if (targetUser) {
        setCurrentUser(targetUser);
        const userWallet = localWallets.find((w) => w.user_id === targetUser.id && w.currency === currency) || localWallets[0];
        if (userWallet) setCurrentWallet(userWallet);
      }
      setUsers(localUsers);
      setWallets(localWallets);
      setTransactions(seamlessEngine.getTransactions());
    }
  }, [authUser, currency, selectedUserId]);

  // Smooth balance counter interpolation
  const targetBalance = currentWallet ? currentWallet.real_balance : 0;

  useEffect(() => {
    if (animationTimerRef.current) {
      clearInterval(animationTimerRef.current);
    }

    const start = animatedBalance;
    const end = targetBalance;
    const diff = end - start;

    if (Math.abs(diff) < 0.01) {
      setAnimatedBalance(end);
      return;
    }

    // Trigger visual flash
    if (end > start) {
      setBalanceFlash('credit');
    } else if (end < start) {
      setBalanceFlash('deduct');
    }

    const flashTimeout = setTimeout(() => {
      setBalanceFlash('idle');
    }, 600);

    const steps = 18;
    let step = 0;
    const stepDiff = diff / steps;

    animationTimerRef.current = setInterval(() => {
      step++;
      if (step >= steps) {
        setAnimatedBalance(end);
        clearInterval(animationTimerRef.current);
      } else {
        setAnimatedBalance((prev) => Number((prev + stepDiff).toFixed(2)));
      }
    }, 20);

    return () => {
      clearTimeout(flashTimeout);
      if (animationTimerRef.current) clearInterval(animationTimerRef.current);
    };
  }, [targetBalance]);

  // Formatted Balance string for header
  const formattedBalance = React.useMemo(() => {
    if (currency === 'BDT') {
      const bdtAmount = currentUser.currency === 'BDT' ? animatedBalance : animatedBalance * 120;
      return `৳ ${bdtAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    const usdAmount = currentUser.currency === 'BDT' ? animatedBalance / 120 : animatedBalance;
    return `$ ${usdAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [currency, currentUser.currency, animatedBalance]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const triggerCelebration = useCallback((data: CelebrationData) => {
    setCelebrationData(data);
    soundEngine.playMegaWin();
  }, []);

  const clearCelebration = useCallback(() => {
    setCelebrationData(null);
  }, []);

  const toggleSound = useCallback(() => {
    const unmuted = soundEngine.toggleMute();
    setSoundMuted(!unmuted);
    if (unmuted) {
      soundEngine.playClick(1000);
      showToast('সাউন্ড অন করা হয়েছে (Audio Enabled)');
    } else {
      showToast('সাউন্ড মিউট করা হয়েছে (Audio Muted)');
    }
  }, [showToast]);

  const toggleCurrency = useCallback(() => {
    const next = currency === 'BDT' ? 'USD' : 'BDT';
    setCurrency(next);
    soundEngine.playClick();
    showToast(`কারেন্সি পরিবর্তিত হয়েছে: ${next}`);
  }, [currency, showToast]);

  const switchUser = useCallback((userId: string) => {
    setSelectedUserId(userId);
    soundEngine.playClick();
  }, []);

  const loginUser = useCallback((user: UserEntity, wallet: WalletEntity) => {
    setSessionAuthenticated(true);
    try {
      localStorage.setItem('playall365_session_active', 'true');
      localStorage.setItem('playall365_user_id', user.id);
    } catch {
      // Ignore
    }
    setSelectedUserId(user.id);
    setCurrency(user.currency as 'BDT' | 'USD');
    setCurrentUser(user);
    setCurrentWallet(wallet);
    setUsers((prev) => {
      const exists = prev.some((u) => u.id === user.id);
      return exists ? prev.map((u) => (u.id === user.id ? user : u)) : [user, ...prev];
    });
    setWallets((prev) => {
      const exists = prev.some((w) => w.id === wallet.id);
      return exists ? prev.map((w) => (w.id === wallet.id ? wallet : w)) : [wallet, ...prev];
    });
    setActiveTab('lobby');
    soundEngine.playWinChime();
    showToast(`স্বাগতম ${user.username}! ক্যাসিনো লবিতে আপনাকে স্বাগতম।`);
  }, [showToast]);

  const logoutUser = useCallback(() => {
    setSessionAuthenticated(false);
    try {
      localStorage.removeItem('playall365_session_active');
      localStorage.removeItem('playall365_user_id');
    } catch {
      // Ignore
    }
    authLogout();
    showToast('সফলভাবে লগআউট হয়েছে');
  }, [authLogout, showToast]);

  const refreshState = useCallback(() => {
    if (authUser) {
      firebaseFirestore.ensureUserWallet(authUser.uid, currency).then((w) => {
        if (w) setCurrentWallet(w);
      });
    }
  }, [authUser, currency]);

  const topUpWallet = useCallback(
    async (amount: number, targetUserId?: string, targetCurrency?: string) => {
      const uid = targetUserId || currentUser.id;
      const curr = (targetCurrency || currentUser.currency || currency) as 'BDT' | 'USD';

      try {
        const updatedWallet = await firebaseFirestore.depositWallet(uid, curr, amount);
        if (updatedWallet) {
          setCurrentWallet(updatedWallet);
        }
        soundEngine.playWalletCredit();
        showToast(`৳ ${amount} ওয়ালেটে সফলভাবে জমা হয়েছে (Deposit Successful)`);
      } catch (err: any) {
        console.error('Deposit error:', err);
        showToast('ডিপোজিট সম্পন্ন করা যায়নি');
      }
    },
    [currentUser.id, currentUser.currency, currency, showToast]
  );

  // --------------------------------------------------------------------------
  // Reset to Zero Logic: Ensures newly registered users start with clean 0.00
  // --------------------------------------------------------------------------
  const resetWalletToZero = useCallback(
    async (targetUserId?: string, targetCurrency?: 'BDT' | 'USD'): Promise<WalletEntity> => {
      const uid = targetUserId || currentUser.id;
      const curr = (targetCurrency || currentUser.currency || currency) as 'BDT' | 'USD';

      // 1. Instantly enforce zero balance in local simulated engine
      const localZeroWallet = seamlessEngine.resetWalletToZero(uid, curr);

      // 2. Instantly update React state so UI immediately renders 0.00
      if (uid === currentUser.id) {
        setCurrentWallet(localZeroWallet);
        setAnimatedBalance(0);
      }

      setWallets((prev) =>
        prev.map((w) =>
          w.user_id === uid
            ? { ...w, real_balance: 0.0, bonus_balance: 0.0, locked_balance: 0.0, version: (w.version || 1) + 1 }
            : w
        )
      );

      // 3. Persist hard reset in Firestore DB regardless of pre-existing state
      try {
        const firestoreZeroWallet = await firebaseFirestore.resetUserWalletToZero(uid, curr);
        if (firestoreZeroWallet && uid === currentUser.id) {
          setCurrentWallet(firestoreZeroWallet);
          setAnimatedBalance(0);
        }
      } catch (err) {
        console.warn('Firestore resetToZero sync note:', err);
      }

      return localZeroWallet;
    },
    [currentUser.id, currentUser.currency, currency]
  );

  const registerNewUser = useCallback(
    async (params: {
      username: string;
      email?: string;
      phone?: string;
      currency?: 'BDT' | 'USD';
      promoCode?: string;
    }): Promise<{ user: UserEntity; wallet: WalletEntity }> => {
      const chosenCurrency = params.currency || currency || 'BDT';
      const cleanUsername = params.username.trim();
      const email = params.email || `${cleanUsername.toLowerCase()}@gameplay365.com`;

      // 1. Register in simulated wallet engine
      const engineResult = seamlessEngine.registerUser({
        username: cleanUsername,
        email,
        phone: params.phone,
        currency: chosenCurrency,
        promoCode: params.promoCode || 'GP365_WELCOME'
      });

      const registeredUser = engineResult.user;
      const targetUid = authUser?.uid || registeredUser.id;

      // 2. Explicitly enforce 'Reset to Zero' logic: newly created accounts start with a clean zero balance
      const zeroWallet = await resetWalletToZero(targetUid, chosenCurrency);

      // 3. Update active session user & wallet state
      loginUser(registeredUser, zeroWallet);

      // 4. Ensure Firestore User Profile and zero-balance wallet are synchronized
      try {
        await firebaseFirestore.syncUserProfile(
          {
            uid: targetUid,
            email,
            displayName: cleanUsername,
            phoneNumber: params.phone
          },
          chosenCurrency
        );
        await firebaseFirestore.resetUserWalletToZero(targetUid, chosenCurrency);
      } catch (dbErr) {
        console.warn('New user registration Firestore sync note:', dbErr);
      }

      return { user: registeredUser, wallet: zeroWallet };
    },
    [currency, authUser?.uid, resetWalletToZero, loginUser]
  );

  const launchGame = useCallback((gameId: string) => {
    setActiveGameId(gameId);
    setActiveTabState('games');
    soundEngine.playClick(1050);
  }, []);

  // --------------------------------------------------------------------------
  // Core Real-time Seamless Operations Committed to Firestore
  // --------------------------------------------------------------------------
  const placeSeamlessBet = async (params: BetRequestParams) => {
    const { providerId, gameId, amount } = params;
    const roundId = params.roundId || `RND_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const txId = params.customTxId || `TX_BET_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;

    if (!currentWallet || currentWallet.real_balance < amount) {
      soundEngine.playClick(300);
      return { success: false, txId, roundId, error: 'ব্যালেন্স পর্যাপ্ত নয় (Insufficient balance)' };
    }

    try {
      recordUserActivity();
      const result = await firebaseFirestore.commitTransaction(currentUser.id, currency, {
        transactionId: txId,
        providerId,
        gameId,
        roundId,
        type: 'BET',
        amount,
        auditHash: `SHA256_${Date.now()}_${txId.slice(-6)}`
      });

      if (result.success) {
        soundEngine.playWalletDeduct();
        setCurrentWallet(result.updatedWallet);

        const gameTitles: Record<string, { title: string; provider: string }> = {
          spribe_aviator: { title: 'Aviator', provider: 'SPRIBE' },
          wg_aviator: { title: 'WG Aviator', provider: 'WG Games' },
          flyx_crash: { title: 'FlyX Crash', provider: 'Buck Stakes' },
          jili_super_ace: { title: 'Super Ace', provider: 'JILI' },
          jili_super_ace_deluxe: { title: 'Super Ace Deluxe', provider: 'JILI' },
          pgsoft_mahjong_ways2: { title: 'Mahjong Ways 2', provider: 'PG Soft' },
          fortune_tiger_88: { title: 'Fortune Tiger', provider: 'PG Soft' },
          vs20olympgate: { title: 'Gates of Olympus', provider: 'Pragmatic Play' },
          vs20sweetbonanza: { title: 'Sweet Bonanza 1000', provider: 'Pragmatic Play' },
          evolution_lightning_roulette: { title: 'Lightning Roulette', provider: 'Evolution' },
          evolution_crazy_time: { title: 'Crazy Time Live', provider: 'Evolution' }
        };

        const gInfo = gameTitles[gameId] || { title: gameId, provider: providerId };
        setLiveActivities((prev) => [
          {
            id: `act_${txId}`,
            username: currentUser.username,
            userId: currentUser.id,
            gameId,
            gameTitle: gInfo.title,
            provider: gInfo.provider,
            type: 'BET',
            amount,
            currency: currentUser.currency || currency,
            timestamp: Date.now(),
            isCurrentPlayer: true
          },
          ...prev.slice(0, 39)
        ]);

        return { success: true, txId, roundId };
      } else {
        soundEngine.playClick(280);
        return { success: false, txId, roundId, error: 'Bet transaction failed' };
      }
    } catch (err: any) {
      soundEngine.playClick(280);
      return { success: false, txId, roundId, error: err.message || 'Transaction error' };
    }
  };

  const settleSeamlessWin = async (params: WinRequestParams) => {
    const { providerId, gameId, amount, roundId, referenceBetTxId } = params;
    const txId = params.customTxId || `TX_WIN_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;

    try {
      recordUserActivity();
      const result = await firebaseFirestore.commitTransaction(currentUser.id, currency, {
        transactionId: txId,
        providerId,
        gameId,
        roundId,
        type: 'WIN',
        amount,
        referenceTransactionId: referenceBetTxId,
        auditHash: `SHA256_WIN_${Date.now()}_${txId.slice(-6)}`
      });

      if (result.success) {
        if (amount > 0) {
          soundEngine.playWin(amount);
        }
        setCurrentWallet(result.updatedWallet);

        if (amount > 0) {
          const gameTitles: Record<string, { title: string; provider: string }> = {
            spribe_aviator: { title: 'Aviator', provider: 'SPRIBE' },
            wg_aviator: { title: 'WG Aviator', provider: 'WG Games' },
            flyx_crash: { title: 'FlyX Crash', provider: 'Buck Stakes' },
            jili_super_ace: { title: 'Super Ace', provider: 'JILI' },
            jili_super_ace_deluxe: { title: 'Super Ace Deluxe', provider: 'JILI' },
            pgsoft_mahjong_ways2: { title: 'Mahjong Ways 2', provider: 'PG Soft' },
            fortune_tiger_88: { title: 'Fortune Tiger', provider: 'PG Soft' },
            vs20olympgate: { title: 'Gates of Olympus', provider: 'Pragmatic Play' },
            vs20sweetbonanza: { title: 'Sweet Bonanza 1000', provider: 'Pragmatic Play' },
            evolution_lightning_roulette: { title: 'Lightning Roulette', provider: 'Evolution' },
            evolution_crazy_time: { title: 'Crazy Time Live', provider: 'Evolution' }
          };

          const gInfo = gameTitles[gameId] || { title: gameId, provider: providerId };
          const isJackpot = amount >= 20000;

          setLiveActivities((prev) => [
            {
              id: `act_${txId}`,
              username: currentUser.username,
              userId: currentUser.id,
              gameId,
              gameTitle: gInfo.title,
              provider: gInfo.provider,
              type: isJackpot ? 'JACKPOT' : 'WIN',
              amount,
              currency: currentUser.currency || currency,
              timestamp: Date.now(),
              isCurrentPlayer: true
            },
            ...prev.slice(0, 39)
          ]);
        }

        return { success: true, txId };
      } else {
        return { success: false, txId, error: 'Win settlement failed' };
      }
    } catch (err: any) {
      return { success: false, txId, error: err.message || 'Transaction error' };
    }
  };

  const settleSeamlessRefund = async (params: RefundRequestParams) => {
    const { providerId, gameId, amount, roundId, referenceBetTxId, reason } = params;
    const txId = `TX_REF_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;

    try {
      const result = await firebaseFirestore.commitTransaction(currentUser.id, currency, {
        transactionId: txId,
        providerId,
        gameId,
        roundId,
        type: 'REFUND',
        amount,
        referenceTransactionId: referenceBetTxId,
        auditHash: `SHA256_REF_${Date.now()}_${txId.slice(-6)}`
      });

      if (result.success) {
        soundEngine.playWalletCredit();
        setCurrentWallet(result.updatedWallet);
        showToast(`৳ ${amount} রিফান্ড ওয়ালেটে ফেরত দেওয়া হয়েছে`);
        return { success: true, txId };
      } else {
        return { success: false, txId, error: 'Refund failed' };
      }
    } catch (err: any) {
      return { success: false, txId, error: err.message || 'Transaction error' };
    }
  };

  return (
    <WalletGameContext.Provider
      value={{
        isAuthenticated,
        setIsAuthenticated,
        isAdmin,
        userRole,
        currentUser,
        currentWallet,
        users,
        wallets,
        transactions,
        liveActivities,
        selectedUserId,
        setSelectedUserId,
        currency,
        setCurrency,
        toggleCurrency,
        switchUser,
        loginUser,
        logoutUser,
        refreshState,
        topUpWallet,
        resetWalletToZero,
        registerNewUser,
        animatedBalance,
        formattedBalance,
        balanceFlash,
        activeTab,
        setActiveTab,
        activeGameId,
        setActiveGameId,
        launchGame,
        placeSeamlessBet,
        settleSeamlessWin,
        settleSeamlessRefund,
        soundMuted,
        toggleSound,
        audioEngine: soundEngine,
        toastMessage,
        showToast,
        celebrationData,
        triggerCelebration,
        clearCelebration,
        isIdleLocked,
        unlockIdleSession,
        lockIdleSession,
        recordUserActivity
      }}
    >
      {children}
    </WalletGameContext.Provider>
  );
};

