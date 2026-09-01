/**
 * @file InboxMailModal.tsx
 * @description In-App Notification Center & Mailbox for Playall 365 / G777.
 * Displays unread VIP rewards, deposit confirmations, level-up bonuses, and system notices.
 */

import React, { useState } from 'react';
import {
  Mail,
  X,
  Gift,
  CheckCircle2,
  Bell,
  Sparkles,
  Zap,
  ShieldCheck,
  Coins,
  ArrowRight
} from 'lucide-react';
import { useWalletGame } from '../contexts/WalletGameContext';
import { soundEngine } from '../services/soundEngine';

interface InboxMailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: any) => void;
}

interface MessageItem {
  id: string;
  title: string;
  body: string;
  time: string;
  type: 'BONUS' | 'SYSTEM' | 'VIP' | 'DEPOSIT';
  rewardAmount?: number;
  claimed?: boolean;
}

export const InboxMailModal: React.FC<InboxMailModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab
}) => {
  const { currentUser, currentWallet, currency, topUpWallet, showToast, audioEngine } = useWalletGame();

  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 'msg_1',
      title: '🎉 রেজিস্ট্রেশন ওয়েলকাম বোনাস!',
      body: 'Playall 365-এ স্বাগতম! আপনার অ্যাকাউন্টে ৳২,৫০০ রিয়েল ব্যালেন্স এবং ৳১০,০০০ ওয়েলকাম বোনাস যুক্ত করা হয়েছে।',
      time: 'Just now',
      type: 'BONUS',
      rewardAmount: 500,
      claimed: false
    },
    {
      id: 'msg_2',
      title: '🎁 দৈনিক লাকি হুইল স্পিন প্রস্তুত!',
      body: 'আজকের ফ্রি লাকি স্পিন প্রস্তুত। হুইল ঘুরিয়ে জিতে নিন ইনস্ট্যান্ট ক্যাশ ও গোল্ডেন কয়েন।',
      time: '10m ago',
      type: 'BONUS',
      rewardAmount: 250,
      claimed: false
    },
    {
      id: 'msg_3',
      title: '⚡ bKash ও Nagad ডিপোজিটে +৫% এক্সট্রা',
      body: 'আজকের প্রতিটি লোকাল কারেন্সি ডিপোজিটে পাবেন অতিরিক্ত ৫% ক্যাশ বোনাস।',
      time: '1h ago',
      type: 'DEPOSIT'
    },
    {
      id: 'msg_4',
      title: '👑 VIP গোল্ড লেভেল আনলক হয়েছে!',
      body: 'অভিনন্দন! আপনার সাপ্তাহিক ক্যাশব্যাক রেট এখন ১.২% এ উন্নীত করা হয়েছে।',
      time: '3h ago',
      type: 'VIP'
    },
    {
      id: 'msg_5',
      title: '✈️ Aviator ও JILI সুপার টুর্নামেন্ট',
      body: 'চলতি সপ্তাহের ১ কোটি টাকার টুর্নামেন্ট লিডারবোর্ডে অংশ নিন এবং শীর্ষ পুরস্কার জিতে নিন।',
      time: '5h ago',
      type: 'SYSTEM'
    }
  ]);

  if (!isOpen) return null;

  const handleClaim = (msgId: string, amount?: number) => {
    if (!amount) return;
    soundEngine.playWinChime();
    soundEngine.playCoinShower(10);
    topUpWallet(amount);
    showToast(`+৳${amount} বোনাস সফলভাবে যুক্ত হয়েছে!`);
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, claimed: true } : m))
    );
  };

  const handleClaimAll = () => {
    let total = 0;
    messages.forEach((m) => {
      if (m.rewardAmount && !m.claimed) {
        total += m.rewardAmount;
      }
    });

    if (total > 0) {
      soundEngine.playMegaWin();
      topUpWallet(total);
      showToast(`+৳${total} সকল পুরস্কার সফলভাবে যোগ হয়েছে!`);
      setMessages((prev) => prev.map((m) => ({ ...m, claimed: true })));
    } else {
      showToast('সকল পুরস্কার ইতিমধ্যে গ্রহণ করা হয়েছে।');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#0b0f19] border-2 border-amber-500/40 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-[#07090e] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center space-x-2">
                <span>বিজ্ঞপ্তি ও ইনবক্স</span>
                <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black">
                  28
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                সিস্টেম নোটিশ, প্রমোশন ও ক্যাশ পুরস্কার
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white border border-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message List */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1 divide-y divide-slate-800/60">
          {messages.map((msg) => (
            <div key={msg.id} className="pt-3 first:pt-0 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center space-x-2">
                  {msg.type === 'BONUS' ? (
                    <Gift className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : msg.type === 'VIP' ? (
                    <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                  ) : msg.type === 'DEPOSIT' ? (
                    <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Bell className="w-4 h-4 text-cyan-400 shrink-0" />
                  )}
                  <h3 className="text-sm font-bold text-white leading-tight">
                    {msg.title}
                  </h3>
                </div>
                <span className="text-[10px] text-slate-500 font-mono shrink-0">
                  {msg.time}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed pl-6">
                {msg.body}
              </p>

              {msg.rewardAmount && (
                <div className="pl-6 flex items-center justify-between pt-1">
                  <span className="text-xs font-black font-mono text-amber-300">
                    পুরস্কার: ৳{msg.rewardAmount.toLocaleString()}
                  </span>

                  <button
                    disabled={msg.claimed}
                    onClick={() => handleClaim(msg.id, msg.rewardAmount)}
                    className={`px-3 py-1 rounded-xl text-xs font-black font-mono transition-all cursor-pointer ${
                      msg.claimed
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-md shadow-amber-500/20 active:scale-95'
                    }`}
                  >
                    {msg.claimed ? 'গৃহীত (Claimed)' : 'গ্রহণ করুন'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-[#07090e] flex items-center justify-between gap-3">
          <button
            onClick={() => {
              onClose();
              onNavigateTab('promo');
            }}
            className="text-xs text-amber-400 hover:underline font-mono font-bold flex items-center space-x-1"
          >
            <span>সব অফার দেখুন</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleClaimAll}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 active:scale-95 transition-all cursor-pointer"
          >
            সব গ্রহণ করুন (Claim All)
          </button>
        </div>
      </div>
    </div>
  );
};
