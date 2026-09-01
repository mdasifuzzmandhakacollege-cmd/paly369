/**
 * @file SupportModal.tsx
 * @description 24/7 Live Customer Support, Agent Chat, and Official Telegram Hotline Modal.
 */

import React, { useState } from 'react';
import {
  Headphones,
  X,
  Send,
  MessageCircle,
  ShieldCheck,
  Zap,
  PhoneCall,
  Clock,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { useWalletGame } from '../contexts/WalletGameContext';
import { soundEngine } from '../services/soundEngine';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMsg {
  id: string;
  sender: 'AGENT' | 'USER';
  text: string;
  time: string;
}

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
  const { currentUser } = useWalletGame();

  const [inputVal, setInputVal] = useState('');
  const [chatLog, setChatLog] = useState<ChatMsg[]>([
    {
      id: 'c1',
      sender: 'AGENT',
      text: `আসসালামু আলাইকুম ${currentUser.username}! Playall 365 VIP লাইভ সাপোর্টে আপনাকে স্বাগতম। ডিপোজিট, উইথড্রয়াল বা গেম সংক্রান্ত যেকোনো প্রয়োজনে আমাদের জানান।`,
      time: 'Just now'
    }
  ]);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    soundEngine.playClick(900);
    const userText = inputVal.trim();
    setInputVal('');

    const newMsg: ChatMsg = {
      id: `usr_${Date.now()}`,
      sender: 'USER',
      text: userText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatLog((prev) => [...prev, newMsg]);

    // Fast Simulated Agent Reply
    setTimeout(() => {
      soundEngine.playWinChime();
      const agentReply: ChatMsg = {
        id: `agt_${Date.now()}`,
        sender: 'AGENT',
        text: `ধন্যবাদ আপনার বার্তার জন্য। আপনার অনুরোধটি প্রক্রিয়াধীন আছে। bKash/Nagad ডিপোজিট সাধারণত ২-৩ মিনিটের মধ্যে স্বয়ংক্রিয়ভাবে ব্যালেন্সে জমা হয়।`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatLog((prev) => [...prev, agentReply]);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#0b0f19] border-2 border-cyan-500/40 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col h-[600px] max-h-[90vh]">
        {/* Support Header */}
        <div className="p-4 bg-[#07090e] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <Headphones className="w-5 h-5" />
              </div>
              <span className="w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0b0f19] absolute -bottom-0.5 -right-0.5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center space-x-2">
                <span>২৪/৭ ভিআইপি সাপোর্ট</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">
                  অনলাইন
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                গড় রেসপন্স টাইম: &lt; ৩০ সেকেন্ড
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

        {/* Quick Social Buttons */}
        <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950/70 border-b border-slate-800/80 font-mono text-xs">
          <a
            href="https://t.me/playall365_official"
            target="_blank"
            rel="noreferrer"
            className="p-2.5 rounded-xl bg-sky-500/20 border border-sky-500/40 hover:bg-sky-500/30 text-sky-300 font-bold flex items-center justify-center space-x-1.5 transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>অফিসিয়াল টেলিগ্রাম</span>
          </a>

          <a
            href="https://wa.me/+8801700000000"
            target="_blank"
            rel="noreferrer"
            className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300 font-bold flex items-center justify-center space-x-1.5 transition-all"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>হোয়াটসঅ্যাপ হেল্পলাইন</span>
          </a>
        </div>

        {/* Chat Stream */}
        <div className="flex-1 p-4 space-y-3 overflow-y-auto font-sans text-xs">
          {chatLog.map((c) => (
            <div
              key={c.id}
              className={`flex flex-col ${c.sender === 'USER' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[80%] p-3.5 rounded-2xl leading-relaxed ${
                  c.sender === 'USER'
                    ? 'bg-amber-500 text-slate-950 font-semibold rounded-br-none shadow-md'
                    : 'bg-slate-900 text-slate-200 border border-slate-800 rounded-bl-none shadow-md'
                }`}
              >
                {c.text}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 font-mono">{c.time}</span>
            </div>
          ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-3 bg-[#07090e] border-t border-slate-800 flex items-center space-x-2">
          <input
            type="text"
            placeholder="আপনার সমস্যা বা বার্তা লিখুন..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold shadow-lg shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
