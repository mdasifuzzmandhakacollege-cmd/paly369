/**
 * @file SqlQueryHistorySidebar.tsx
 * @description Persistent Query History Sidebar for LedgerExplorer.
 * Tracks all executed SQL commands during a session, enabling developers to re-run,
 * benchmark, explain, copy, and pin previous queries for rapid debugging.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Play,
  Copy,
  Trash2,
  Bookmark,
  BookmarkCheck,
  Search,
  Zap,
  Filter,
  Check,
  Download,
  Terminal,
  RotateCcw,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Lock,
  Layers,
  Database,
  Sliders,
  X,
  Code2
} from 'lucide-react';
import {
  sqlExecutionService,
  HistoryQueryRecord,
  PRESET_QUERIES,
  PresetQueryTemplate
} from '../services/sqlExecutionService';
import { soundEngine } from '../services/soundEngine';

interface SqlQueryHistorySidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onSelectAndRunQuery: (statement: string) => void;
  onExplainQuery?: (statement: string, table: string) => void;
  currentActiveStatement?: string;
}

export const SqlQueryHistorySidebar: React.FC<SqlQueryHistorySidebarProps> = ({
  isOpen,
  onToggle,
  onSelectAndRunQuery,
  onExplainQuery,
  currentActiveStatement
}) => {
  const [history, setHistory] = useState<HistoryQueryRecord[]>(() =>
    sqlExecutionService.getHistory()
  );
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PINNED' | 'SELECT' | 'MUTATE' | 'EXPLAIN'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reRanId, setReRanId] = useState<string | null>(null);
  const [showPresetsModal, setShowPresetsModal] = useState<boolean>(false);
  const [showConfirmClear, setShowConfirmClear] = useState<boolean>(false);

  // Subscribe to real-time history changes
  useEffect(() => {
    const unsub = sqlExecutionService.onHistoryChange((updatedHistory) => {
      setHistory(updatedHistory);
    });
    return () => unsub();
  }, []);

  // Filtered history list
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const matchSearch =
        searchFilter === '' ||
        item.statement.toLowerCase().includes(searchFilter.toLowerCase()) ||
        item.table.toLowerCase().includes(searchFilter.toLowerCase()) ||
        item.timeLabel.toLowerCase().includes(searchFilter.toLowerCase());

      let matchType = true;
      if (typeFilter === 'PINNED') {
        matchType = !!item.isPinned;
      } else if (typeFilter === 'SELECT') {
        matchType = item.commandType === 'SELECT' || item.commandType === 'SELECT_FOR_UPDATE';
      } else if (typeFilter === 'MUTATE') {
        matchType = item.commandType === 'UPDATE' || item.commandType === 'INSERT' || item.commandType === 'DELETE';
      } else if (typeFilter === 'EXPLAIN') {
        matchType = item.commandType === 'EXPLAIN' || item.statement.toUpperCase().startsWith('EXPLAIN');
      }

      return matchSearch && matchType;
    });
  }, [history, searchFilter, typeFilter]);

  const pinnedCount = useMemo(() => history.filter((h) => h.isPinned).length, [history]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    soundEngine.playClick(800);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleReRun = (item: HistoryQueryRecord) => {
    soundEngine.playClick(500);
    setReRanId(item.id);
    onSelectAndRunQuery(item.statement);
    setTimeout(() => setReRanId(null), 1500);
  };

  const handleExportSql = () => {
    const sqlContent = sqlExecutionService.exportHistoryAsSql();
    const blob = new Blob([sqlContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `playall365_query_history_${Date.now()}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    soundEngine.playWalletCredit();
  };

  const handleExportJson = () => {
    const jsonContent = JSON.stringify(history, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `playall365_query_history_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    soundEngine.playWalletCredit();
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-20 right-4 z-40 bg-slate-900/95 hover:bg-slate-800 text-amber-300 border border-amber-500/40 p-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-2 cursor-pointer transition-all hover:scale-105 group font-mono text-xs"
        title="Open Persistent SQL Query History Sidebar"
      >
        <div className="relative">
          <Clock className="w-5 h-5 text-amber-400 group-hover:rotate-12 transition-transform" />
          {history.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-amber-500 text-slate-950 font-bold rounded-full w-4 h-4 text-[9px] flex items-center justify-center">
              {history.length > 99 ? '99+' : history.length}
            </span>
          )}
        </div>
        <span className="hidden sm:inline font-bold">Query History</span>
      </button>
    );
  }

  return (
    <aside
      className="w-full lg:w-96 shrink-0 bg-slate-950 border-l border-slate-800 flex flex-col h-full shadow-2xl z-30 font-mono transition-all duration-300"
      aria-label="SQL Query History Sidebar"
    >
      {/* Sidebar Header */}
      <div className="p-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-xs tracking-wider uppercase">
                Query History
              </h3>
              <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded text-amber-300 border border-slate-700">
                {history.length}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-sans">
              Persistent developer SQL execution log
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => setShowPresetsModal(true)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-700 hover:border-amber-500/40 text-xs transition-colors cursor-pointer"
            title="Load Preset SQL Query Templates"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Collapse Query History Sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 bg-slate-900/50 border-b border-slate-800 space-y-2 text-xs">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search query statement, table..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
          />
          {searchFilter && (
            <button
              onClick={() => setSearchFilter('')}
              className="absolute right-2 top-2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar text-[10px]">
          {[
            { id: 'ALL', label: 'All', count: history.length },
            { id: 'PINNED', label: '⭐ Pinned', count: pinnedCount },
            { id: 'SELECT', label: 'SELECT', count: history.filter(h => h.commandType.startsWith('SELECT')).length },
            { id: 'MUTATE', label: 'Mutations', count: history.filter(h => ['UPDATE', 'INSERT', 'DELETE'].includes(h.commandType)).length },
            { id: 'EXPLAIN', label: 'Explain', count: history.filter(h => h.commandType === 'EXPLAIN').length }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTypeFilter(tab.id as any)}
              className={`px-2 py-1 rounded-md transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                typeFilter === tab.id
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && <span className="opacity-70">({tab.count})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* History Items Scrollable List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-2 custom-scrollbar">
        {filteredHistory.length === 0 ? (
          <div className="py-12 px-4 text-center text-slate-500 text-xs space-y-3 font-sans">
            <Clock className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
            <p className="font-mono text-slate-400 text-[11px]">
              {searchFilter || typeFilter !== 'ALL'
                ? 'No queries match your active filter.'
                : 'No SQL queries executed yet this session.'}
            </p>
            <button
              onClick={() => setShowPresetsModal(true)}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold transition-all mx-auto cursor-pointer"
            >
              Load Preset Debug Queries
            </button>
          </div>
        ) : (
          filteredHistory.map((item) => {
            const isCurrent = currentActiveStatement?.trim() === item.statement.trim();
            const isReRan = reRanId === item.id;

            return (
              <div
                key={item.id}
                className={`p-2.5 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-amber-950/40 border-amber-500/50 shadow-md ring-1 ring-amber-500/30'
                    : item.isPinned
                    ? 'bg-slate-900/90 border-amber-500/30 hover:border-amber-500/50'
                    : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Meta Header */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
                  <div className="flex items-center space-x-1.5">
                    <span
                      className={`px-1.5 py-0.2 rounded font-bold uppercase ${
                        item.commandType === 'SELECT_FOR_UPDATE'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : item.commandType === 'SELECT'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          : item.commandType === 'UPDATE'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : item.commandType === 'INSERT'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      }`}
                    >
                      {item.commandType}
                    </span>

                    <span className="bg-slate-950 px-1.5 py-0.2 rounded text-slate-300 border border-slate-800">
                      {item.table}
                    </span>

                    {item.commandType === 'SELECT_FOR_UPDATE' && (
                      <span className="text-rose-400 flex items-center gap-0.5 font-bold" title="ACID Row Lock">
                        <Lock className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-1">
                    <span className="text-slate-500 font-mono text-[9px]">
                      {item.timeLabel}
                    </span>
                    <button
                      onClick={() => sqlExecutionService.togglePin(item.id)}
                      className={`p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer ${
                        item.isPinned ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
                      }`}
                      title={item.isPinned ? 'Unpin Query' : 'Pin Query to Top'}
                    >
                      <Bookmark className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => sqlExecutionService.deleteItem(item.id)}
                      className="p-1 rounded hover:bg-rose-950 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Delete from history"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Query Statement Code Box */}
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/90 text-slate-200 text-[11px] font-mono leading-relaxed select-all hover:border-slate-700 transition-colors overflow-x-auto no-scrollbar max-h-24">
                  <code>{item.statement}</code>
                </div>

                {/* Footer Metrics & Actions */}
                <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-800/60 text-[10px]">
                  <div className="flex items-center space-x-2 text-slate-400">
                    <span className="text-emerald-400 font-bold">{item.durationMs.toFixed(2)}ms</span>
                    <span className="text-slate-600">•</span>
                    <span>{item.rowCount} {item.rowCount === 1 ? 'row' : 'rows'}</span>
                    <span className="text-slate-600">•</span>
                    <span className={item.status === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'}>
                      {item.status}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1">
                    {/* Copy Button */}
                    <button
                      onClick={() => handleCopy(item.id, item.statement)}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title="Copy SQL to Clipboard"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>

                    {/* Explain Button */}
                    {onExplainQuery && (
                      <button
                        onClick={() => onExplainQuery(item.statement, item.table)}
                        className="px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors cursor-pointer flex items-center gap-1 font-bold text-[9px]"
                        title="Run EXPLAIN ANALYZE Execution Inspector"
                      >
                        <Zap className="w-2.5 h-2.5 text-amber-400" />
                        <span>Explain</span>
                      </button>
                    )}

                    {/* Re-run Query Button */}
                    <button
                      onClick={() => handleReRun(item)}
                      className={`px-2 py-0.5 rounded font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer text-[10px] ${
                        isReRan
                          ? 'bg-emerald-500 text-slate-950 scale-95'
                          : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 hover:text-black'
                      }`}
                      title="Re-run this SQL query in the Workbench"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>{isReRan ? 'Running...' : 'Re-run'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sidebar Footer Controls */}
      <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-1.5">
          <button
            onClick={handleExportSql}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
            title="Download Query History as .SQL script"
          >
            <Download className="w-3 h-3 text-amber-400" />
            <span>.SQL</span>
          </button>
          <button
            onClick={handleExportJson}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
            title="Download Query History as .JSON"
          >
            <Download className="w-3 h-3 text-blue-400" />
            <span>.JSON</span>
          </button>
        </div>

        {history.length > 0 && (
          <div>
            {showConfirmClear ? (
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => {
                    sqlExecutionService.clearHistory();
                    setShowConfirmClear(false);
                    soundEngine.playClick(300);
                  }}
                  className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold cursor-pointer transition-colors"
                >
                  Confirm Clear
                </button>
                <button
                  onClick={() => setShowConfirmClear(false)}
                  className="px-1.5 py-1 bg-slate-800 text-slate-400 hover:text-white rounded text-[10px] cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirmClear(true)}
                className="text-slate-500 hover:text-rose-400 p-1.5 rounded hover:bg-slate-800 transition-colors text-[10px] flex items-center gap-1 cursor-pointer"
                title="Clear unpinned query history"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Preset Query Modal Picker */}
      {showPresetsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Preset Debugging SQL Queries
                  </h3>
                  <p className="text-[11px] text-slate-400 font-sans">
                    Select a ready-to-run query template for verification
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPresetsModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2.5 custom-scrollbar pr-1">
              {PRESET_QUERIES.map((preset) => (
                <div
                  key={preset.id}
                  className="p-3 bg-slate-950 rounded-xl border border-slate-800 hover:border-amber-500/40 transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 border border-slate-800 text-[10px] font-bold">
                        {preset.category}
                      </span>
                      <h4 className="text-xs font-bold text-white">{preset.title}</h4>
                    </div>
                    <button
                      onClick={() => {
                        setShowPresetsModal(false);
                        onSelectAndRunQuery(preset.statement);
                        soundEngine.playClick(600);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Run Query</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-400 font-sans">
                    {preset.description}
                  </p>

                  <div className="bg-slate-900 p-2 rounded-lg border border-slate-800 text-[10px] text-slate-300 font-mono select-all overflow-x-auto no-scrollbar">
                    <code>{preset.statement}</code>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowPresetsModal(false)}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
