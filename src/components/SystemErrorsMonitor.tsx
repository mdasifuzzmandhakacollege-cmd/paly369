/**
 * @file SystemErrorsMonitor.tsx
 * @description Real-Time System Error & API Stack Trace Monitor component.
 * Subscribes to the Firestore 'SystemErrors' collection to display live captured errors,
 * stack traces, request payloads, and allows developers to inspect, resolve, or test failures.
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Filter,
  Flame,
  Layers,
  RefreshCw,
  Search,
  ShieldAlert,
  Terminal,
  Trash2,
  Zap,
  Check,
  X,
  ChevronRight,
  Code
} from 'lucide-react';
import { SystemErrorRecord } from '../services/errorReportingService';
import { soundEngine } from '../services/soundEngine';

interface SystemErrorsMonitorProps {
  errors: SystemErrorRecord[];
  onTriggerTestError: () => Promise<SystemErrorRecord | null>;
  onResolveError: (errorId: string) => Promise<void>;
  onMarkInvestigating: (errorId: string) => Promise<void>;
  onClearLocal: () => void;
}

export const SystemErrorsMonitor: React.FC<SystemErrorsMonitorProps> = ({
  errors,
  onTriggerTestError,
  onResolveError,
  onMarkInvestigating,
  onClearLocal
}) => {
  const [selectedError, setSelectedError] = useState<SystemErrorRecord | null>(null);
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NEW' | 'INVESTIGATING' | 'RESOLVED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'stack' | 'context' | 'headers'>('stack');

  const filteredErrors = errors.filter((err) => {
    const matchSeverity = severityFilter === 'ALL' || err.severity === severityFilter;
    const matchStatus = statusFilter === 'ALL' || err.status === statusFilter;
    const matchSearch =
      searchQuery === '' ||
      err.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      err.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (err.endpoint && err.endpoint.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (err.stack && err.stack.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchSeverity && matchStatus && matchSearch;
  });

  const criticalCount = errors.filter((e) => e.severity === 'CRITICAL' && e.status !== 'RESOLVED').length;
  const newCount = errors.filter((e) => e.status === 'NEW').length;

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    soundEngine.playClick(800);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleTriggerTest = async () => {
    setIsSimulating(true);
    soundEngine.playClick(400);
    try {
      const newErr = await onTriggerTestError();
      if (newErr) {
        setSelectedError(newErr);
      }
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Top Banner / HUD */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Firestore 'SystemErrors' Telemetry Stream
              </h2>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full font-bold">
                {newCount} New / {criticalCount} Critical
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans mt-0.5">
              Automated error hook captures API failure stack traces &amp; persists them directly to Cloud Firestore.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleTriggerTest}
            disabled={isSimulating}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-900/30 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
            <span>{isSimulating ? 'Pushing Error...' : 'Simulate API Failure'}</span>
          </button>

          <button
            onClick={() => {
              onClearLocal();
              soundEngine.playClick(300);
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-300 border border-slate-700 text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Local</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left List + Right Detailed Stack Trace Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Filterable Error List */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[620px] shadow-xl">
          {/* Filters Bar */}
          <div className="p-3 bg-slate-950/80 border-b border-slate-800 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search error name, endpoint, stack..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/60"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-1 overflow-x-auto text-[10px] no-scrollbar">
              <div className="flex items-center space-x-1">
                {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                      severityFilter === sev
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 font-bold'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>

              <div className="flex items-center space-x-1">
                {(['ALL', 'NEW', 'INVESTIGATING', 'RESOLVED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                      statusFilter === st
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-2 custom-scrollbar">
            {filteredErrors.length === 0 ? (
              <div className="py-16 text-center text-slate-500 space-y-2">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/60" />
                <p className="text-xs">No errors matching criteria.</p>
                <p className="text-[10px] text-slate-600 font-sans">
                  Click 'Simulate API Failure' above to trigger and capture an error.
                </p>
              </div>
            ) : (
              filteredErrors.map((err) => {
                const isSelected = selectedError?.id === err.id;
                return (
                  <div
                    key={err.id}
                    onClick={() => {
                      setSelectedError(err);
                      soundEngine.playClick(700);
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-rose-950/40 border-rose-500/60 shadow-md ring-1 ring-rose-500/30'
                        : err.status === 'RESOLVED'
                        ? 'bg-slate-950/40 border-slate-800/80 opacity-60 hover:opacity-100'
                        : 'bg-slate-950/80 hover:bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`px-1.5 py-0.2 rounded font-bold uppercase ${
                            err.severity === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : err.severity === 'HIGH'
                              ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          }`}
                        >
                          {err.severity}
                        </span>

                        {err.statusCode ? (
                          <span className="bg-slate-900 px-1.5 py-0.2 rounded text-amber-300 border border-slate-800 font-bold">
                            HTTP {err.statusCode}
                          </span>
                        ) : null}

                        <span className="bg-slate-900 px-1.5 py-0.2 rounded text-slate-300 border border-slate-800">
                          {err.source}
                        </span>
                      </div>

                      <span className="text-slate-500 text-[9px]">{err.timeLabel}</span>
                    </div>

                    <h4 className="text-xs font-bold text-white truncate">{err.name}</h4>
                    <p className="text-[11px] text-rose-300/90 truncate font-mono mt-0.5">
                      {err.message}
                    </p>

                    {err.endpoint && (
                      <div className="mt-1.5 text-[10px] text-slate-400 bg-slate-900/90 px-2 py-0.5 rounded border border-slate-800 truncate flex items-center justify-between">
                        <span className="truncate">{err.method} {err.endpoint}</span>
                        <span
                          className={`ml-2 text-[9px] font-bold ${
                            err.status === 'RESOLVED'
                              ? 'text-emerald-400'
                              : err.status === 'INVESTIGATING'
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {err.status}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Detailed Stack Trace & Diagnostic Inspector */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[620px] shadow-xl">
          {selectedError ? (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      {selectedError.severity}
                    </span>
                    <h3 className="text-sm font-bold text-white">{selectedError.name}</h3>
                  </div>
                  <p className="text-xs text-rose-300 font-mono">{selectedError.message}</p>
                </div>

                <div className="flex items-center space-x-1.5">
                  {selectedError.status !== 'RESOLVED' ? (
                    <>
                      <button
                        onClick={() => onMarkInvestigating(selectedError.id)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold cursor-pointer transition-colors"
                      >
                        Investigate
                      </button>
                      <button
                        onClick={() => onResolveError(selectedError.id)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1 shadow-sm"
                      >
                        <Check className="w-3 h-3" />
                        <span>Resolve</span>
                      </button>
                    </>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Resolved</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Inspector Meta Bar */}
              <div className="p-3 bg-slate-900 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">ENDPOINT / ROUTE</span>
                  <span className="text-cyan-300 font-bold truncate block">{selectedError.endpoint || 'N/A'}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">HTTP STATUS</span>
                  <span className="text-amber-400 font-bold block">{selectedError.statusCode || 'N/A'}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">CAPTURED TIME</span>
                  <span className="text-slate-300 block">{selectedError.timeLabel}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">USER ID</span>
                  <span className="text-purple-300 font-bold truncate block">{selectedError.userId || 'anonymous'}</span>
                </div>
              </div>

              {/* Subtabs for Stack / Context / Raw */}
              <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setActiveTab('stack')}
                    className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      activeTab === 'stack'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Stack Trace
                  </button>
                  <button
                    onClick={() => setActiveTab('context')}
                    className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      activeTab === 'context'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Context &amp; Payload
                  </button>
                  <button
                    onClick={() => setActiveTab('headers')}
                    className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      activeTab === 'headers'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Client Diagnostics
                  </button>
                </div>

                <button
                  onClick={() => handleCopy(selectedError.id, selectedError.stack || selectedError.message)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 cursor-pointer transition-colors"
                  title="Copy Stack Trace to Clipboard"
                >
                  {copiedId === selectedError.id ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiedId === selectedError.id ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Code Box */}
              <div className="flex-1 p-4 overflow-y-auto custom-scrollbar bg-slate-950">
                {activeTab === 'stack' && (
                  <pre className="text-rose-300 text-[11px] leading-relaxed select-all whitespace-pre-wrap font-mono">
                    {selectedError.stack || 'No detailed stack trace captured for this error.'}
                  </pre>
                )}

                {activeTab === 'context' && (
                  <pre className="text-cyan-300 text-[11px] leading-relaxed select-all font-mono">
                    {JSON.stringify(selectedError.context || {}, null, 2)}
                  </pre>
                )}

                {activeTab === 'headers' && (
                  <div className="space-y-3 text-slate-300 text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[10px]">User Agent</span>
                      <p className="bg-slate-900 p-2 rounded border border-slate-800 text-slate-300">{selectedError.userAgent || 'Unknown'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Origin URL</span>
                      <p className="bg-slate-900 p-2 rounded border border-slate-800 text-slate-300">{selectedError.url || 'Unknown'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Firestore Error ID</span>
                      <p className="bg-slate-900 p-2 rounded border border-slate-800 text-amber-300">{selectedError.id}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-3 p-8">
              <Bug className="w-10 h-10 text-slate-600 opacity-60" />
              <p className="text-xs">Select an error from the stream on the left to inspect stack trace.</p>
              <button
                onClick={handleTriggerTest}
                className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold cursor-pointer"
              >
                Trigger Test Failure
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
