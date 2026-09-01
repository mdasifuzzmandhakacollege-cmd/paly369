/**
 * @file NotificationBell.tsx
 * @description Real-time Notification Bell & Interactive Dropdown Menu for Navbar.
 * Displays live unread badges, withdrawal approval alerts, bonus unlocks, and quick simulation triggers.
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  CheckCircle2,
  Gift,
  CreditCard,
  Crown,
  Sparkles,
  Zap,
  Trash2,
  ExternalLink,
  CheckCheck,
  AlertCircle,
  Clock,
  ArrowRight,
  Plus
} from 'lucide-react';
import {
  notificationService,
  AppNotification,
  NotificationType
} from '../services/notificationService';
import { UserEntity } from '../server/types/seamless';

interface NotificationBellProps {
  currentUser: UserEntity;
  onNavigateTab?: (tab: any) => void;
  currency?: 'BDT' | 'USD';
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  currentUser,
  onNavigateTab,
  currency = 'BDT'
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filterType, setFilterType] = useState<'ALL' | 'WITHDRAWAL' | 'BONUS' | 'SYSTEM'>('ALL');
  const [hasNewAlert, setHasNewAlert] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Subscribe to real-time notification updates
  useEffect(() => {
    const unsubscribe = notificationService.subscribe(currentUser.id, (notifs) => {
      setNotifications(notifs);

      // Check if there are unread items
      const hasUnread = notifs.some((n) => !n.isRead);
      if (hasUnread) {
        setHasNewAlert(true);
      }
    });

    return () => unsubscribe();
  }, [currentUser.id]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      setHasNewAlert(false);
    }
  };

  const handleMarkAsRead = async (notifId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await notificationService.markAsRead(currentUser.id, notifId);
  };

  const handleMarkAllAsRead = async () => {
    await notificationService.markAllAsRead(currentUser.id);
  };

  const handleDelete = async (notifId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await notificationService.deleteNotification(currentUser.id, notifId);
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.isRead) {
      await notificationService.markAsRead(currentUser.id, notif.id);
    }
    if (notif.actionTab && onNavigateTab) {
      onNavigateTab(notif.actionTab);
      setIsOpen(false);
    }
  };

  // Quick Test Trigger Helpers
  const handleSimulateWithdrawal = () => {
    notificationService.simulateWithdrawalApproved(
      currentUser.id,
      currentUser.currency === 'BDT' ? 8500 : 75,
      'bKash'
    );
  };

  const handleSimulateBonus = () => {
    notificationService.simulateBonusUnlocked(
      currentUser.id,
      '১০০% মেগা ওয়েলকাম বোনাস',
      currentUser.currency === 'BDT' ? 3500 : 30
    );
  };

  // Filtered notifications
  const filteredNotifications = notifications.filter((n) => {
    if (filterType === 'WITHDRAWAL') return n.type === 'WITHDRAWAL_APPROVED';
    if (filterType === 'BONUS') return n.type === 'BONUS_UNLOCKED';
    if (filterType === 'SYSTEM')
      return n.type === 'VIP_UPGRADE' || n.type === 'SYSTEM_ALERT' || n.type === 'AFFILIATE_COMMISSION';
    return true;
  });

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'WITHDRAWAL_APPROVED':
        return (
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-sm shadow-emerald-500/20">
            <CreditCard className="w-4 h-4" />
          </div>
        );
      case 'BONUS_UNLOCKED':
        return (
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0 shadow-sm shadow-purple-500/20">
            <Gift className="w-4 h-4 animate-bounce" />
          </div>
        );
      case 'VIP_UPGRADE':
        return (
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-sm shadow-amber-500/20">
            <Crown className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
            <Zap className="w-4 h-4" />
          </div>
        );
    }
  };

  const formatRelativeTime = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'এইমাত্র (Just now)';
    if (mins < 60) return `${mins} মি. আগে`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ঘণ্টা আগে`;
    return new Date(isoString).toLocaleDateString('bn-BD', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="relative font-mono" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={handleToggle}
        aria-label="Open Notifications"
        className={`relative p-2 rounded-xl border transition-all duration-200 ${
          isOpen
            ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-lg shadow-amber-500/10'
            : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'
        }`}
      >
        <Bell className={`w-4 h-4 ${unreadCount > 0 ? 'text-amber-400' : 'text-slate-400'}`} />

        {/* Unread Count Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-gradient-to-r from-rose-500 to-red-600 text-white text-[9px] font-black items-center justify-center shadow-md">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Real-time Notification Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#0c1018] border border-slate-800 rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="bg-slate-900/90 border-b border-slate-800 p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white font-sans">
                    নোটিফিকেশন সেন্টার
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {unreadCount}টি অপঠিত নোটিফিকেশন
                  </span>
                </div>
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-[10px] text-amber-400 hover:text-amber-300 font-mono font-bold flex items-center space-x-1 hover:underline"
                >
                  <CheckCheck className="w-3 h-3" />
                  <span>সব পঠিত করুন</span>
                </button>
              )}
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center space-x-1 px-3 py-2 bg-slate-950/80 border-b border-slate-800/80 text-[10px] overflow-x-auto no-scrollbar">
              {[
                { id: 'ALL', label: 'সকল' },
                { id: 'WITHDRAWAL', label: '💸 উইথড্রয়াল' },
                { id: 'BONUS', label: '🎁 বোনাস' },
                { id: 'SYSTEM', label: '📢 সিস্টেম' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id as any)}
                  className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all ${
                    filterType === tab.id
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Notification Items List */}
            <div className="overflow-y-auto divide-y divide-slate-800/60 max-h-72 p-1 font-sans">
              {filteredNotifications.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs font-mono space-y-1">
                  <Bell className="w-6 h-6 mx-auto text-slate-700" />
                  <p>কোনো নোটিফিকেশন নেই</p>
                </div>
              ) : (
                filteredNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3 rounded-2xl transition-all cursor-pointer flex items-start space-x-3 group relative ${
                      !notif.isRead
                        ? 'bg-slate-900/90 hover:bg-slate-800/90 border border-amber-500/20'
                        : 'hover:bg-slate-900/50'
                    }`}
                  >
                    {/* Icon */}
                    {getNotificationIcon(notif.type)}

                    {/* Content */}
                    <div className="flex-1 space-y-1 pr-6">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-bold text-white leading-tight">
                          {notif.title}
                        </span>
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />
                        )}
                      </div>

                      <p className="text-[11px] text-slate-300 leading-relaxed font-normal">
                        {notif.message}
                      </p>

                      <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500 font-mono">
                        <span>{formatRelativeTime(notif.createdAt)}</span>
                        {notif.actionTab && (
                          <span className="text-amber-400 group-hover:underline flex items-center space-x-0.5 font-bold">
                            <span>ভিউ করুন</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Delete Item Button */}
                    <button
                      onClick={(e) => handleDelete(notif.id, e)}
                      title="Delete notification"
                      className="absolute top-3 right-3 p-1 rounded-md text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Quick Live Trigger Bar for Testing Real-time Triggers */}
            <div className="bg-slate-950 p-3 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span className="flex items-center space-x-1 text-cyan-400 font-bold">
                  <Zap className="w-3 h-3" />
                  <span>লাইভ টেস্ট ট্রিগার (Simulate Alerts):</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleSimulateWithdrawal}
                  className="px-2 py-1.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold font-mono transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center space-x-1"
                >
                  <CreditCard className="w-3 h-3" />
                  <span>+ উইথড্রয়াল অনুমোদন</span>
                </button>

                <button
                  onClick={handleSimulateBonus}
                  className="px-2 py-1.5 rounded-xl bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 text-purple-300 text-[10px] font-bold font-mono transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center space-x-1"
                >
                  <Gift className="w-3 h-3" />
                  <span>+ বোনাস আনলক</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
