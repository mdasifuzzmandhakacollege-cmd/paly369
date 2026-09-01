/**
 * @file ExplainPlanModal.tsx
 * @description Interactive PostgreSQL EXPLAIN (ANALYZE, BUFFERS, COSTS, VERBOSE, WAL) Execution Plan Modal.
 * Visualizes query execution trees, operator costs, shared buffer cache hit rates, tuple-level locking overhead,
 * and actionable architectural database indexing advice for seamless iGaming ledger operations.
 */

import React, { useState } from 'react';
import {
  X,
  Database,
  Cpu,
  Zap,
  Activity,
  Layers,
  CheckCircle2,
  Clock,
  HardDrive,
  Lock,
  Flame,
  FileCode,
  Copy,
  Check,
  RefreshCw,
  Sliders,
  Sparkles,
  AlertTriangle,
  Info,
  ShieldCheck,
  ArrowRight,
  TrendingDown,
  CornerDownRight,
  Code
} from 'lucide-react';
import {
  ExplainAnalyzeResult,
  ExplainPlanNode,
  ExplainAnalyzeOptions,
  generateExplainAnalyze
} from '../services/explainAnalyzeEngine';
import { SqlQueryLog } from '../services/simulatedWalletEngine';

interface ExplainPlanModalProps {
  query: SqlQueryLog | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ExplainPlanModal: React.FC<ExplainPlanModalProps> = ({
  query,
  isOpen,
  onClose
}) => {
  if (!isOpen || !query) return null;

  const [options, setOptions] = useState<ExplainAnalyzeOptions>({
    analyze: true,
    buffers: true,
    costs: true,
    verbose: true,
    timing: true,
    wal: true
  });

  const [activeView, setActiveView] = useState<'visual' | 'text' | 'json' | 'advice'>('visual');
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [copiedPlan, setCopiedPlan] = useState<boolean>(false);
  const [isReevaluating, setIsReevaluating] = useState<boolean>(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Compute live plan from query and options
  const explainResult: ExplainAnalyzeResult = React.useMemo(() => {
    return generateExplainAnalyze(query, options);
  }, [query, options, isReevaluating]);

  const handleCopySql = () => {
    navigator.clipboard.writeText(query.statement);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleCopyPlan = () => {
    const textToCopy =
      activeView === 'json'
        ? JSON.stringify(explainResult.formattedJsonPlan, null, 2)
        : explainResult.formattedTextPlan;
    navigator.clipboard.writeText(textToCopy);
    setCopiedPlan(true);
    setTimeout(() => setCopiedPlan(false), 2000);
  };

  const handleReRunAnalyze = () => {
    setIsReevaluating(true);
    setTimeout(() => {
      setIsReevaluating(false);
    }, 250);
  };

  const toggleOption = (key: keyof ExplainAnalyzeOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in font-sans">
      <div className="bg-slate-950 border border-amber-500/40 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-mono text-slate-200">
        {/* Top Header */}
        <div className="p-4 sm:p-5 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  PostgreSQL EXPLAIN ANALYZE Plan Inspector
                </h2>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    query.commandType === 'SELECT'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : query.commandType === 'UPDATE'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : query.commandType === 'INSERT'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  }`}
                >
                  {query.commandType}
                </span>
                {query.lockLevel && (
                  <span className="hidden sm:inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 items-center gap-1">
                    <Lock className="w-2.5 h-2.5" />
                    {query.lockLevel}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                Query execution path, cost modeling, index scans &amp; buffer cache breakdown for table <code className="text-amber-300 font-mono font-bold">`{explainResult.table}`</code>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleReRunAnalyze}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Re-run EXPLAIN ANALYZE benchmark"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReevaluating ? 'animate-spin text-amber-400' : ''}`} />
              <span className="hidden sm:inline">Benchmark</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Query Statement Bar */}
        <div className="px-4 py-3 bg-slate-900/60 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex-1 overflow-x-auto no-scrollbar font-mono text-emerald-300 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
            <code>{query.statement}</code>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleCopySql}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSql ? 'Copied SQL' : 'Copy SQL'}</span>
            </button>
            <button
              onClick={handleCopyPlan}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {copiedPlan ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Code className="w-3.5 h-3.5" />}
              <span>{copiedPlan ? 'Copied Plan' : 'Copy Plan'}</span>
            </button>
          </div>
        </div>

        {/* Top Metric Cards Bar */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          {/* Execution Time */}
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-[10px] text-slate-400 flex items-center gap-1 mb-1">
              <Clock className="w-3 h-3 text-amber-400" />
              <span>Execution Time</span>
            </div>
            <div className="text-base font-bold text-white font-mono">
              {explainResult.executionTimeMs.toFixed(3)}{' '}
              <span className="text-[10px] text-slate-500">ms</span>
            </div>
            <div className="text-[9px] text-slate-400">
              Planning: {explainResult.planningTimeMs.toFixed(3)} ms
            </div>
          </div>

          {/* Buffer Cache Hit Ratio */}
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-[10px] text-slate-400 flex items-center gap-1 mb-1">
              <HardDrive className="w-3 h-3 text-emerald-400" />
              <span>Buffer Hit Ratio</span>
            </div>
            <div className="text-base font-bold text-emerald-400 font-mono">
              {explainResult.bufferStats.hitRatioPercent}%
            </div>
            <div className="text-[9px] text-slate-400">
              {explainResult.bufferStats.sharedHit} hits / {explainResult.bufferStats.sharedRead} reads
            </div>
          </div>

          {/* Estimated Optimizer Cost */}
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-[10px] text-slate-400 flex items-center gap-1 mb-1">
              <Activity className="w-3 h-3 text-cyan-400" />
              <span>Optimizer Cost</span>
            </div>
            <div className="text-base font-bold text-cyan-300 font-mono">
              {explainResult.costStartup.toFixed(2)}..{explainResult.costTotal.toFixed(2)}
            </div>
            <div className="text-[9px] text-slate-400">
              Units: pg_cost points
            </div>
          </div>

          {/* SLA Safety Margin */}
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-[10px] text-slate-400 flex items-center gap-1 mb-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>4s SLA Headroom</span>
            </div>
            <div className="text-base font-bold text-emerald-400 font-mono">
              {explainResult.architecturalAnalysis.slaSafetyMargin}
            </div>
            <div className="text-[9px] text-slate-400">
              {(4000 - explainResult.totalTimeMs).toFixed(1)} ms margin
            </div>
          </div>

          {/* Row Lock Overhead */}
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-[10px] text-slate-400 flex items-center gap-1 mb-1">
              <Lock className="w-3 h-3 text-rose-400" />
              <span>Locking Mode</span>
            </div>
            <div className="text-xs font-bold text-white truncate font-mono">
              {explainResult.planTree.lockType || 'None (Unlocked)'}
            </div>
            <div className="text-[9px] text-slate-400 truncate">
              {explainResult.architecturalAnalysis.lockingOverhead}
            </div>
          </div>

          {/* WAL Generation */}
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-[10px] text-slate-400 flex items-center gap-1 mb-1">
              <Flame className="w-3 h-3 text-amber-400" />
              <span>WAL Volume</span>
            </div>
            <div className="text-base font-bold text-amber-300 font-mono">
              {explainResult.walStats.bytes} <span className="text-[10px] text-slate-500">B</span>
            </div>
            <div className="text-[9px] text-slate-400">
              {explainResult.walStats.records} WAL records
            </div>
          </div>
        </div>

        {/* View Selection Tabs & EXPLAIN Options Toolbar */}
        <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs">
          {/* Main Views */}
          <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'visual', label: 'Execution Tree & Node Graph', icon: Layers },
              { id: 'text', label: 'PostgreSQL ASCII Plan', icon: FileCode },
              { id: 'json', label: 'pgAdmin / Drizzle JSON', icon: Code },
              { id: 'advice', label: 'Optimizer Advice & Indexes', icon: Sparkles }
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeView === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* EXPLAIN Option Checkboxes */}
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-slate-500 flex items-center gap-1">
              <Sliders className="w-3 h-3 text-slate-400" />
              Options:
            </span>
            {(['analyze', 'buffers', 'costs', 'verbose', 'wal', 'timing'] as Array<keyof ExplainAnalyzeOptions>).map((opt) => (
              <button
                key={opt}
                onClick={() => toggleOption(opt)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors border uppercase ${
                  options[opt]
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 font-bold'
                    : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Main Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[52vh] bg-slate-950">
          {/* VIEW 1: Visual Node Tree */}
          {activeView === 'visual' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-400 flex items-center justify-between font-sans">
                <span>
                  Hierarchical physical plan executed by PostgreSQL optimizer. Click any operator node for deep attribute inspection.
                </span>
                <span className="text-amber-400 font-mono text-[11px]">
                  Total Operators: {countTotalNodes(explainResult.planTree)}
                </span>
              </div>

              {/* Recursive Visual Nodes */}
              <div className="space-y-3">
                <VisualNodeRenderer
                  node={explainResult.planTree}
                  depth={0}
                  totalCost={explainResult.costTotal}
                  totalTime={explainResult.executionTimeMs}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={(id) => setSelectedNodeId(id === selectedNodeId ? null : id)}
                />
              </div>
            </div>
          )}

          {/* VIEW 2: Raw PostgreSQL psql ASCII Output */}
          {activeView === 'text' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-sans">
                <span>Standard `psql` console formatted execution tree output:</span>
                <span className="text-emerald-400 font-mono text-[11px]">FORMAT TEXT</span>
              </div>
              <pre className="p-4 bg-slate-900 border border-slate-800 rounded-xl font-mono text-xs text-emerald-400 overflow-x-auto leading-relaxed whitespace-pre shadow-inner">
                {explainResult.formattedTextPlan}
              </pre>
            </div>
          )}

          {/* VIEW 3: JSON Format */}
          {activeView === 'json' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-sans">
                <span>pgAdmin &amp; Drizzle ORM compatible JSON plan structure:</span>
                <span className="text-cyan-400 font-mono text-[11px]">FORMAT JSON</span>
              </div>
              <pre className="p-4 bg-slate-900 border border-slate-800 rounded-xl font-mono text-xs text-cyan-300 overflow-x-auto leading-relaxed whitespace-pre shadow-inner">
                {JSON.stringify(explainResult.formattedJsonPlan, null, 2)}
              </pre>
            </div>
          )}

          {/* VIEW 4: Architectural Optimization Advice */}
          {activeView === 'advice' && (
            <div className="space-y-4 font-sans">
              <div className="text-xs text-slate-400">
                Enterprise iGaming performance diagnostics &amp; indexing recommendations for high-concurrency 4-second SLA compliance:
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {explainResult.recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border flex flex-col justify-between ${
                      rec.severity === 'optimal'
                        ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                        : rec.severity === 'warning'
                        ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                        : 'bg-blue-950/20 border-blue-500/40 text-blue-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <h4 className="text-xs font-bold font-mono text-white">{rec.title}</h4>
                        </div>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                          {rec.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed font-sans">{rec.description}</p>
                    </div>

                    {rec.sqlSuggestion && (
                      <div className="mt-3 p-2 bg-slate-950 rounded border border-slate-800 font-mono text-[11px] text-amber-300">
                        <code>{rec.sqlSuggestion}</code>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Architectural Audit Summary Card */}
              <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2 font-mono text-xs">
                <div className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Production SLA &amp; Financial ACID Health Audit</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300 text-xs">
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span className="text-slate-400">Concurrency Tier:</span>
                    <span className="font-bold text-emerald-400">
                      {explainResult.architecturalAnalysis.concurrencyRating}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span className="text-slate-400">Index Efficiency:</span>
                    <span className="font-bold text-cyan-300">
                      {explainResult.architecturalAnalysis.indexEfficiency}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span className="text-slate-400">Cache Hit Efficiency:</span>
                    <span className="font-bold text-emerald-400">
                      {explainResult.architecturalAnalysis.cacheEfficiency}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span className="text-slate-400">Row Lock Mutex Overhead:</span>
                    <span className="font-bold text-amber-400">
                      {explainResult.architecturalAnalysis.lockingOverhead}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>PostgreSQL 16.2 &bull; Read Committed Isolation</span>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-slate-500 hidden sm:inline">
              4-Second SLA Compliance: <strong className="text-emerald-400">VALIDATED</strong>
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg cursor-pointer transition-colors font-bold"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper to count total nodes in plan tree
function countTotalNodes(node: ExplainPlanNode): number {
  let count = 1;
  if (node.children) {
    for (const c of node.children) {
      count += countTotalNodes(c);
    }
  }
  return count;
}

// Recursive Visual Node Component
const VisualNodeRenderer: React.FC<{
  node: ExplainPlanNode;
  depth: number;
  totalCost: number;
  totalTime: number;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}> = ({ node, depth, totalCost, totalTime, selectedNodeId, onSelectNode }) => {
  const isSelected = selectedNodeId === node.id;
  const costPercent = totalCost > 0 ? Math.min(100, Math.round((node.totalCost / totalCost) * 100)) : 100;
  const timePercent = totalTime > 0 ? Math.min(100, Math.round((node.actualTotalTime / totalTime) * 100)) : 100;

  return (
    <div className={`space-y-2 ${depth > 0 ? 'ml-4 sm:ml-8 border-l-2 border-slate-800 pl-3 sm:pl-4' : ''}`}>
      <div
        onClick={() => onSelectNode(node.id)}
        className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
          isSelected
            ? 'bg-slate-900 border-amber-500 ring-1 ring-amber-500/50 shadow-lg'
            : 'bg-slate-900/80 hover:bg-slate-900 border-slate-800 hover:border-slate-700'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* Node Operator Title */}
          <div className="flex items-center space-x-2">
            {depth > 0 && <CornerDownRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                node.nodeType === 'LockRows'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : node.nodeType.includes('Index')
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : node.nodeType === 'Update'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : node.nodeType === 'Insert'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
              }`}
            >
              {node.nodeType}
            </span>

            {node.relationName && (
              <span className="text-white font-bold text-xs">
                on <code className="text-amber-300">{node.relationName}</code>
              </span>
            )}

            {node.indexName && (
              <span className="text-[11px] text-slate-400">
                using <code className="text-emerald-400">{node.indexName}</code>
              </span>
            )}
          </div>

          {/* Node Time & Cost Tags */}
          <div className="flex items-center space-x-3 text-xs">
            <div className="flex items-center space-x-1 text-slate-400">
              <span>Time:</span>
              <span className="font-bold text-white font-mono">
                {node.actualTotalTime.toFixed(3)} ms
              </span>
            </div>
            <div className="flex items-center space-x-1 text-slate-400">
              <span>Cost:</span>
              <span className="font-bold text-cyan-300 font-mono">
                {node.totalCost.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center space-x-1 text-slate-400">
              <span>Rows:</span>
              <span className="font-bold text-amber-300 font-mono">
                {node.actualRows}
              </span>
            </div>
          </div>
        </div>

        {/* Cost & Time Progress Bars */}
        <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
          <div>
            <div className="flex justify-between text-slate-400 mb-0.5">
              <span>Time Share:</span>
              <span className="text-white font-bold">{timePercent}%</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full"
                style={{ width: `${timePercent}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-slate-400 mb-0.5">
              <span>Buffer Hit Blocks:</span>
              <span className="text-emerald-400 font-bold">
                {node.sharedHitBlocks} hit / {node.sharedReadBlocks} read
              </span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${node.sharedReadBlocks === 0 ? 100 : 50}%` }}
              />
            </div>
          </div>
        </div>

        {/* Expanded Details when selected */}
        {isSelected && (
          <div className="mt-3 pt-3 border-t border-slate-800 space-y-2 text-xs text-slate-300 font-mono bg-slate-950/60 p-3 rounded-lg animate-fade-in">
            {node.lockType && (
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Lock Type:</span>
                <span className="font-bold text-rose-400">{node.lockType}</span>
              </div>
            )}

            {node.indexCond && (
              <div className="flex items-start gap-2">
                <span className="text-slate-500 shrink-0">Index Cond:</span>
                <code className="text-emerald-300 bg-slate-950 px-2 py-0.5 rounded">
                  {node.indexCond}
                </code>
              </div>
            )}

            {node.filter && (
              <div className="flex items-start gap-2">
                <span className="text-slate-500 shrink-0">Filter:</span>
                <code className="text-amber-300 bg-slate-950 px-2 py-0.5 rounded">
                  {node.filter}
                </code>
              </div>
            )}

            {node.output && (
              <div className="flex items-start gap-2">
                <span className="text-slate-500 shrink-0">Output Columns:</span>
                <span className="text-slate-300 text-[11px]">{node.output.join(', ')}</span>
              </div>
            )}

            {node.details && (
              <div className="space-y-1 pt-1 border-t border-slate-800/80">
                {node.details.map((d, i) => (
                  <div key={i} className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>{d}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Render Child Nodes */}
      {node.children && node.children.map((child) => (
        <VisualNodeRenderer
          key={child.id}
          node={child}
          depth={depth + 1}
          totalCost={totalCost}
          totalTime={totalTime}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
        />
      ))}
    </div>
  );
};
