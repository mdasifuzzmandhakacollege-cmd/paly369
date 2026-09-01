/**
 * @file firebaseFirestoreService.ts
 * @description Real-time Firebase Firestore database service for Playall 365.
 * Strictly implements error handling and real-time synchronization for:
 * - User profile (/users/{userId})
 * - Real user wallets (/users/{userId}/wallets/{currency})
 * - Live financial transaction ledger (/users/{userId}/transactions/{txId})
 * - Real-time notifications (/users/{userId}/notifications/{id})
 * - Google Drive KYC documents (/users/{userId}/kyc_documents/{id})
 */

import {
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocFromServer,
  Unsubscribe
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { UserEntity, WalletEntity, TransactionEntity, WalletStatus } from '../server/types/seamless';
import { seamlessEngine } from './simulatedWalletEngine';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class FirebaseFirestoreService {
  private isConnected: boolean = true;

  constructor() {
    this.isConnected = true;
  }

  public async testConnection(): Promise<boolean> {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
      this.isConnected = true;
      return true;
    } catch (error: any) {
      // Gracefully catch offline or network unavailable state
      if (error && (error.code === 'unavailable' || error.message?.includes('offline') || error.message?.includes('unavailable') || error.message?.includes('Failed to get document from server'))) {
        this.isConnected = false;
        return false;
      }
      this.isConnected = false;
      return false;
    }
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Helper to check if current Firebase user is authorized to read/write specific user doc
   */
  private isUserAuthorized(userId: string): boolean {
    return !!auth.currentUser && auth.currentUser.uid === userId;
  }

  /**
   * Helper to check if a user possesses elevated Admin role from Firestore
   */
  public async isUserAdminRole(userId: string, _email?: string | null): Promise<boolean> {
    try {
      // Check /admins/{userId} document
      const adminDoc = await getDoc(doc(db, 'admins', userId));
      if (adminDoc.exists()) return true;

      // Check /users/{userId} document role
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const d = userDoc.data();
        const role = String(d.role || '').toUpperCase();
        return role === 'ADMIN' || role === 'OPERATOR' || role === 'SUPER_ADMIN' || d.isAdmin === true;
      }
    } catch (e) {
      console.warn('Admin check notice:', e);
    }
    return false;
  }

  /**
   * Listen to real-time user profile document changes
   */
  public subscribeToUserProfile(
    userId: string,
    onUpdate: (user: UserEntity) => void
  ): Unsubscribe {
    if (!this.isUserAuthorized(userId)) {
      // Unauthenticated / guest user: no-op unsubscribe
      return () => {};
    }

    const userDocRef = doc(db, 'users', userId);
    const path = `users/${userId}`;

    return onSnapshot(
      userDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const email = data.email || auth.currentUser?.email || '';
          const roleVal = String(data.role || '').toUpperCase();
          const isElevatedAdmin = roleVal === 'ADMIN' || roleVal === 'OPERATOR' || roleVal === 'SUPER_ADMIN' || data.isAdmin === true;

          const userEntity: UserEntity = {
            id: userId,
            username: data.username || (data.email ? data.email.split('@')[0] : `User_${userId.slice(0, 6)}`),
            operator_id: 'GAMEPLAY365_LIVE',
            currency: (data.currency as 'BDT' | 'USD') || 'BDT',
            status: 'ACTIVE',
            country_code: data.currency === 'USD' ? 'US' : 'BD',
            email: email,
            phone: data.phone || '',
            role: isElevatedAdmin ? 'ADMIN' : ((data.role as 'ADMIN' | 'PLAYER' | 'VIP') || 'PLAYER'),
            isAdmin: isElevatedAdmin,
            vipTier: data.vipTier || 'VIP 1',
            vipPoints: data.vipPoints || 0,
            created_at: data.createdAt || new Date().toISOString(),
            updated_at: data.updatedAt || new Date().toISOString()
          };
          onUpdate(userEntity);
        }
      },
      (error) => {
        console.warn(`Firestore user profile listener: ${error.message}`);
      }
    );
  }

  /**
   * Ensure user document exists in Firestore and return synced profile
   */
  public async syncUserProfile(firebaseUser: {
    uid: string;
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
    phoneNumber?: string | null;
  }, preferredCurrency: 'BDT' | 'USD' = 'BDT'): Promise<UserEntity> {
    if (!this.isUserAuthorized(firebaseUser.uid)) {
      // Local fallback for guest or unauthenticated user
      const existing = seamlessEngine.getUsers().find((u) => u.id === firebaseUser.uid);
      if (existing) return existing;
      const now = new Date().toISOString();
      return {
        id: firebaseUser.uid,
        username: firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'Player_365'),
        operator_id: 'GAMEPLAY365_LIVE',
        currency: preferredCurrency,
        status: 'ACTIVE',
        country_code: preferredCurrency === 'USD' ? 'US' : 'BD',
        role: 'PLAYER',
        isAdmin: false,
        created_at: now,
        updated_at: now
      };
    }

    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const path = `users/${firebaseUser.uid}`;

    try {
      const snap = await getDoc(userDocRef);
      const now = new Date().toISOString();

      if (snap.exists()) {
        const data = snap.data();
        const email = data.email || firebaseUser.email || '';
        const roleVal = String(data.role || '').toUpperCase();
        const isElevatedAdmin = roleVal === 'ADMIN' || roleVal === 'OPERATOR' || roleVal === 'SUPER_ADMIN' || data.isAdmin === true;

        const phone = data.phone || firebaseUser.phoneNumber || '';

        const userEntity: UserEntity = {
          id: firebaseUser.uid,
          username: data.username || firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : (phone ? `player_${phone.replace(/[^0-9]/g, '').slice(-4)}` : 'Player_365')),
          operator_id: 'GAMEPLAY365_LIVE',
          currency: (data.currency as 'BDT' | 'USD') || preferredCurrency,
          status: 'ACTIVE',
          country_code: data.currency === 'USD' ? 'US' : 'BD',
          email: email,
          phone: phone,
          role: isElevatedAdmin ? 'ADMIN' : ((data.role as 'ADMIN' | 'PLAYER' | 'VIP') || 'PLAYER'),
          isAdmin: isElevatedAdmin,
          vipTier: data.vipTier || 'VIP 1',
          vipPoints: data.vipPoints || 0,
          created_at: data.createdAt || now,
          updated_at: now
        };

        // Ensure wallet document exists
        await this.ensureUserWallet(firebaseUser.uid, userEntity.currency as 'BDT' | 'USD');
        return userEntity;
      } else {
        const username = firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : `user_${firebaseUser.uid.slice(0, 6)}`);
        const initialUserData = {
          id: firebaseUser.uid,
          username,
          email: firebaseUser.email || '',
          phone: firebaseUser.phoneNumber || '',
          currency: preferredCurrency,
          vipTier: 'VIP 1',
          vipPoints: 0,
          role: 'PLAYER',
          isAdmin: false,
          affiliateCode: `REF_${firebaseUser.uid.slice(0, 6).toUpperCase()}`,
          photoURL: firebaseUser.photoURL || '',
          createdAt: now,
          updatedAt: now
        };

        await setDoc(userDocRef, initialUserData);
        
        // Initialize Real-time Wallet with 0.00 initial balance (Deposit required for gameplay)
        await this.ensureUserWallet(firebaseUser.uid, preferredCurrency, 0);

        return {
          id: firebaseUser.uid,
          username,
          operator_id: 'GAMEPLAY365_LIVE',
          currency: preferredCurrency,
          status: 'ACTIVE',
          country_code: preferredCurrency === 'USD' ? 'US' : 'BD',
          email: firebaseUser.email || '',
          role: 'PLAYER',
          isAdmin: false,
          created_at: now,
          updated_at: now
        };
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Ensure user's wallet document in Firestore
   */
  public async ensureUserWallet(userId: string, currency: 'BDT' | 'USD', initialBalance: number = 0): Promise<WalletEntity> {
    if (!this.isUserAuthorized(userId)) {
      const now = new Date().toISOString();
      const localWallets = seamlessEngine.getWallets();
      const localW = localWallets.find((w) => w.user_id === userId && w.currency === currency) || localWallets.find((w) => w.user_id === userId);
      if (localW) return localW;

      return {
        id: `w_${userId}_${currency.toLowerCase()}`,
        user_id: userId,
        currency,
        real_balance: initialBalance,
        bonus_balance: 0,
        locked_balance: 0,
        version: 1,
        status: 'ACTIVE',
        created_at: now,
        updated_at: now
      };
    }

    const walletDocRef = doc(db, 'users', userId, 'wallets', currency);
    const path = `users/${userId}/wallets/${currency}`;

    try {
      const snap = await getDoc(walletDocRef);
      const now = new Date().toISOString();

      if (snap.exists()) {
        const data = snap.data();
        return {
          id: `w_${userId}_${currency.toLowerCase()}`,
          user_id: userId,
          currency: currency,
          real_balance: typeof data.realBalance === 'number' ? data.realBalance : initialBalance,
          bonus_balance: typeof data.bonusBalance === 'number' ? data.bonusBalance : 0,
          locked_balance: typeof data.lockedBalance === 'number' ? data.lockedBalance : 0,
          version: data.version || 1,
          status: (data.status as WalletStatus) || 'ACTIVE',
          created_at: data.createdAt || now,
          updated_at: data.updatedAt || now
        };
      } else {
        const initialWallet = {
          id: `w_${userId}_${currency.toLowerCase()}`,
          userId,
          currency,
          realBalance: initialBalance,
          bonusBalance: 0,
          lockedBalance: 0,
          version: 1,
          status: 'ACTIVE',
          createdAt: now,
          updatedAt: now
        };
        await setDoc(walletDocRef, initialWallet);
        return {
          id: `w_${userId}_${currency.toLowerCase()}`,
          user_id: userId,
          currency: currency,
          real_balance: initialBalance,
          bonus_balance: 0,
          locked_balance: 0,
          version: 1,
          status: 'ACTIVE',
          created_at: now,
          updated_at: now
        };
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Hard resets user wallet balances to clean zero (0.00) in Firestore and local state.
   * Ensures new account registrations start strictly with 0 balance regardless of prior DB state.
   */
  public async resetUserWalletToZero(
    userId: string,
    currency: 'BDT' | 'USD' = 'BDT'
  ): Promise<WalletEntity> {
    const now = new Date().toISOString();
    const zeroWalletData = {
      id: `w_${userId}_${currency.toLowerCase()}`,
      userId,
      currency,
      realBalance: 0.0,
      bonusBalance: 0.0,
      lockedBalance: 0.0,
      version: 1,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now
    };

    // Update local seamless engine first
    seamlessEngine.resetWalletToZero(userId, currency);

    if (!this.isUserAuthorized(userId)) {
      return {
        id: `w_${userId}_${currency.toLowerCase()}`,
        user_id: userId,
        currency,
        real_balance: 0.0,
        bonus_balance: 0.0,
        locked_balance: 0.0,
        version: 1,
        status: 'ACTIVE',
        created_at: now,
        updated_at: now
      };
    }

    const walletDocRef = doc(db, 'users', userId, 'wallets', currency);
    const path = `users/${userId}/wallets/${currency}`;

    try {
      await setDoc(walletDocRef, zeroWalletData, { merge: true });

      // Also reset secondary currency (e.g. USD if BDT, or BDT if USD) to clean zero
      const altCurrency: 'BDT' | 'USD' = currency === 'BDT' ? 'USD' : 'BDT';
      try {
        const altDocRef = doc(db, 'users', userId, 'wallets', altCurrency);
        await setDoc(
          altDocRef,
          {
            id: `w_${userId}_${altCurrency.toLowerCase()}`,
            userId,
            currency: altCurrency,
            realBalance: 0.0,
            bonusBalance: 0.0,
            lockedBalance: 0.0,
            version: 1,
            status: 'ACTIVE',
            createdAt: now,
            updatedAt: now
          },
          { merge: true }
        );
        seamlessEngine.resetWalletToZero(userId, altCurrency);
      } catch (altErr) {
        console.warn('Alt currency zero-reset notice:', altErr);
      }

      return {
        id: `w_${userId}_${currency.toLowerCase()}`,
        user_id: userId,
        currency,
        real_balance: 0.0,
        bonus_balance: 0.0,
        locked_balance: 0.0,
        version: 1,
        status: 'ACTIVE',
        created_at: now,
        updated_at: now
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Listen to real-time wallet balance changes for a specific currency
   */
  public subscribeToWallet(
    userId: string,
    currency: 'BDT' | 'USD',
    onUpdate: (wallet: WalletEntity) => void
  ): Unsubscribe {
    if (!this.isUserAuthorized(userId)) {
      return () => {};
    }

    const walletDocRef = doc(db, 'users', userId, 'wallets', currency);
    const path = `users/${userId}/wallets/${currency}`;

    return onSnapshot(
      walletDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const entity: WalletEntity = {
            id: `w_${userId}_${currency.toLowerCase()}`,
            user_id: userId,
            currency: currency,
            real_balance: typeof data.realBalance === 'number' ? data.realBalance : 0,
            bonus_balance: typeof data.bonusBalance === 'number' ? data.bonusBalance : 0,
            locked_balance: typeof data.lockedBalance === 'number' ? data.lockedBalance : 0,
            version: data.version || 1,
            status: (data.status as WalletStatus) || 'ACTIVE',
            created_at: data.createdAt || new Date().toISOString(),
            updated_at: data.updatedAt || new Date().toISOString()
          };
          onUpdate(entity);
        }
      },
      (error) => {
        console.warn(`Firestore wallet listener (${currency}): ${error.message}`);
      }
    );
  }

  /**
   * Listen to all real-time wallets for a user (BDT, USD, etc.)
   */
  public subscribeToAllWallets(
    userId: string,
    onUpdate: (wallets: WalletEntity[]) => void
  ): Unsubscribe {
    if (!this.isUserAuthorized(userId)) {
      return () => {};
    }

    const walletsColRef = collection(db, 'users', userId, 'wallets');
    const path = `users/${userId}/wallets`;

    return onSnapshot(
      walletsColRef,
      (snapshot) => {
        const walletList: WalletEntity[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const curr = (data.currency as 'BDT' | 'USD') || (docSnap.id.toUpperCase() as 'BDT' | 'USD');
          return {
            id: data.id || `w_${userId}_${curr.toLowerCase()}`,
            user_id: userId,
            currency: curr,
            real_balance: typeof data.realBalance === 'number' ? data.realBalance : 0,
            bonus_balance: typeof data.bonusBalance === 'number' ? data.bonusBalance : 0,
            locked_balance: typeof data.lockedBalance === 'number' ? data.lockedBalance : 0,
            version: data.version || 1,
            status: (data.status as WalletStatus) || 'ACTIVE',
            created_at: data.createdAt || new Date().toISOString(),
            updated_at: data.updatedAt || new Date().toISOString()
          };
        });
        onUpdate(walletList);
      },
      (error) => {
        console.warn(`Firestore all-wallets listener: ${error.message}`);
      }
    );
  }

  /**
   * Listen to real-time transaction ledger for a user
   */
  public subscribeToTransactions(
    userId: string,
    onUpdate: (transactions: TransactionEntity[]) => void
  ): Unsubscribe {
    if (!this.isUserAuthorized(userId)) {
      return () => {};
    }

    const txColRef = collection(db, 'users', userId, 'transactions');
    const path = `users/${userId}/transactions`;
    const q = query(txColRef, orderBy('createdAt', 'desc'), limit(100));

    return onSnapshot(
      q,
      (snapshot) => {
        const txList: TransactionEntity[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            transaction_id: d.transactionId || docSnap.id,
            user_id: userId,
            wallet_id: d.walletId || `w_${userId}_${(d.currency || 'BDT').toLowerCase()}`,
            provider_id: d.providerId || 'SYSTEM',
            game_id: d.gameId || 'SYSTEM',
            provider_round_id: d.roundId,
            type: d.type as any,
            amount: d.amount,
            currency: d.currency,
            before_balance: d.beforeBalance || 0,
            after_balance: d.afterBalance || 0,
            status: d.status || 'COMPLETED',
            reference_transaction_id: d.referenceTransactionId,
            metadata: {
              audit_hash: d.auditHash,
              realtime_synced: true
            },
            created_at: d.createdAt || new Date().toISOString()
          };
        });
        onUpdate(txList);
      },
      (error) => {
        console.warn(`Firestore transactions listener: ${error.message}`);
      }
    );
  }

  /**
   * Commit a transaction directly to Firestore or fallback to simulated engine
   */
  public async commitTransaction(
    userId: string,
    currency: 'BDT' | 'USD',
    tx: {
      transactionId: string;
      providerId: string;
      gameId: string;
      roundId?: string;
      type: 'BET' | 'WIN' | 'REFUND' | 'DEPOSIT' | 'WITHDRAW';
      amount: number;
      referenceTransactionId?: string;
      auditHash?: string;
    }
  ): Promise<{ success: boolean; txEntity: TransactionEntity; updatedWallet: WalletEntity }> {
    if (!this.isUserAuthorized(userId)) {
      // Execute via seamless simulated wallet engine
      let engineRes: any;
      if (tx.type === 'BET') {
        engineRes = await seamlessEngine.executeRequest('bet', {
          user_id: userId,
          provider_id: tx.providerId,
          amount: tx.amount,
          currency,
          game_id: tx.gameId,
          transaction_id: tx.transactionId,
          round_id: tx.roundId
        });
      } else if (tx.type === 'WIN') {
        engineRes = await seamlessEngine.executeRequest('win', {
          user_id: userId,
          provider_id: tx.providerId,
          amount: tx.amount,
          currency,
          game_id: tx.gameId,
          transaction_id: tx.transactionId,
          round_id: tx.roundId,
          reference_transaction_id: tx.referenceTransactionId
        });
      } else if (tx.type === 'REFUND') {
        engineRes = await seamlessEngine.executeRequest('refund', {
          user_id: userId,
          provider_id: tx.providerId,
          amount: tx.amount,
          currency,
          game_id: tx.gameId,
          transaction_id: tx.transactionId,
          round_id: tx.roundId,
          reference_transaction_id: tx.referenceTransactionId
        });
      } else {
        // Deposit
        const localWallets = seamlessEngine.getWallets();
        let w = localWallets.find((item) => item.user_id === userId && item.currency === currency);
        if (!w) {
          w = {
            id: `w_${userId}_${currency.toLowerCase()}`,
            user_id: userId,
            currency,
            real_balance: 5000,
            bonus_balance: 0,
            locked_balance: 0,
            version: 1,
            status: 'ACTIVE',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        }
        w.real_balance += tx.amount;
        return {
          success: true,
          txEntity: {
            id: tx.transactionId,
            transaction_id: tx.transactionId,
            user_id: userId,
            wallet_id: w.id,
            provider_id: tx.providerId,
            game_id: tx.gameId,
            type: tx.type,
            amount: tx.amount,
            currency,
            before_balance: w.real_balance - tx.amount,
            after_balance: w.real_balance,
            status: 'COMPLETED',
            metadata: {},
            created_at: new Date().toISOString()
          },
          updatedWallet: { ...w }
        };
      }

      const txHistory = seamlessEngine.getTransactions();
      const latestTx = txHistory.find((t) => t.transaction_id === tx.transactionId) || txHistory[0];
      const walletsList = seamlessEngine.getWallets();
      const updatedW = walletsList.find((w) => w.user_id === userId && w.currency === currency) || walletsList[0];

      return {
        success: engineRes?.status === 200,
        txEntity: latestTx || {
          id: tx.transactionId,
          transaction_id: tx.transactionId,
          user_id: userId,
          wallet_id: updatedW.id,
          provider_id: tx.providerId,
          game_id: tx.gameId,
          type: tx.type,
          amount: tx.amount,
          currency,
          before_balance: updatedW.real_balance,
          after_balance: updatedW.real_balance,
          status: 'COMPLETED',
          metadata: {},
          created_at: new Date().toISOString()
        },
        updatedWallet: updatedW
      };
    }

    const walletDocRef = doc(db, 'users', userId, 'wallets', currency);
    const txDocRef = doc(db, 'users', userId, 'transactions', tx.transactionId);
    const path = `users/${userId}/transactions/${tx.transactionId}`;

    try {
      const walletSnap = await getDoc(walletDocRef);
      const now = new Date().toISOString();
      const currentBalance = walletSnap.exists() && typeof walletSnap.data().realBalance === 'number'
        ? walletSnap.data().realBalance
        : 5000;

      let newBalance = currentBalance;
      if (tx.type === 'BET' || tx.type === 'WITHDRAW') {
        if (currentBalance < tx.amount) {
          throw new Error('Insufficient balance in wallet');
        }
        newBalance = Number((currentBalance - tx.amount).toFixed(4));
      } else if (tx.type === 'WIN' || tx.type === 'REFUND' || tx.type === 'DEPOSIT') {
        newBalance = Number((currentBalance + tx.amount).toFixed(4));
      }

      // 1. Update wallet balance
      await setDoc(walletDocRef, {
        id: `w_${userId}_${currency.toLowerCase()}`,
        userId,
        currency,
        realBalance: newBalance,
        bonusBalance: 0,
        lockedBalance: 0,
        version: (walletSnap.data()?.version || 1) + 1,
        updatedAt: now
      }, { merge: true });

      // 2. Insert transaction record
      const txData = {
        id: tx.transactionId,
        transactionId: tx.transactionId,
        userId,
        walletId: `w_${userId}_${currency.toLowerCase()}`,
        providerId: tx.providerId,
        gameId: tx.gameId,
        roundId: tx.roundId || `RND_${Date.now()}`,
        type: tx.type,
        amount: tx.amount,
        currency,
        beforeBalance: currentBalance,
        afterBalance: newBalance,
        status: 'COMMITTED',
        referenceTransactionId: tx.referenceTransactionId || null,
        auditHash: tx.auditHash || '',
        createdAt: now
      };

      await setDoc(txDocRef, txData);

      const txEntity: TransactionEntity = {
        id: tx.transactionId,
        transaction_id: tx.transactionId,
        user_id: userId,
        wallet_id: `w_${userId}_${currency.toLowerCase()}`,
        provider_id: tx.providerId,
        game_id: tx.gameId,
        provider_round_id: tx.roundId,
        type: tx.type,
        amount: tx.amount,
        currency,
        before_balance: currentBalance,
        after_balance: newBalance,
        status: 'COMPLETED',
        reference_transaction_id: tx.referenceTransactionId,
        metadata: {
          audit_hash: tx.auditHash,
          realtime_synced: true
        },
        created_at: now
      };

      const updatedWallet: WalletEntity = {
        id: `w_${userId}_${currency.toLowerCase()}`,
        user_id: userId,
        currency,
        real_balance: newBalance,
        bonus_balance: 0,
        locked_balance: 0,
        version: (walletSnap.data()?.version || 1) + 1,
        status: (walletSnap.data()?.status as WalletStatus) || 'ACTIVE',
        created_at: walletSnap.data()?.createdAt || now,
        updated_at: now
      };

      return { success: true, txEntity, updatedWallet };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Top-up / Deposit Funds in Real-time Firestore
   */
  public async depositWallet(userId: string, currency: 'BDT' | 'USD', amount: number): Promise<WalletEntity> {
    const txId = `TX_DEP_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const res = await this.commitTransaction(userId, currency, {
      transactionId: txId,
      providerId: 'CASHIER_BANKING',
      gameId: 'BKASH_NAGAD_INSTANT',
      type: 'DEPOSIT',
      amount
    });
    return res.updatedWallet;
  }

  /**
   * Listen to real-time Security Events from Firestore
   */
  public subscribeToSecurityEvents(
    onUpdate: (events: SecurityEventRecord[]) => void,
    maxLimit = 100
  ): Unsubscribe {
    const eventsCol = collection(db, 'security_events');
    const q = query(eventsCol, orderBy('createdAt', 'desc'), limit(maxLimit));
    const path = 'security_events';

    return onSnapshot(
      q,
      (snapshot) => {
        const events: SecurityEventRecord[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            eventType: data.eventType || 'HMAC_VALIDATED',
            providerId: data.providerId || 'pragmatic_play',
            endpoint: data.endpoint || '/api/seamless/bet',
            ipAddress: data.ipAddress || '127.0.0.1',
            country: data.country || 'BD',
            status: data.status || 'ALLOWED',
            signatureReceived: data.signatureReceived || '',
            signatureExpected: data.signatureExpected || '',
            timestampReceived: data.timestampReceived || Date.now(),
            clockSkewMs: data.clockSkewMs || 0,
            payloadPreview: data.payloadPreview || '{}',
            message: data.message || 'HMAC Signature verified',
            severity: data.severity || 'INFO',
            createdAt: data.createdAt || new Date().toISOString()
          };
        });
        onUpdate(events);
      },
      (error) => {
        console.warn(`Firestore security events listener: ${error.message}`);
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  }

  /**
   * Listen to real-time Edge IP Rate Limits from Firestore
   */
  public subscribeToIpRateLimits(
    onUpdate: (limits: IpRateLimitRecord[]) => void
  ): Unsubscribe {
    const limitsCol = collection(db, 'ip_rate_limits');
    const path = 'ip_rate_limits';

    return onSnapshot(
      limitsCol,
      (snapshot) => {
        const limitsList: IpRateLimitRecord[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ip: data.ip || docSnap.id.replace(/_/g, '.'),
            providerId: data.providerId || 'pragmatic_play',
            country: data.country || 'US',
            requestCount: typeof data.requestCount === 'number' ? data.requestCount : 0,
            rps: typeof data.rps === 'number' ? data.rps : 0,
            limitRps: typeof data.limitRps === 'number' ? data.limitRps : 100,
            violationsCount: typeof data.violationsCount === 'number' ? data.violationsCount : 0,
            status: data.status || 'NORMAL',
            lastSeenAt: data.lastSeenAt || new Date().toISOString(),
            blockedUntil: data.blockedUntil
          };
        });
        onUpdate(limitsList);
      },
      (error) => {
        console.warn(`Firestore IP rate limits listener: ${error.message}`);
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  }

  /**
   * Record a new Security Event in Firestore
   */
  public async recordSecurityEvent(
    event: Omit<SecurityEventRecord, 'id' | 'createdAt'> & { id?: string }
  ): Promise<SecurityEventRecord> {
    const eventId = event.id || `SEC_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const docRef = doc(db, 'security_events', eventId);
    const path = `security_events/${eventId}`;
    const createdAt = new Date().toISOString();

    const record: SecurityEventRecord = {
      id: eventId,
      eventType: event.eventType,
      providerId: event.providerId,
      endpoint: event.endpoint,
      ipAddress: event.ipAddress,
      country: event.country,
      status: event.status,
      signatureReceived: event.signatureReceived || '',
      signatureExpected: event.signatureExpected || '',
      timestampReceived: event.timestampReceived || Date.now(),
      clockSkewMs: event.clockSkewMs || 0,
      payloadPreview: event.payloadPreview || '{}',
      message: event.message,
      severity: event.severity,
      createdAt
    };

    try {
      await setDoc(docRef, record);
      return record;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  /**
   * Record or update IP Rate Limit stats in Firestore
   */
  public async recordOrUpdateIpRateLimit(
    data: Partial<IpRateLimitRecord> & { ip: string }
  ): Promise<void> {
    const docId = data.ip.replace(/\./g, '_').replace(/:/g, '_');
    const docRef = doc(db, 'ip_rate_limits', docId);
    const path = `ip_rate_limits/${docId}`;

    try {
      await setDoc(
        docRef,
        {
          id: docId,
          ip: data.ip,
          providerId: data.providerId || 'pragmatic_play',
          country: data.country || 'US',
          requestCount: data.requestCount ?? 1,
          rps: data.rps ?? 1,
          limitRps: data.limitRps ?? 100,
          violationsCount: data.violationsCount ?? 0,
          status: data.status || 'NORMAL',
          lastSeenAt: new Date().toISOString(),
          ...(data.blockedUntil ? { blockedUntil: data.blockedUntil } : {})
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  /**
   * Change status of an IP in Firestore (e.g. Block, Unblock, Whitelist)
   */
  public async updateIpStatus(
    ip: string,
    status: 'NORMAL' | 'THROTTLED' | 'BLOCKED' | 'WHITELISTED',
    blockedUntil?: string
  ): Promise<void> {
    const docId = ip.replace(/\./g, '_').replace(/:/g, '_');
    const docRef = doc(db, 'ip_rate_limits', docId);
    const path = `ip_rate_limits/${docId}`;

    try {
      await updateDoc(docRef, {
        status,
        ...(blockedUntil ? { blockedUntil } : { blockedUntil: null }),
        lastSeenAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  /**
   * Delete a security event document
   */
  public async deleteSecurityEvent(eventId: string): Promise<void> {
    const docRef = doc(db, 'security_events', eventId);
    const path = `security_events/${eventId}`;
    try {
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  /**
   * Seed initial realistic security events and IP stats if collection is empty
   */
  public async seedInitialSecurityData(): Promise<void> {
    try {
      const eventsSnap = await getDocs(query(collection(db, 'security_events'), limit(1)));
      if (!eventsSnap.empty) {
        return; // Already populated
      }

      const sampleEvents: Array<Omit<SecurityEventRecord, 'id' | 'createdAt'>> = [
        {
          eventType: 'HMAC_VALIDATED',
          providerId: 'pragmatic_play',
          endpoint: '/api/seamless/bet',
          ipAddress: '154.21.89.44',
          country: 'MT',
          status: 'ALLOWED',
          signatureReceived: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          signatureExpected: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          timestampReceived: Date.now() - 12000,
          clockSkewMs: 142,
          payloadPreview: '{"user_id":"u_sakib_01","amount":250.0,"game_id":"vs20sweetbonanza"}',
          message: 'SHA-256 HMAC signature valid & timestamp within 5000ms SLA window',
          severity: 'INFO'
        },
        {
          eventType: 'INVALID_SIGNATURE',
          providerId: 'pragmatic_play',
          endpoint: '/api/seamless/bet',
          ipAddress: '185.220.101.5',
          country: 'RU',
          status: 'BLOCKED',
          signatureReceived: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
          signatureExpected: '4a6b241315b6d194c599175402fe3e4d9f6580f4f9f72782b8a245f8f5319803',
          timestampReceived: Date.now() - 45000,
          clockSkewMs: 820,
          payloadPreview: '{"user_id":"u_sakib_01","amount":999999.0,"game_id":"vs20sweetbonanza"}',
          message: 'Cryptographic signature mismatch: Tampered request payload detected',
          severity: 'CRITICAL'
        },
        {
          eventType: 'EXPIRED_TIMESTAMP',
          providerId: 'evolution',
          endpoint: '/api/seamless/win',
          ipAddress: '194.26.29.112',
          country: 'NL',
          status: 'BLOCKED',
          signatureReceived: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
          signatureExpected: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
          timestampReceived: Date.now() - 360000,
          clockSkewMs: 360000,
          payloadPreview: '{"user_id":"u_alex_02","amount":1500.0,"round_id":"RND_77189"}',
          message: 'Replay attack prevented: Request timestamp expired (>300s skew)',
          severity: 'HIGH'
        },
        {
          eventType: 'RATE_LIMIT_EXCEEDED',
          providerId: 'custom_provider',
          endpoint: '/api/seamless/auth',
          ipAddress: '45.154.255.89',
          country: 'UA',
          status: 'FLAGGED',
          signatureReceived: 'a87265b78f9024c6e7f8e6580912f2010839e9921bdfc66',
          signatureExpected: 'a87265b78f9024c6e7f8e6580912f2010839e9921bdfc66',
          timestampReceived: Date.now() - 95000,
          clockSkewMs: 210,
          payloadPreview: '{"user_id":"u_maria_03","session_token":"tok_test_991"}',
          message: 'IP burst exceeded 120 req/sec threshold (HTTP 429 Too Many Requests)',
          severity: 'WARNING'
        }
      ];

      for (const ev of sampleEvents) {
        await this.recordSecurityEvent(ev);
      }

      const sampleIps: Array<Partial<IpRateLimitRecord> & { ip: string }> = [
        {
          ip: '154.21.89.44',
          providerId: 'pragmatic_play',
          country: 'MT',
          requestCount: 4120,
          rps: 42,
          limitRps: 150,
          violationsCount: 0,
          status: 'NORMAL'
        },
        {
          ip: '185.220.101.5',
          providerId: 'malicious_bot',
          country: 'RU',
          requestCount: 940,
          rps: 94,
          limitRps: 50,
          violationsCount: 18,
          status: 'BLOCKED',
          blockedUntil: new Date(Date.now() + 86400000).toISOString()
        },
        {
          ip: '194.26.29.112',
          providerId: 'evolution',
          country: 'NL',
          requestCount: 1820,
          rps: 28,
          limitRps: 100,
          violationsCount: 2,
          status: 'THROTTLED'
        },
        {
          ip: '103.14.28.1',
          providerId: 'spribe',
          country: 'BD',
          requestCount: 6500,
          rps: 75,
          limitRps: 200,
          violationsCount: 0,
          status: 'WHITELISTED'
        }
      ];

      for (const ipRec of sampleIps) {
        await this.recordOrUpdateIpRateLimit(ipRec);
      }
    } catch (e) {
      console.warn('Initial security data seeding notice:', e);
    }
  }
}

export interface SecurityEventRecord {
  id: string;
  eventType: 'HMAC_VALIDATED' | 'INVALID_SIGNATURE' | 'EXPIRED_TIMESTAMP' | 'PAYLOAD_TAMPERED' | 'RATE_LIMIT_EXCEEDED' | 'IP_BLOCKED' | 'REPLAY_ATTACK';
  providerId: string;
  endpoint: string;
  ipAddress: string;
  country: string;
  status: 'ALLOWED' | 'BLOCKED' | 'FLAGGED' | 'CHALLENGED';
  signatureReceived?: string;
  signatureExpected?: string;
  timestampReceived?: number;
  clockSkewMs?: number;
  payloadPreview?: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
  createdAt: string;
}

export interface IpRateLimitRecord {
  id: string;
  ip: string;
  providerId: string;
  country: string;
  requestCount: number;
  rps: number;
  limitRps: number;
  violationsCount: number;
  status: 'NORMAL' | 'THROTTLED' | 'BLOCKED' | 'WHITELISTED';
  lastSeenAt: string;
  blockedUntil?: string;
}

export const firebaseFirestore = new FirebaseFirestoreService();
