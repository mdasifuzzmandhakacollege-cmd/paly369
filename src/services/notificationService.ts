/**
 * @file notificationService.ts
 * @description Real-time Notification Service for Playall 365.
 * Uses Firebase Firestore onSnapshot listeners with local event bus synchronization
 * to deliver real-time notifications for withdrawal approvals, bonus unlocks, and VIP events.
 */

import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import confetti from 'canvas-confetti';

export type NotificationType =
  | 'WITHDRAWAL_APPROVED'
  | 'BONUS_UNLOCKED'
  | 'DEPOSIT_CONFIRMED'
  | 'VIP_UPGRADE'
  | 'AFFILIATE_COMMISSION'
  | 'SYSTEM_ALERT';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  amount?: number | string;
  currency?: 'BDT' | 'USD';
  isRead: boolean;
  actionTab?: string;
  createdAt: string;
}

// Initial seed notifications for immediate player demo
const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif_seed_001',
    userId: 'a0000000-0000-0000-0000-000000000004', // Sakib (VIP)
    title: 'বিকাশ উইথড্রয়াল অনুমোদিত (Approved)',
    message: 'আপনার ৳৫,০০০ টাকার উইথড্রয়াল রিকোয়েস্ট সফলভাবে প্রসেস করা হয়েছে (TrxID: 9J3K88L2).',
    type: 'WITHDRAWAL_APPROVED',
    amount: 5000,
    currency: 'BDT',
    isRead: false,
    actionTab: 'cashier',
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString()
  },
  {
    id: 'notif_seed_002',
    userId: 'a0000000-0000-0000-0000-000000000004',
    title: '১০০% সাপ্তাহিক রিলোড বোনাস আনলক!',
    message: 'অভিনন্দন! আপনার ডিপোজিটে ৳২,৫০০ বোনাস ক্রেডিট আনলক হয়েছে। এখনই এভিয়েটর খেলুন।',
    type: 'BONUS_UNLOCKED',
    amount: 2500,
    currency: 'BDT',
    isRead: false,
    actionTab: 'promo',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString()
  },
  {
    id: 'notif_seed_003',
    userId: 'a0000000-0000-0000-0000-000000000004',
    title: 'ভিআইপি ডায়মন্ড ক্যাশব্যাক জমা হয়েছে',
    message: 'আপনার গত সপ্তাহের ১.৫% ডায়মন্ড ক্যাশব্যাক ৳১,৮৫০ সরাসরি ওয়ালেটে যুক্ত হয়েছে।',
    type: 'VIP_UPGRADE',
    amount: 1850,
    currency: 'BDT',
    isRead: true,
    actionTab: 'vip',
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString()
  }
];

class NotificationService {
  private localNotifications: Map<string, AppNotification[]> = new Map();
  private listeners: Map<string, Array<(notifs: AppNotification[]) => void>> = new Map();

  constructor() {
    // Seed initial notifications for default demo user
    this.localNotifications.set(
      'a0000000-0000-0000-0000-000000000004',
      [...INITIAL_NOTIFICATIONS]
    );
  }

  /**
   * Subscribe to real-time notification updates for a specific user
   */
  public subscribe(
    userId: string,
    callback: (notifications: AppNotification[]) => void
  ): () => void {
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, []);
    }
    this.listeners.get(userId)!.push(callback);

    // Provide initial state immediately
    const current = this.getUserNotifications(userId);
    callback(current);

    // Try setting up Firebase Firestore real-time onSnapshot listener if authenticated
    let unsubscribeFirestore: (() => void) | null = null;
    try {
      if (auth.currentUser && auth.currentUser.uid === userId) {
        const notifsRef = collection(db, 'users', userId, 'notifications');
        unsubscribeFirestore = onSnapshot(
          notifsRef,
          (snapshot) => {
            const firestoreNotifs: AppNotification[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              firestoreNotifs.push({
                id: docSnap.id,
                userId: data.userId || userId,
                title: data.title || '',
                message: data.message || '',
                type: data.type || 'SYSTEM_ALERT',
                amount: data.amount,
                currency: data.currency || 'BDT',
                isRead: !!data.isRead,
                actionTab: data.actionTab,
                createdAt: data.createdAt || new Date().toISOString()
              });
            });

            // Sort newest first
            firestoreNotifs.sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            if (firestoreNotifs.length > 0) {
              this.localNotifications.set(userId, firestoreNotifs);
              this.notifyListeners(userId);
            }
          },
          (error) => {
            console.warn('Firestore notification listener fallback to local state:', error);
          }
        );
      }
    } catch (err) {
      console.warn('Notification listener initial error:', err);
    }

    // Return cleanup function
    return () => {
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
      const list = this.listeners.get(userId) || [];
      this.listeners.set(
        userId,
        list.filter((cb) => cb !== callback)
      );
    };
  }

  /**
   * Get current notifications for user
   */
  public getUserNotifications(userId: string): AppNotification[] {
    const list = this.localNotifications.get(userId) || [];
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Dispatch a real-time notification
   */
  public async pushNotification(
    userId: string,
    notification: Omit<AppNotification, 'id' | 'createdAt'>
  ): Promise<AppNotification> {
    const newNotif: AppNotification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString()
    };

    // Update local state
    const current = this.localNotifications.get(userId) || [];
    this.localNotifications.set(userId, [newNotif, ...current]);
    this.notifyListeners(userId);

    // Trigger visual confetti celebration for withdrawals and bonuses
    if (
      notification.type === 'WITHDRAWAL_APPROVED' ||
      notification.type === 'BONUS_UNLOCKED' ||
      notification.type === 'VIP_UPGRADE'
    ) {
      try {
        confetti({
          particleCount: 50,
          spread: 55,
          origin: { y: 0.1, x: 0.85 },
          colors: ['#06b6d4', '#f59e0b', '#10b981', '#ec4899']
        });
      } catch (e) {
        // ignore in non-browser
      }
    }

    // Sync to Firestore if signed in
    try {
      if (auth.currentUser && auth.currentUser.uid === userId) {
        const notifDoc = doc(db, 'users', userId, 'notifications', newNotif.id);
        await setDoc(notifDoc, {
          ...newNotif,
          serverTimestamp: serverTimestamp()
        });
      }
    } catch (err) {
      console.warn('Firestore notif push fallback:', err);
    }

    return newNotif;
  }

  /**
   * Mark a notification as read
   */
  public async markAsRead(userId: string, notificationId: string): Promise<void> {
    const current = this.localNotifications.get(userId) || [];
    const updated = current.map((n) =>
      n.id === notificationId ? { ...n, isRead: true } : n
    );
    this.localNotifications.set(userId, updated);
    this.notifyListeners(userId);

    try {
      if (auth.currentUser && auth.currentUser.uid === userId) {
        const notifDoc = doc(db, 'users', userId, 'notifications', notificationId);
        await updateDoc(notifDoc, { isRead: true });
      }
    } catch (err) {
      // local fallback handled
    }
  }

  /**
   * Mark all notifications as read
   */
  public async markAllAsRead(userId: string): Promise<void> {
    const current = this.localNotifications.get(userId) || [];
    const updated = current.map((n) => ({ ...n, isRead: true }));
    this.localNotifications.set(userId, updated);
    this.notifyListeners(userId);

    try {
      if (auth.currentUser && auth.currentUser.uid === userId) {
        for (const notif of current) {
          if (!notif.isRead) {
            const notifDoc = doc(db, 'users', userId, 'notifications', notif.id);
            await updateDoc(notifDoc, { isRead: true });
          }
        }
      }
    } catch (err) {
      // local fallback handled
    }
  }

  /**
   * Delete a notification
   */
  public async deleteNotification(userId: string, notificationId: string): Promise<void> {
    const current = this.localNotifications.get(userId) || [];
    const updated = current.filter((n) => n.id !== notificationId);
    this.localNotifications.set(userId, updated);
    this.notifyListeners(userId);

    try {
      if (auth.currentUser && auth.currentUser.uid === userId) {
        const notifDoc = doc(db, 'users', userId, 'notifications', notificationId);
        await deleteDoc(notifDoc);
      }
    } catch (err) {
      // local fallback handled
    }
  }

  /**
   * Clear all notifications for user
   */
  public clearAll(userId: string): void {
    this.localNotifications.set(userId, []);
    this.notifyListeners(userId);
  }

  /**
   * Trigger Real-Time Deposit Confirmation Notification
   */
  public notifyDepositConfirmed(
    amount: number,
    currency: 'BDT' | 'USD' = 'BDT',
    gateway: string = 'bKash',
    userId?: string
  ): Promise<AppNotification> {
    const targetUid = userId || 'a0000000-0000-0000-0000-000000000004';
    return this.pushNotification(targetUid, {
      userId: targetUid,
      title: `✅ ${gateway} ডিপোজিট সফল ও ব্যালেন্স যুক্ত হয়েছে!`,
      message: `আপনার ${currency === 'BDT' ? '৳' : '$'}${amount.toLocaleString()} ডিপোজিট অনুমোদিত হয়ে সরাসরি ওয়ালেটে যুক্ত করা হয়েছে।`,
      type: 'DEPOSIT_CONFIRMED',
      amount,
      currency,
      isRead: false,
      actionTab: 'cashier'
    });
  }

  /**
   * Trigger Real-Time Withdrawal Approval Notification
   */
  public notifyWithdrawalApproved(
    amount: number,
    currency: 'BDT' | 'USD' = 'BDT',
    userId?: string
  ): Promise<AppNotification> {
    const targetUid = userId || 'a0000000-0000-0000-0000-000000000004';
    return this.pushNotification(targetUid, {
      userId: targetUid,
      title: `✅ উইথড্রয়াল অনুমোদিত ও ডিসপ্যাচ করা হয়েছে`,
      message: `আপনার ${currency === 'BDT' ? '৳' : '$'}${amount.toLocaleString()} টাকার উইথড্রয়াল অনুমোদন করে একাউন্টে পাঠানো হয়েছে।`,
      type: 'WITHDRAWAL_APPROVED',
      amount,
      currency,
      isRead: false,
      actionTab: 'cashier'
    });
  }

  /**
   * Trigger Real-Time System Notification Alert
   */
  public notifySystemAlert(
    title: string,
    message: string,
    userId?: string
  ): Promise<AppNotification> {
    const targetUid = userId || 'a0000000-0000-0000-0000-000000000004';
    return this.pushNotification(targetUid, {
      userId: targetUid,
      title,
      message,
      type: 'SYSTEM_ALERT',
      isRead: false,
      actionTab: 'cashier'
    });
  }

  /**
   * Trigger Simulated Withdrawal Approval for instant testing
   */
  public simulateWithdrawalApproved(
    userId: string,
    amount: number = 7500,
    gateway: string = 'bKash'
  ): Promise<AppNotification> {
    return this.pushNotification(userId, {
      userId,
      title: `✅ ${gateway} উইথড্রয়াল অনুমোদিত (${gateway} Payout Approved)`,
      message: `আপনার ৳${amount.toLocaleString()} টাকার উইথড্রয়াল অনুমোদিত হয়েছে এবং আপনার ${gateway} একাউন্টে পাঠানো হয়েছে।`,
      type: 'WITHDRAWAL_APPROVED',
      amount,
      currency: 'BDT',
      isRead: false,
      actionTab: 'cashier'
    });
  }

  /**
   * Trigger Simulated Bonus Unlock for instant testing
   */
  public simulateBonusUnlocked(
    userId: string,
    bonusName: string = '২০০% মেগা ওয়েলকাম বোনাস',
    amount: number = 3000
  ): Promise<AppNotification> {
    return this.pushNotification(userId, {
      userId,
      title: `🎁 ${bonusName} আনলক হয়েছে!`,
      message: `আপনার প্রোফাইলে ৳${amount.toLocaleString()} বোনাস ব্যালেন্স যোগ করা হয়েছে। এখনই বাজি ধরে রিয়েল ক্যাশে কনভার্ট করুন!`,
      type: 'BONUS_UNLOCKED',
      amount,
      currency: 'BDT',
      isRead: false,
      actionTab: 'wagering'
    });
  }

  private notifyListeners(userId: string): void {
    const list = this.listeners.get(userId) || [];
    const notifs = this.getUserNotifications(userId);
    list.forEach((cb) => cb(notifs));
  }
}

export const notificationService = new NotificationService();
