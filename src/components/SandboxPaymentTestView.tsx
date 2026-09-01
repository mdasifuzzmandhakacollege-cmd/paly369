/**
 * @file SandboxPaymentTestView.tsx
 * @description Non-Production Developer Sandbox Payment Test Journey (PLAY369 Task 6.2C).
 * 
 * STRICT BOUNDARIES & SAFETY INVARIANTS:
 * 1. ONLY accessible in development/test environment (import.meta.env.DEV === true).
 * 2. Entire screen clearly labeled: "SANDBOX / TEST ONLY - NO REAL MONEY".
 * 3. Exact decimal-string preservation (NO Number(), NO parseFloat(), NO toFixed()).
 * 4. Zero external network calls (NO StarPay live API, NO real API keys).
 * 5. Zero wallet settlement & zero WalletLedgerService mutations.
 * 6. COMPLETED verification prominently shows: "SANDBOX VERIFIED - NO WALLET SETTLEMENT".
 * 7. Current test session-only status history (zero fake database transactions).
 */

import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  Copy,
  Check,
  RotateCcw,
  Terminal,
  Send,
  Search,
  Lock,
  Layers,
  AlertCircle,
  HelpCircle,
  Trash2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWalletGame } from '../contexts/WalletGameContext';

export interface SandboxSessionLog {
  id: string;
  action: 'CREATE' | 'VERIFY';
  txId: string;
  amount: string;
  status: 'CREATED' | 'PENDING' | 'COMPLETED' | 'ERROR' | 'UNKNOWN';
  code?: string;
  settlementBlocked?: boolean;
  timestamp: string;
  details: string;
}

export const SandboxPaymentTestView: React.FC = () => {
  // Production Fail-Close Guard: Never render UI in production builds
  if (!import.meta.env.DEV) {
    return null;
  }

  const { user: firebaseUser, token: authToken } = useAuth();
  const { currentUser, currentWallet, currency } = useWalletGame();

  // Create Form State - Strictly string values, never converted to JS numbers
  const [customerName, setCustomerName] = useState<string>(currentUser?.username || 'Sandbox Tester');
  const [customerEmail, setCustomerEmail] = useState<string>(currentUser?.email || 'tester@sandbox.local');
  const [amountStr, setAmountStr] = useState<string>('1500.0000');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [createResult, setCreateResult] = useState<any>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  // Verify Form State
  const [verifyTxId, setVerifyTxId] = useState<string>('');
  const [expectedAmountStr, setExpectedAmountStr] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Test Session Status History (In-memory, session only)
  const [sessionLogs, setSessionLogs] = useState<SandboxSessionLog[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Copy helper
  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Get Auth Token for sandbox API requests
  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    let token = authToken;
    if (!token && firebaseUser) {
      try {
        token = await firebaseUser.getIdToken();
      } catch (err) {
        console.warn('[SandboxUI] Failed to refresh Firebase token:', err);
      }
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  };

  // --------------------------------------------------------------------------
  // CREATE PAYMENT FLOW (POST /api/sandbox/payment/create)
  // --------------------------------------------------------------------------
  const handleCreatePayment = async (overrideAmount?: string) => {
    setIsCreating(true);
    setCreateError(null);
    setCreateResult(null);

    const targetAmount = overrideAmount !== undefined ? overrideAmount : amountStr;

    try {
      const headers = await getAuthHeaders();
      const payload = {
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        amount: targetAmount.trim(), // Exact decimal string
        metadata: {
          journey: 'TASK_6_2C_E2E_TEST',
          timestamp: new Date().toISOString()
        }
      };

      const res = await fetch('/api/sandbox/payment/create', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errMsg = data.error || data.message || `HTTP ${res.status}: Failed to create sandbox payment`;
        setCreateError(errMsg);
        
        // Add error log to session history
        const newLog: SandboxSessionLog = {
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          action: 'CREATE',
          txId: 'N/A',
          amount: targetAmount,
          status: 'ERROR',
          code: data.code || 'HTTP_ERROR',
          settlementBlocked: true,
          timestamp: new Date().toLocaleTimeString(),
          details: errMsg
        };
        setSessionLogs((prev) => [newLog, ...prev]);
        return;
      }

      setCreateResult(data);
      // Auto-populate verify field for smooth developer journey
      if (data.transactionId) {
        setVerifyTxId(data.transactionId);
        setExpectedAmountStr(data.amount || targetAmount);
      }

      // Add success log to session history
      const newLog: SandboxSessionLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        action: 'CREATE',
        txId: data.transactionId,
        amount: data.amount,
        status: 'CREATED',
        code: 'SANDBOX_CREATED',
        settlementBlocked: true,
        timestamp: new Date().toLocaleTimeString(),
        details: `Sandbox payment created (isSandbox: true, URL generated)`
      };
      setSessionLogs((prev) => [newLog, ...prev]);
    } catch (err: any) {
      const msg = err.message || 'Network error executing sandbox create';
      setCreateError(msg);
    } finally {
      setIsCreating(false);
    }
  };

  // --------------------------------------------------------------------------
  // VERIFY PAYMENT FLOW (POST /api/sandbox/payment/verify)
  // --------------------------------------------------------------------------
  const handleVerifyPayment = async (overrideTxId?: string, overrideExpected?: string) => {
    setIsVerifying(true);
    setVerifyError(null);
    setVerifyResult(null);

    const targetTxId = overrideTxId !== undefined ? overrideTxId : verifyTxId;
    const targetExpected = overrideExpected !== undefined ? overrideExpected : expectedAmountStr;

    if (!targetTxId.trim()) {
      setVerifyError('Transaction ID is required to verify sandbox payment.');
      setIsVerifying(false);
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const payload: { transactionId: string; expectedAmount?: string } = {
        transactionId: targetTxId.trim()
      };
      if (targetExpected && targetExpected.trim()) {
        payload.expectedAmount = targetExpected.trim();
      }

      const res = await fetch('/api/sandbox/payment/verify', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok && data.status !== 'ERROR') {
        const errMsg = data.error || data.message || `HTTP ${res.status}: Failed to verify sandbox payment`;
        setVerifyError(errMsg);

        const newLog: SandboxSessionLog = {
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          action: 'VERIFY',
          txId: targetTxId,
          amount: targetExpected || 'N/A',
          status: 'ERROR',
          code: data.code || 'HTTP_ERROR',
          settlementBlocked: true,
          timestamp: new Date().toLocaleTimeString(),
          details: errMsg
        };
        setSessionLogs((prev) => [newLog, ...prev]);
        return;
      }

      setVerifyResult(data);

      // Add verify result log to session history
      const newLog: SandboxSessionLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        action: 'VERIFY',
        txId: data.transactionId || targetTxId,
        amount: data.amount || targetExpected || 'N/A',
        status: data.status || 'UNKNOWN',
        code: data.code,
        settlementBlocked: data.settlementBlocked ?? true,
        timestamp: new Date().toLocaleTimeString(),
        details: data.message || `Status: ${data.status}, Code: ${data.code}`
      };
      setSessionLogs((prev) => [newLog, ...prev]);
    } catch (err: any) {
      const msg = err.message || 'Network error executing sandbox verify';
      setVerifyError(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div id="sandbox-payment-test-view" className="space-y-6 max-w-6xl mx-auto pb-12 font-sans">
      
      {/* -------------------------------------------------------------------- */}
      {/* 1. MANDATORY SAFETY BANNER & SCREEN IDENTIFICATION                   */}
      {/* -------------------------------------------------------------------- */}
      <div className="bg-amber-950/70 border-2 border-amber-500/80 rounded-2xl p-5 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-amber-500/20 rounded-xl border border-amber-500/50 text-amber-400">
              <ShieldAlert className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-xs font-black tracking-wider uppercase">
                  SANDBOX / TEST ONLY
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-black tracking-wider uppercase">
                  NO REAL MONEY
                </span>
              </div>
              <h1 className="text-xl font-black text-white mt-1">
                PLAY369 Sandbox Payment End-to-End Test Journey (Task 6.2C)
              </h1>
              <p className="text-xs text-amber-200/80 font-mono mt-0.5">
                Developer Non-Production Test Suite • Zero Live Network Calls • Zero WalletLedgerService Settlement
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end text-xs font-mono text-slate-300 bg-slate-900/80 p-3 rounded-xl border border-slate-800 shrink-0">
            <div className="text-slate-400">Current User Wallet (Read-Only):</div>
            <div className="text-emerald-400 font-bold text-sm">
              {currentWallet?.real_balance || '0.0000'} {currency}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Authoritative balance will NEVER mutate
            </div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 2. QUICK FIXTURE PRESETS FOR INSTANT VERIFICATION                   */}
      {/* -------------------------------------------------------------------- */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold text-cyan-400 flex items-center space-x-1.5">
            <Zap className="w-4 h-4" />
            <span>Fast Preset Fixture Triggers:</span>
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            Exercise all contract fixtures without manual typing
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
          <button
            id="sandbox-preset-pending"
            onClick={() => {
              setVerifyTxId('SBX_TX_PENDING_002');
              setExpectedAmountStr('2500.0000');
              handleVerifyPayment('SBX_TX_PENDING_002', '2500.0000');
            }}
            className="p-2.5 bg-slate-800/80 hover:bg-slate-800 border border-amber-500/40 hover:border-amber-400 rounded-xl text-amber-300 text-left transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="font-bold flex items-center justify-between">
              <span>1. Pending Fixture</span>
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-[10px] text-slate-400 mt-1">SBX_TX_PENDING_002</div>
          </button>

          <button
            id="sandbox-preset-completed"
            onClick={() => {
              setVerifyTxId('SBX_TX_COMPLETED_003');
              setExpectedAmountStr('1500.0000');
              handleVerifyPayment('SBX_TX_COMPLETED_003', '1500.0000');
            }}
            className="p-2.5 bg-slate-800/80 hover:bg-slate-800 border border-emerald-500/40 hover:border-emerald-400 rounded-xl text-emerald-300 text-left transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="font-bold flex items-center justify-between">
              <span>2. Completed Fixture</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-[10px] text-slate-400 mt-1">SBX_TX_COMPLETED_003</div>
          </button>

          <button
            id="sandbox-preset-error"
            onClick={() => {
              setVerifyTxId('SBX_TX_ERROR_004');
              setExpectedAmountStr('5000.0000');
              handleVerifyPayment('SBX_TX_ERROR_004', '5000.0000');
            }}
            className="p-2.5 bg-slate-800/80 hover:bg-slate-800 border border-rose-500/40 hover:border-rose-400 rounded-xl text-rose-300 text-left transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="font-bold flex items-center justify-between">
              <span>3. Error Fixture</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-[10px] text-slate-400 mt-1">SBX_TX_ERROR_004</div>
          </button>

          <button
            id="sandbox-preset-mismatch"
            onClick={() => {
              setVerifyTxId('SBX_TX_MISMATCH_006');
              setExpectedAmountStr('1000.0000'); // Fixture has 3000.0000
              handleVerifyPayment('SBX_TX_MISMATCH_006', '1000.0000');
            }}
            className="p-2.5 bg-slate-800/80 hover:bg-slate-800 border border-purple-500/40 hover:border-purple-400 rounded-xl text-purple-300 text-left transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="font-bold flex items-center justify-between">
              <span>4. Amount Mismatch</span>
              <AlertCircle className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Expected 1000 vs 3000</div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* ------------------------------------------------------------------ */}
        {/* 3. STEP A: CREATE SANDBOX PAYMENT                                 */}
        {/* ------------------------------------------------------------------ */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 font-black text-xs flex items-center justify-center">
                  A
                </span>
                <h2 className="text-sm font-black text-white uppercase tracking-wider">
                  Create Sandbox Payment
                </h2>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                POST /api/sandbox/payment/create
              </span>
            </div>

            {/* Inputs */}
            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Customer Name:</label>
                <input
                  id="sandbox-input-customer-name"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. Rahim Uddin"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Customer Email:</label>
                <input
                  id="sandbox-input-customer-email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. rahim@example.com"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400 text-[11px]">
                    Exact Decimal-String Amount (Scale-4):
                  </label>
                  <span className="text-[10px] text-amber-400">Strict string preservation</span>
                </div>
                <input
                  id="sandbox-input-amount"
                  type="text"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-emerald-300 font-bold focus:outline-none focus:border-cyan-500 text-sm"
                  placeholder="e.g. 1500.0000 or 0.0516"
                />
                
                {/* Presets */}
                <div className="flex items-center space-x-1.5 mt-2">
                  <span className="text-[10px] text-slate-500">Presets:</span>
                  {['0.0516', '100.0000', '1500.0000', '5000.0000'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmountStr(preset)}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700 cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Error Display */}
            {createError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-mono flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <div>
                  <div className="font-bold">Create Request Failed:</div>
                  <div className="text-[11px] text-rose-200/80">{createError}</div>
                </div>
              </div>
            )}

            {/* Success Created State Display */}
            {createResult && (
              <div className="p-3.5 bg-slate-950 border border-cyan-500/40 rounded-xl space-y-2.5 font-mono text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="font-bold text-cyan-400 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Payment Intent Created</span>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase">
                    STATUS: {createResult.status || 'CREATED'}
                  </span>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Transaction ID:</span>
                    <div className="flex items-center space-x-1">
                      <span className="text-white font-bold">{createResult.transactionId}</span>
                      <button
                        onClick={() => copyToClipboard(createResult.transactionId, 'createdTx')}
                        className="p-1 text-slate-400 hover:text-white"
                        title="Copy TxID"
                      >
                        {copiedKey === 'createdTx' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Exact Amount:</span>
                    <span className="text-emerald-400 font-bold">{createResult.amount} {createResult.currency}</span>
                  </div>

                  <div className="space-y-1 pt-1">
                    <span className="text-slate-400">Sandbox Payment URL (Safe Mock):</span>
                    <div className="p-2 bg-slate-900 rounded border border-slate-800 text-[10px] text-cyan-300 break-all flex items-center justify-between gap-2">
                      <span>{createResult.paymentUrl}</span>
                      <button
                        onClick={() => copyToClipboard(createResult.paymentUrl, 'url')}
                        className="p-1 text-slate-400 hover:text-white shrink-0"
                        title="Copy URL"
                      >
                        {copiedKey === 'url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="text-[9px] text-amber-400/90 italic">
                      🛡️ Notice: Auto-opening external URLs is blocked for sandbox safety.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setVerifyTxId(createResult.transactionId);
                    setExpectedAmountStr(createResult.amount);
                    handleVerifyPayment(createResult.transactionId, createResult.amount);
                  }}
                  className="w-full mt-2 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold text-xs flex items-center justify-center space-x-1.5 cursor-pointer transition-all"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Verify This Transaction Now →</span>
                </button>
              </div>
            )}
          </div>

          <button
            id="sandbox-btn-create-payment"
            type="button"
            disabled={isCreating}
            onClick={() => handleCreatePayment()}
            className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg mt-4"
          >
            {isCreating ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                <span>Creating Sandbox Intent...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Execute Create Sandbox Payment</span>
              </>
            )}
          </button>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* 4. STEP B: VERIFY SANDBOX PAYMENT                                 */}
        {/* ------------------------------------------------------------------ */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-black text-xs flex items-center justify-center">
                  B
                </span>
                <h2 className="text-sm font-black text-white uppercase tracking-wider">
                  Verify Sandbox Transaction
                </h2>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                POST /api/sandbox/payment/verify
              </span>
            </div>

            {/* Verify Inputs */}
            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">
                  Sandbox Transaction ID (or Fixture):
                </label>
                <input
                  id="sandbox-input-verify-txid"
                  type="text"
                  value={verifyTxId}
                  onChange={(e) => setVerifyTxId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-cyan-300 font-bold focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. SBX_TX_COMPLETED_003 or created TxID"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">
                  Expected Amount (Optional String for mismatch check):
                </label>
                <input
                  id="sandbox-input-expected-amount"
                  type="text"
                  value={expectedAmountStr}
                  onChange={(e) => setExpectedAmountStr(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. 1500.0000"
                />
              </div>
            </div>

            {/* Verify Error */}
            {verifyError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-mono flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <div>
                  <div className="font-bold">Verification Error:</div>
                  <div className="text-[11px] text-rose-200/80">{verifyError}</div>
                </div>
              </div>
            )}

            {/* Verify Outcome Card */}
            {verifyResult && (
              <div className="p-4 bg-slate-950 border border-slate-700 rounded-xl space-y-3 font-mono text-xs">
                {/* Status Badges */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Outcome Status:</span>
                  <div className="flex items-center space-x-2">
                    {verifyResult.status === 'COMPLETED' && (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 font-black text-xs flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>COMPLETED</span>
                      </span>
                    )}
                    {verifyResult.status === 'PENDING' && (
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 font-black text-xs flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>PENDING</span>
                      </span>
                    )}
                    {verifyResult.status === 'ERROR' && (
                      <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/50 font-black text-xs flex items-center space-x-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        <span>ERROR</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* MANDATORY TASK 6.2C REQUIREMENT: Prominently show SANDBOX VERIFIED & NO WALLET SETTLEMENT */}
                {verifyResult.status === 'COMPLETED' && (
                  <div className="p-3 bg-emerald-950/70 border-2 border-emerald-500/80 rounded-xl space-y-1 text-center">
                    <div className="text-sm font-black text-emerald-300 tracking-wider">
                      ✅ SANDBOX VERIFIED
                    </div>
                    <div className="text-xs font-black text-amber-400 tracking-wider">
                      🛡️ NO WALLET SETTLEMENT
                    </div>
                    <div className="text-[10px] text-emerald-200/70 pt-1">
                      Settlement Blocked: <span className="font-bold text-white">TRUE</span> • Wallet balance remains 100% unmutated
                    </div>
                  </div>
                )}

                {/* Details Breakdown */}
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Response Code:</span>
                    <span className="text-cyan-300 font-bold">{verifyResult.code || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Transaction ID:</span>
                    <span className="text-white">{verifyResult.transactionId}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Verified Amount:</span>
                    <span className="text-emerald-400 font-bold">{verifyResult.amount || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Settlement Blocked:</span>
                    <span className="text-amber-400 font-bold">
                      {verifyResult.settlementBlocked ? 'true (Zero Wallet Impact)' : 'false'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            id="sandbox-btn-verify-payment"
            type="button"
            disabled={isVerifying}
            onClick={() => handleVerifyPayment()}
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg mt-4"
          >
            {isVerifying ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                <span>Verifying Sandbox Tx...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Execute Verify Sandbox Transaction</span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 5. SESSION-ONLY TEST STATUS AUDIT LOG                                */}
      {/* -------------------------------------------------------------------- */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              Test Session Activity Log (Current Session Only)
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              {sessionLogs.length} events
            </span>
          </div>

          {sessionLogs.length > 0 && (
            <button
              onClick={() => setSessionLogs([])}
              className="text-xs text-slate-400 hover:text-rose-400 flex items-center space-x-1 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Session Log</span>
            </button>
          )}
        </div>

        {sessionLogs.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs font-mono">
            No sandbox payment actions executed in this session yet.
            <br />
            Create or verify a sandbox payment above to view real-time test telemetry.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                  <th className="py-2 px-3">Time</th>
                  <th className="py-2 px-3">Action</th>
                  <th className="py-2 px-3">Transaction ID</th>
                  <th className="py-2 px-3">Amount</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Code</th>
                  <th className="py-2 px-3">Settlement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {sessionLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400 text-[11px] whitespace-nowrap">{log.timestamp}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          log.action === 'CREATE'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-white font-bold text-[11px]">{log.txId}</td>
                    <td className="py-2.5 px-3 text-emerald-400 font-bold">{log.amount}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                          log.status === 'COMPLETED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : log.status === 'CREATED'
                            ? 'bg-cyan-500/20 text-cyan-300'
                            : log.status === 'PENDING'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-cyan-300 text-[10px]">{log.code || 'N/A'}</td>
                    <td className="py-2.5 px-3">
                      <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30 whitespace-nowrap">
                        BLOCKED (0 Mutations)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
