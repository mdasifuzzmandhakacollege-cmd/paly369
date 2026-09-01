/**
 * @file GoogleDrivePickerHub.tsx
 * @description Enhanced Google Drive & Picker KYC Hub for Playall 365.
 * Features a visual 'Document Status' tracker (Pending, Verified, Rejected),
 * responsive data table listing selected files, and instant local state deletion.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { User } from 'firebase/auth';
import {
  FolderLock,
  FileCheck,
  UploadCloud,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  LogOut,
  FolderOpen,
  Info,
  CheckCircle,
  RotateCw,
  Search,
  Filter,
  Eye,
  Plus
} from 'lucide-react';
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken
} from '../lib/firebase';
import {
  openGooglePicker,
  PickedGoogleDoc,
  PickerViewType
} from '../services/googlePickerService';
import { UserEntity } from '../server/types/seamless';

export type KycDocumentStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface KycAttachedFile extends PickedGoogleDoc {
  docType: string;
  status: KycDocumentStatus;
  rejectionReason?: string;
  verifiedAt?: string;
}

interface GoogleDrivePickerHubProps {
  currentUser: UserEntity;
  onKycUpdated?: () => void;
}

export const GoogleDrivePickerHub: React.FC<GoogleDrivePickerHubProps> = ({
  currentUser,
  onKycUpdated
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [isPickerLoading, setIsPickerLoading] = useState<boolean>(false);
  const [pickerCategory, setPickerCategory] = useState<PickerViewType>('all');
  const [documentType, setDocumentType] = useState<string>('kyc_nid');
  const [statusFilter, setStatusFilter] = useState<'ALL' | KycDocumentStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Initial mock documents to demonstrate the tracker immediately
  const [attachedFiles, setAttachedFiles] = useState<KycAttachedFile[]>([
    {
      id: 'mock_drive_001',
      name: 'NID_SmartCard_Bangladesh_FrontBack.pdf',
      mimeType: 'application/pdf',
      type: 'document',
      url: 'https://drive.google.com',
      sizeBytes: 1548576,
      uploadDate: new Date(Date.now() - 86400000 * 2).toISOString(),
      docType: 'kyc_nid',
      status: 'VERIFIED',
      verifiedAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: 'mock_drive_002',
      name: 'bKash_Merchant_Statement_August_2026.pdf',
      mimeType: 'application/pdf',
      type: 'document',
      url: 'https://drive.google.com',
      sizeBytes: 835200,
      uploadDate: new Date(Date.now() - 3600000 * 5).toISOString(),
      docType: 'bank_statement',
      status: 'PENDING'
    },
    {
      id: 'mock_drive_003',
      name: 'Utility_Bill_Electricity_Old.jpg',
      mimeType: 'image/jpeg',
      type: 'image',
      url: 'https://drive.google.com',
      sizeBytes: 2450000,
      uploadDate: new Date(Date.now() - 86400000 * 4).toISOString(),
      docType: 'utility_bill',
      status: 'REJECTED',
      rejectionReason: 'ডকুমেন্টের মেয়াদ উত্তীর্ণ (Expired >3 months)'
    }
  ]);

  const [toast, setToast] = useState<string | null>(null);

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (authUser, authToken) => {
        setUser(authUser);
        setToken(authToken);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  // Handle Google Sign In
  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
        setToast(`গুগল সাইন-ইন সফল হয়েছে: ${result.user.email}`);
        setTimeout(() => setToast(null), 3500);
      }
    } catch (err: any) {
      console.error('Sign in failed:', err);
      setToast('সাইন-ইন ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
      setTimeout(() => setToast(null), 3500);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setNeedsAuth(true);
    setToast('গুগল অ্যাকাউন্ট সাইন-আউট করা হয়েছে');
    setTimeout(() => setToast(null), 3000);
  };

  // Launch Google Picker Widget
  const handleOpenPicker = async () => {
    let activeToken = token || (await getAccessToken());

    if (!activeToken) {
      setNeedsAuth(true);
      setToast('গুগল ড্রাইভ অ্যাক্সেসের জন্য প্রথমে গুগল দিয়ে সাইন ইন করুন');
      setTimeout(() => setToast(null), 3500);
      return;
    }

    setIsPickerLoading(true);
    try {
      await openGooglePicker({
        accessToken: activeToken,
        viewType: pickerCategory,
        title: `Playall 365 Drive Vault - ${
          documentType === 'kyc_nid'
            ? 'Select NID / Passport Document'
            : documentType === 'bank_statement'
            ? 'Select Bank / MFS Statement'
            : documentType === 'affiliate_media'
            ? 'Select Affiliate Creative'
            : 'Select File'
        }`,
        onPicked: (pickedDocs) => {
          setIsPickerLoading(false);
          if (pickedDocs.length > 0) {
            const newAttachments: KycAttachedFile[] = pickedDocs.map((doc) => ({
              ...doc,
              docType: documentType,
              status: 'PENDING'
            }));

            setAttachedFiles((prev) => [...newAttachments, ...prev]);

            confetti({
              particleCount: 70,
              spread: 60,
              origin: { y: 0.7 },
              colors: ['#06b6d4', '#f59e0b', '#10b981']
            });

            setToast(`✅ ${pickedDocs.length}টি ফাইল গুগল ড্রাইভ থেকে সফলভাবে যুক্ত হয়েছে!`);
            if (onKycUpdated) onKycUpdated();
            setTimeout(() => setToast(null), 4000);
          }
        },
        onCancel: () => {
          setIsPickerLoading(false);
        }
      });
    } catch (err: any) {
      console.error('Error opening picker:', err);
      setIsPickerLoading(false);
      setToast('গুগল পিকার লোড করা যায়নি। অনুগ্রহ করে রিফ্রেশ করুন।');
      setTimeout(() => setToast(null), 3500);
    }
  };

  // Delete item from local state
  const handleDeleteDocument = (docId: string, docName: string) => {
    setAttachedFiles((prev) => prev.filter((d) => d.id !== docId));
    setToast(`🗑️ "${docName}" সফলভাবে লোকাল স্টেট থেকে ডিলিট করা হয়েছে`);
    setTimeout(() => setToast(null), 3500);
  };

  // Toggle status for demo / testing verification workflow
  const handleCycleStatus = (docId: string) => {
    setAttachedFiles((prev) =>
      prev.map((doc) => {
        if (doc.id !== docId) return doc;
        const nextStatus: KycDocumentStatus =
          doc.status === 'PENDING'
            ? 'VERIFIED'
            : doc.status === 'VERIFIED'
            ? 'REJECTED'
            : 'PENDING';
        return {
          ...doc,
          status: nextStatus,
          rejectionReason: nextStatus === 'REJECTED' ? 'অস্পষ্ট ছবি / তথ্য অমিল' : undefined,
          verifiedAt: nextStatus === 'VERIFIED' ? new Date().toISOString() : undefined
        };
      })
    );
  };

  // Statistics for Document Status Tracker
  const totalCount = attachedFiles.length;
  const verifiedCount = attachedFiles.filter((f) => f.status === 'VERIFIED').length;
  const pendingCount = attachedFiles.filter((f) => f.status === 'PENDING').length;
  const rejectedCount = attachedFiles.filter((f) => f.status === 'REJECTED').length;
  const verificationRate = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0;

  // Filtered documents list
  const filteredFiles = attachedFiles.filter((doc) => {
    const matchesStatus = statusFilter === 'ALL' || doc.status === statusFilter;
    const matchesSearch =
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.docType.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getDocTypeLabel = (type: string) => {
    switch (type) {
      case 'kyc_nid':
        return 'জাতীয় পরিচয়পত্র / NID';
      case 'bank_statement':
        return 'ব্যাংক / MFS স্টেটমেন্ট';
      case 'utility_bill':
        return 'ইউটিলিটি বিল (ঠিকানা)';
      case 'affiliate_media':
        return 'এফিলিয়েট ক্রিয়েটিভ';
      case 'audit_report':
        return 'ফাইন্যান্সিয়াল অডিট শিট';
      default:
        return 'সাধারণ ফাইল';
    }
  };

  return (
    <div className="bg-[#0b0e14] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-8 font-mono">
      {/* Toast Alert */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 right-6 z-50 bg-[#0f172a] border border-cyan-500/80 text-cyan-300 px-5 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 text-xs"
          >
            <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0 animate-pulse" />
            <span className="font-sans font-medium">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. Header with Google OAuth Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-500 to-indigo-600 p-[1px] shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[15px] flex items-center justify-center text-cyan-400">
              <FolderLock className="w-6 h-6" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-black text-white uppercase font-sans tracking-tight">
                গুগল ড্রাইভ ও KYC ভল্ট (Google Drive Vault)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold border border-cyan-500/40">
                Google Picker API v1
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-sans">
              Google Drive থেকে লাইভ KYC আইডেন্টিটি, ব্যাংক স্টেটমেন্ট ও অডিট ফাইল ভেরিফাই ও পরিচালনা করুন।
            </p>
          </div>
        </div>

        {/* Connected Google Account Pill */}
        {user ? (
          <div className="flex items-center space-x-3 bg-slate-900/90 px-4 py-2 rounded-2xl border border-slate-800 shrink-0">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-cyan-500/50 shrink-0">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || 'Google User'} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-xs">
                  {user.email?.charAt(0).toUpperCase() || 'G'}
                </div>
              )}
            </div>
            <div className="text-left text-xs">
              <div className="font-bold text-white truncate max-w-[150px] font-sans">{user.displayName || user.email}</div>
              <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Google Drive Connected</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out Google Account"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-2 bg-slate-900/90 px-3.5 py-2 rounded-2xl border border-slate-800 text-xs text-slate-400 shrink-0">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>গুগল ড্রাইভ আনলক করতে সাইন-ইন প্রয়োজন</span>
          </div>
        )}
      </div>

      {/* 2. Visual 'Document Status' Tracker KPI Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              ডকুমেন্ট স্ট্যাটাস ট্র্যাকার (Document Status Tracker)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            KYC Verification Health: <strong className="text-cyan-300">{verificationRate}%</strong>
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-emerald-500 transition-all duration-500"
            style={{ width: `${Math.max(5, verificationRate)}%` }}
          />
        </div>

        {/* 4 Status KPI Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {/* Total */}
          <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-3.5 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-400 uppercase">মোট ফাইল</div>
              <div className="text-lg font-black text-white mt-0.5">{totalCount}</div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>

          {/* Verified Badge Counter */}
          <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-3.5 flex items-center justify-between shadow-lg shadow-emerald-500/5">
            <div>
              <div className="text-[10px] text-emerald-400 uppercase font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Verified
              </div>
              <div className="text-lg font-black text-emerald-300 mt-0.5">{verifiedCount}</div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>

          {/* Pending Review Badge Counter */}
          <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-3.5 flex items-center justify-between shadow-lg shadow-amber-500/5">
            <div>
              <div className="text-[10px] text-amber-400 uppercase font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Pending
              </div>
              <div className="text-lg font-black text-amber-300 mt-0.5">{pendingCount}</div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>

          {/* Rejected Badge Counter */}
          <div className="bg-rose-950/20 border border-rose-500/30 rounded-2xl p-3.5 flex items-center justify-between shadow-lg shadow-rose-500/5">
            <div>
              <div className="text-[10px] text-rose-400 uppercase font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                Rejected
              </div>
              <div className="text-lg font-black text-rose-300 mt-0.5">{rejectedCount}</div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Action Hub: Google Sign-in Gate OR Picker Configuration Toolbar */}
      {needsAuth ? (
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <UploadCloud className="w-6 h-6" />
          </div>

          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-sm font-bold text-white font-sans">গুগল ড্রাইভ সংযোগ করুন</h3>
            <p className="text-xs text-slate-400 font-sans">
              আপনার গুগল ড্রাইভ থেকে সরাসরি KYC ডকুমেন্ট ও ব্যাংক স্টেটমেন্ট সংযুক্ত করতে গুগল দিয়ে সাইন ইন করুন।
            </p>
          </div>

          {/* Sign In with Google Button */}
          <div className="flex justify-center pt-1">
            <button
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="flex items-center space-x-3 bg-white hover:bg-slate-100 text-slate-900 font-sans font-medium px-5 py-2.5 rounded-full shadow-lg hover:shadow-xl active:scale-95 transition-all text-xs cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              <span>{isLoggingIn ? 'সংযোগ হচ্ছে...' : 'Sign in with Google'}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Connected Google Picker Launcher */
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-slate-950/70 p-4 sm:p-5 rounded-2xl border border-slate-800">
          <div className="md:col-span-4 space-y-1">
            <label className="text-[11px] font-bold text-slate-300">ডকুমেন্ট ক্যাটাগরি:</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="kyc_nid">জাতীয় পরিচয়পত্র / NID Card</option>
              <option value="bank_statement">ব্যাংক / বিকাশ / নগদ স্টেটমেন্ট</option>
              <option value="utility_bill">ইউটিলিটি বিল / ঠিকানার প্রমাণ</option>
              <option value="affiliate_media">এফিলিয়েট মার্কেটিং ক্রিয়েটিভ</option>
              <option value="audit_report">অডিট শিট / লেজার রেকর্ড</option>
            </select>
          </div>

          <div className="md:col-span-4 space-y-1">
            <label className="text-[11px] font-bold text-slate-300">পিকার ফিল্টার মোড:</label>
            <div className="grid grid-cols-4 gap-1">
              {[
                { id: 'all', label: 'সকল' },
                { id: 'documents', label: 'PDF/Doc' },
                { id: 'images', label: 'ছবি' },
                { id: 'spreadsheets', label: 'শিট' }
              ].map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setPickerCategory(filter.id as any)}
                  className={`py-2 px-1 text-center rounded-lg text-[10px] font-bold border transition-all ${
                    pickerCategory === filter.id
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-4 flex items-end">
            <button
              type="button"
              onClick={handleOpenPicker}
              disabled={isPickerLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
            >
              <FolderOpen className="w-4 h-4" />
              <span>{isPickerLoading ? 'পিকার লোড হচ্ছে...' : 'গুগল পিকার থেকে ফাইল আনুন'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Table Listing Selected Files with Visual Status Badges & Delete Action */}
      <div className="space-y-4">
        {/* Table Toolbar: Filter by Status & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded-lg transition-all font-bold ${
                statusFilter === 'ALL'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              সব ফাইল ({totalCount})
            </button>
            <button
              onClick={() => setStatusFilter('VERIFIED')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center space-x-1 font-bold ${
                statusFilter === 'VERIFIED'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-emerald-500 hover:text-emerald-400'
              }`}
            >
              <CheckCircle className="w-3 h-3" />
              <span>Verified ({verifiedCount})</span>
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center space-x-1 font-bold ${
                statusFilter === 'PENDING'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-amber-500 hover:text-amber-400'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>Pending ({pendingCount})</span>
            </button>
            <button
              onClick={() => setStatusFilter('REJECTED')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center space-x-1 font-bold ${
                statusFilter === 'REJECTED'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'text-rose-500 hover:text-rose-400'
              }`}
            >
              <XCircle className="w-3 h-3" />
              <span>Rejected ({rejectedCount})</span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ফাইলের নাম দিয়ে খুঁজুন..."
              className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-full sm:w-56"
            />
          </div>
        </div>

        {/* Small Data Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800/90 bg-slate-950/60 shadow-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3.5">ডকুমেন্টের নাম ও বিবরণ</th>
                <th className="p-3.5">ক্যাটাগরি</th>
                <th className="p-3.5">ডকুমেন্ট স্ট্যাটাস</th>
                <th className="p-3.5">তারিখ</th>
                <th className="p-3.5 text-right">অ্যাকশন (Actions)</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/80 font-mono">
              <AnimatePresence>
                {filteredFiles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      <FolderOpen className="w-7 h-7 mx-auto text-slate-600 mb-2 opacity-50" />
                      কোনো ডকুমেন্ট পাওয়া যায়নি। গুগল ড্রাইভ থেকে ফাইল নির্বাচন করুন।
                    </td>
                  </tr>
                ) : (
                  filteredFiles.map((doc) => {
                    const isPdf = doc.mimeType.includes('pdf');
                    const isSheet = doc.mimeType.includes('spreadsheet') || doc.mimeType.includes('excel');
                    const isImage = doc.mimeType.includes('image');

                    return (
                      <motion.tr
                        key={doc.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="hover:bg-slate-900/50 transition-colors"
                      >
                        {/* 1. File Info */}
                        <td className="p-3.5">
                          <div className="flex items-center space-x-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                                isPdf
                                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                                  : isSheet
                                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                  : isImage
                                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                                  : 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                              }`}
                            >
                              {isPdf && <FileText className="w-4 h-4" />}
                              {isSheet && <FileSpreadsheet className="w-4 h-4" />}
                              {isImage && <ImageIcon className="w-4 h-4" />}
                              {!isPdf && !isSheet && !isImage && <FileCheck className="w-4 h-4" />}
                            </div>

                            <div className="truncate max-w-[200px] sm:max-w-xs">
                              <div className="font-bold text-white truncate text-xs font-sans">
                                {doc.name}
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center space-x-2">
                                <span>{doc.sizeBytes ? `${(doc.sizeBytes / 1024 / 1024).toFixed(2)} MB` : '1.2 MB'}</span>
                                <span>•</span>
                                <span className="text-cyan-400/80">Google Drive</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Category */}
                        <td className="p-3.5">
                          <span className="text-[11px] text-slate-300 font-sans font-medium">
                            {getDocTypeLabel(doc.docType)}
                          </span>
                        </td>

                        {/* 3. Document Status Badges: Pending, Verified, Rejected */}
                        <td className="p-3.5">
                          {doc.status === 'VERIFIED' && (
                            <button
                              onClick={() => handleCycleStatus(doc.id)}
                              title="Click to toggle status for testing"
                              className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 text-[10px] font-bold shadow-sm shadow-emerald-500/20 hover:scale-105 transition-transform"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>Verified (অনুমোদিত)</span>
                            </button>
                          )}

                          {doc.status === 'PENDING' && (
                            <button
                              onClick={() => handleCycleStatus(doc.id)}
                              title="Click to toggle status for testing"
                              className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 text-[10px] font-bold shadow-sm shadow-amber-500/20 hover:scale-105 transition-transform"
                            >
                              <Clock className="w-3 h-3 text-amber-400 animate-spin" />
                              <span>Pending (যাচাইাধীন)</span>
                            </button>
                          )}

                          {doc.status === 'REJECTED' && (
                            <div className="space-y-0.5">
                              <button
                                onClick={() => handleCycleStatus(doc.id)}
                                title="Click to toggle status for testing"
                                className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/50 text-[10px] font-bold shadow-sm shadow-rose-500/20 hover:scale-105 transition-transform"
                              >
                                <XCircle className="w-3 h-3 text-rose-400" />
                                <span>Rejected (বাতিল)</span>
                              </button>
                              {doc.rejectionReason && (
                                <div className="text-[9px] text-rose-400/80 font-sans max-w-[150px] truncate">
                                  {doc.rejectionReason}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 4. Timestamp */}
                        <td className="p-3.5 text-[10px] text-slate-400 font-sans">
                          {new Date(doc.uploadDate || Date.now()).toLocaleDateString('bn-BD', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </td>

                        {/* 5. Actions: View + Delete from local state */}
                        <td className="p-3.5 text-right">
                          <div className="inline-flex items-center space-x-2">
                            {/* View link in Google Drive */}
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                              title="Google Drive-এ ফাইল দেখুন"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>

                            {/* Delete Button (removes from local state) */}
                            <button
                              onClick={() => handleDeleteDocument(doc.id, doc.name)}
                              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 hover:border-rose-500/60 text-rose-300 text-[11px] font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer"
                              title="Delete from local state"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Security & Compliance Guarantee Banner */}
      <div className="flex items-start space-x-3 bg-gradient-to-r from-cyan-950/30 via-slate-950/40 to-cyan-950/30 border border-cyan-500/20 p-4 rounded-2xl text-xs text-cyan-300/90 font-sans">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <strong>জিরো-ট্রাস্ট ডেটা সিকিউরিটি:</strong> সংযুক্ত প্রতিটি ফাইল Google Cloud Drive API দ্বারা এনক্রিপ্ট থাকে। আপনি যে কোনো সময় 'Delete' বোতাম চেপে আপনার ফাইল তালিকা থেকে আইটেম মুছে ফেলতে পারেন।
        </div>
      </div>
    </div>
  );
};
