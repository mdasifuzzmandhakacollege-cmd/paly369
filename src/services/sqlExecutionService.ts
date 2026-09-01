/**
 * @file sqlExecutionService.ts
 * @description In-memory SQL parser, execution engine, and persistent session query history manager.
 * Allows developers to run ad-hoc PostgreSQL queries against ledger entities and re-run past queries.
 */

import { seamlessEngine, SqlQueryLog } from './simulatedWalletEngine';
import { TransactionEntity, WalletEntity, UserEntity, GameRoundEntity } from '../server/types/seamless';

export interface SqlQueryResult {
  statement: string;
  commandType: 'SELECT' | 'SELECT_FOR_UPDATE' | 'UPDATE' | 'INSERT' | 'DELETE' | 'EXPLAIN' | 'TRANSACTION' | 'OTHER';
  table: string;
  columns: string[];
  rows: any[];
  rowCount: number;
  durationMs: number;
  status: 'SUCCESS' | 'ERROR';
  error?: string;
  timestamp: number;
  timeLabel: string;
  queryPlan?: string;
}

export interface HistoryQueryRecord {
  id: string;
  statement: string;
  commandType: 'SELECT' | 'SELECT_FOR_UPDATE' | 'UPDATE' | 'INSERT' | 'DELETE' | 'EXPLAIN' | 'TRANSACTION' | 'OTHER';
  table: string;
  timestamp: number;
  timeLabel: string;
  durationMs: number;
  status: 'SUCCESS' | 'ERROR';
  rowCount: number;
  source: 'MANUAL_CONSOLE' | 'SEAMLESS_DISPATCHER' | 'PRESET_TEMPLATE' | 'DEBUG_RUNNER';
  isPinned?: boolean;
  error?: string;
  columns?: string[];
}

export interface PresetQueryTemplate {
  id: string;
  title: string;
  description: string;
  category: 'Audit' | 'Locking' | 'Wallets' | 'Security' | 'Analytics';
  statement: string;
  tag: string;
}

const STORAGE_KEY = 'playall365_sql_query_history_v1';

export const PRESET_QUERIES: PresetQueryTemplate[] = [
  {
    id: 'pq_row_locks',
    title: 'Audit Active Row-Locks (SELECT FOR UPDATE)',
    description: 'Inspect exclusive ACID row mutex locks on player wallets with real-time balance state.',
    category: 'Locking',
    statement: `SELECT * FROM wallets WHERE status = 'ACTIVE' ORDER BY version DESC LIMIT 10 FOR UPDATE;`,
    tag: 'Row Lock'
  },
  {
    id: 'pq_high_roller_wallets',
    title: 'Top VIP Wallet Balances (BDT & USD)',
    description: 'Retrieve wealthiest accounts sorted by real_balance in descending order.',
    category: 'Wallets',
    statement: `SELECT id, user_id, currency, real_balance, bonus_balance, version, status FROM wallets ORDER BY real_balance DESC LIMIT 10;`,
    tag: 'VIP'
  },
  {
    id: 'pq_recent_bets_wins',
    title: 'Recent Seamless Bets & Wins',
    description: 'Inspect latest debit/credit transactions with balance before and after transitions.',
    category: 'Audit',
    statement: `SELECT transaction_id, provider_id, user_id, type, amount, currency, before_balance, after_balance, status, created_at FROM transactions ORDER BY created_at DESC LIMIT 15;`,
    tag: 'Transactions'
  },
  {
    id: 'pq_large_wins',
    title: 'High Multiplier Jackpot & Win Audits (> 1000)',
    description: 'Locate all high-value win settlements for AML and operator verification.',
    category: 'Security',
    statement: `SELECT transaction_id, user_id, provider_id, game_id, amount, currency, status, created_at FROM transactions WHERE type = 'WIN' AND amount >= 1000 ORDER BY amount DESC;`,
    tag: 'Big Wins'
  },
  {
    id: 'pq_failed_txs',
    title: 'Failed or Rejected Transactions',
    description: 'Query transactions requiring reconciliation, quick refund, or manual rollback.',
    category: 'Audit',
    statement: `SELECT * FROM transactions WHERE status = 'FAILED' OR status = 'REJECTED' ORDER BY created_at DESC;`,
    tag: 'Reconciliation'
  },
  {
    id: 'pq_idempotency_keys',
    title: 'Active Idempotency UUID Replay Store',
    description: 'Inspect cached response payloads used to prevent duplicate provider debits.',
    category: 'Security',
    statement: `SELECT key, provider_id, endpoint, status_code, created_at FROM idempotency_keys ORDER BY created_at DESC LIMIT 10;`,
    tag: 'Idempotency'
  },
  {
    id: 'pq_explain_index',
    title: 'EXPLAIN ANALYZE Wallet Index Scan',
    description: 'Analyze PostgreSQL buffer cache hit ratio, execution cost, and row locking overhead.',
    category: 'Analytics',
    statement: `EXPLAIN ANALYZE SELECT * FROM wallets WHERE user_id = 'a0000000-0000-0000-0000-000000000004' FOR UPDATE;`,
    tag: 'Explain'
  }
];

class SqlExecutionService {
  private history: HistoryQueryRecord[] = [];
  private listeners: Array<(history: HistoryQueryRecord[]) => void> = [];

  constructor() {
    this.loadHistory();
    this.subscribeToEngineLogs();
  }

  private loadHistory(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.history = parsed;
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to load SQL query history from localStorage', e);
    }

    // Seed default starter history if empty
    this.history = PRESET_QUERIES.slice(0, 3).map((pq, i) => ({
      id: `hist_init_${i}_${Date.now()}`,
      statement: pq.statement,
      commandType: pq.statement.includes('FOR UPDATE') ? 'SELECT_FOR_UPDATE' : (pq.statement.trim().split(' ')[0].toUpperCase() as any),
      table: pq.statement.includes('wallets') ? 'wallets' : pq.statement.includes('transactions') ? 'transactions' : 'users',
      timestamp: Date.now() - (3 - i) * 60000,
      timeLabel: new Date(Date.now() - (3 - i) * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      durationMs: Number((0.15 + Math.random() * 0.45).toFixed(3)),
      status: 'SUCCESS',
      rowCount: 10,
      source: 'PRESET_TEMPLATE',
      isPinned: i === 0,
      columns: ['id', 'user_id', 'currency', 'real_balance', 'version', 'status']
    }));
  }

  private persistHistory(): void {
    try {
      // Keep up to 100 most recent queries in localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history.slice(0, 100)));
    } catch (e) {
      console.warn('Failed to save SQL query history to localStorage', e);
    }
    this.notifyListeners();
  }

  private subscribeToEngineLogs(): void {
    // Also listen to system queries executed by the seamless engine so they appear in history
    seamlessEngine.onSqlQueryRecorded((logs) => {
      if (logs.length === 0) return;
      const latest = logs[0];
      if (!latest) return;

      // Check if we already have this exact query with same timestamp to avoid duplicate loop
      const exists = this.history.some((h) => h.id === latest.id || (h.statement === latest.statement && Math.abs(h.timestamp - latest.timestamp) < 500));
      if (!exists) {
        const historyRecord: HistoryQueryRecord = {
          id: latest.id,
          statement: latest.statement,
          commandType: latest.statement.includes('FOR UPDATE') ? 'SELECT_FOR_UPDATE' : (latest.commandType as any),
          table: latest.table,
          timestamp: latest.timestamp,
          timeLabel: latest.timeLabel,
          durationMs: latest.durationMs,
          status: latest.status === 'SUCCESS' ? 'SUCCESS' : 'ERROR',
          rowCount: latest.affectedRows !== undefined ? latest.affectedRows : 1,
          source: 'SEAMLESS_DISPATCHER',
          isPinned: false
        };
        this.history.unshift(historyRecord);
        if (this.history.length > 100) this.history.pop();
        this.persistHistory();
      }
    });
  }

  public getHistory(): HistoryQueryRecord[] {
    return [...this.history];
  }

  public onHistoryChange(cb: (history: HistoryQueryRecord[]) => void): () => void {
    this.listeners.push(cb);
    cb([...this.history]);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notifyListeners(): void {
    const list = [...this.history];
    this.listeners.forEach((cb) => {
      try {
        cb(list);
      } catch (err) {
        console.error('History listener error:', err);
      }
    });
  }

  public togglePin(id: string): void {
    this.history = this.history.map((h) => (h.id === id ? { ...h, isPinned: !h.isPinned } : h));
    this.persistHistory();
  }

  public deleteItem(id: string): void {
    this.history = this.history.filter((h) => h.id !== id);
    this.persistHistory();
  }

  public clearHistory(): void {
    this.history = this.history.filter((h) => h.isPinned); // keep pinned items
    this.persistHistory();
  }

  public clearAllIncludingPinned(): void {
    this.history = [];
    this.persistHistory();
  }

  public exportHistoryAsSql(): string {
    const header = `-- ==========================================================================\n` +
      `-- PLAYALL 365 SEAMLESS LEDGER - SQL QUERY AUDIT HISTORY EXPORT\n` +
      `-- Generated: ${new Date().toISOString()}\n` +
      `-- Total Statements: ${this.history.length}\n` +
      `-- ==========================================================================\n\n`;

    const body = this.history.map((h, i) => {
      return `-- [Query #${i + 1}] Executed: ${h.timeLabel} | Latency: ${h.durationMs}ms | Rows: ${h.rowCount} | Source: ${h.source}\n` +
        `${h.statement.trim()}${h.statement.trim().endsWith(';') ? '' : ';'}\n`;
    }).join('\n');

    return header + body;
  }

  /**
   * Safe in-memory SQL execution engine against ledger entities
   */
  public executeSql(rawStatement: string, source: HistoryQueryRecord['source'] = 'MANUAL_CONSOLE'): SqlQueryResult {
    const startTime = performance.now();
    const trimmed = rawStatement.trim();
    const cleanStmt = trimmed.endsWith(';') ? trimmed.slice(0, -1).trim() : trimmed;
    const now = Date.now();
    const timeLabel = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (!cleanStmt) {
      return {
        statement: rawStatement,
        commandType: 'OTHER',
        table: 'unknown',
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: 0,
        status: 'ERROR',
        error: 'Empty SQL statement provided.',
        timestamp: now,
        timeLabel
      };
    }

    try {
      const isExplain = cleanStmt.toUpperCase().startsWith('EXPLAIN');
      const isForUpdate = cleanStmt.toUpperCase().includes('FOR UPDATE');

      let queryToRun = cleanStmt;
      if (isExplain) {
        // Strip EXPLAIN [ANALYZE] prefix
        queryToRun = cleanStmt.replace(/^EXPLAIN\s+(ANALYZE\s+)?/i, '').trim();
      }

      // Determine command type
      const firstWord = queryToRun.split(/\s+/)[0].toUpperCase();
      let commandType: SqlQueryResult['commandType'] = 'SELECT';
      if (isExplain) commandType = 'EXPLAIN';
      else if (isForUpdate) commandType = 'SELECT_FOR_UPDATE';
      else if (firstWord === 'UPDATE') commandType = 'UPDATE';
      else if (firstWord === 'INSERT') commandType = 'INSERT';
      else if (firstWord === 'DELETE') commandType = 'DELETE';
      else if (firstWord === 'BEGIN' || firstWord === 'COMMIT' || firstWord === 'ROLLBACK') commandType = 'TRANSACTION';

      // Detect Table Name
      let table = 'transactions';
      const fromMatch = queryToRun.match(/\bFROM\s+([a-zA-Z0-9_]+)/i);
      const updateMatch = queryToRun.match(/\bUPDATE\s+([a-zA-Z0-9_]+)/i);
      const intoMatch = queryToRun.match(/\bINTO\s+([a-zA-Z0-9_]+)/i);

      if (fromMatch) table = fromMatch[1].toLowerCase();
      else if (updateMatch) table = updateMatch[1].toLowerCase();
      else if (intoMatch) table = intoMatch[1].toLowerCase();

      // Retrieve Data Source
      let rawData: any[] = [];
      if (table === 'wallets') rawData = seamlessEngine.getWallets();
      else if (table === 'transactions' || table === 'transaction_ledger') rawData = seamlessEngine.getTransactions();
      else if (table === 'users' || table === 'players') rawData = seamlessEngine.getUsers();
      else if (table === 'game_rounds') rawData = seamlessEngine.getGameRounds();
      else if (table === 'idempotency' || table === 'idempotency_keys') rawData = seamlessEngine.getIdempotencyRecords();
      else if (table === 'sql_logs' || table === 'sql_query_logs') rawData = seamlessEngine.getSqlQueryLogs();
      else {
        // Default to transactions if unknown table requested
        rawData = seamlessEngine.getTransactions();
      }

      let resultRows = [...rawData];

      // Simple Parser for WHERE, ORDER BY, LIMIT
      // 1. WHERE filtering
      const whereMatch = queryToRun.match(/\bWHERE\s+(.*?)(?=\bORDER\s+BY|\bLIMIT|\bFOR\s+UPDATE|$)/i);
      if (whereMatch && whereMatch[1]) {
        const whereClause = whereMatch[1].trim();
        resultRows = this.applyWhereFilter(resultRows, whereClause);
      }

      // 2. ORDER BY
      const orderMatch = queryToRun.match(/\bORDER\s+BY\s+([a-zA-Z0-9_]+)(\s+ASC|\s+DESC)?/i);
      if (orderMatch && orderMatch[1]) {
        const col = orderMatch[1];
        const isDesc = (orderMatch[2] || '').trim().toUpperCase() === 'DESC';
        resultRows.sort((a, b) => {
          const valA = a[col];
          const valB = b[col];
          if (valA === undefined || valA === null) return 1;
          if (valB === undefined || valB === null) return -1;
          if (typeof valA === 'number' && typeof valB === 'number') {
            return isDesc ? valB - valA : valA - valB;
          }
          const strA = String(valA);
          const strB = String(valB);
          return isDesc ? strB.localeCompare(strA) : strA.localeCompare(strB);
        });
      }

      // 3. LIMIT
      const limitMatch = queryToRun.match(/\bLIMIT\s+([0-9]+)/i);
      if (limitMatch && limitMatch[1]) {
        const limitVal = parseInt(limitMatch[1], 10);
        if (!isNaN(limitVal) && limitVal >= 0) {
          resultRows = resultRows.slice(0, limitVal);
        }
      }

      // 4. Columns selection
      let columns: string[] = [];
      const selectColsMatch = queryToRun.match(/\bSELECT\s+(.*?)\s+\bFROM/i);
      if (selectColsMatch && selectColsMatch[1]) {
        const rawCols = selectColsMatch[1].trim();
        if (rawCols === '*') {
          columns = resultRows.length > 0 ? Object.keys(resultRows[0]) : ['id', 'status', 'created_at'];
        } else {
          columns = rawCols.split(',').map((c) => c.trim().split(/\s+AS\s+/i)[0].trim());
        }
      } else {
        columns = resultRows.length > 0 ? Object.keys(resultRows[0]) : ['id', 'status', 'created_at'];
      }

      // Handle UPDATE query simulation
      if (firstWord === 'UPDATE') {
        const setMatch = queryToRun.match(/\bSET\s+(.*?)(?=\bWHERE|$)/i);
        if (setMatch && setMatch[1]) {
          const updates = setMatch[1].split(',').map((s) => s.trim());
          // Update affected items
          resultRows.forEach((row) => {
            updates.forEach((u) => {
              const [k, v] = u.split('=').map((x) => x.trim());
              if (k && v !== undefined) {
                let cleanVal: any = v.replace(/^['"]|['"]$/g, '');
                if (!isNaN(Number(cleanVal))) cleanVal = Number(cleanVal);
                row[k] = cleanVal;
              }
            });
          });
        }
      }

      const durationMs = Number((performance.now() - startTime).toFixed(3)) || 0.124;

      const result: SqlQueryResult = {
        statement: rawStatement,
        commandType,
        table,
        columns,
        rows: resultRows,
        rowCount: resultRows.length,
        durationMs,
        status: 'SUCCESS',
        timestamp: now,
        timeLabel,
        queryPlan: isExplain ? `Seq Scan on ${table} (cost=0.00..${(resultRows.length * 1.15).toFixed(2)} rows=${resultRows.length} width=128)\n  Filter: (status = 'ACTIVE'::text)\nExecution Time: ${durationMs} ms` : undefined
      };

      // Add to Query History
      const histRecord: HistoryQueryRecord = {
        id: `hist_${now}_${Math.floor(1000 + Math.random() * 9000)}`,
        statement: rawStatement,
        commandType,
        table,
        timestamp: now,
        timeLabel,
        durationMs,
        status: 'SUCCESS',
        rowCount: resultRows.length,
        source,
        columns,
        isPinned: false
      };
      this.history.unshift(histRecord);
      if (this.history.length > 100) this.history.pop();
      this.persistHistory();

      return result;
    } catch (err: any) {
      const durationMs = Number((performance.now() - startTime).toFixed(3)) || 0.25;
      const errorMsg = err.message || 'Syntax error in SQL query.';

      const result: SqlQueryResult = {
        statement: rawStatement,
        commandType: 'OTHER',
        table: 'unknown',
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs,
        status: 'ERROR',
        error: errorMsg,
        timestamp: now,
        timeLabel
      };

      const histRecord: HistoryQueryRecord = {
        id: `hist_err_${now}_${Math.floor(1000 + Math.random() * 9000)}`,
        statement: rawStatement,
        commandType: 'OTHER',
        table: 'unknown',
        timestamp: now,
        timeLabel,
        durationMs,
        status: 'ERROR',
        rowCount: 0,
        source,
        error: errorMsg,
        isPinned: false
      };
      this.history.unshift(histRecord);
      this.persistHistory();

      return result;
    }
  }

  private applyWhereFilter(rows: any[], whereClause: string): any[] {
    // Parse simple AND/OR clauses: e.g. "status = 'ACTIVE'", "amount > 100", "currency = 'BDT'"
    const conditions = whereClause.split(/\bAND\b/i).map((c) => c.trim());

    return rows.filter((row) => {
      return conditions.every((cond) => {
        // Condition matches: "key = val", "key != val", "key > val", "key >= val", "key < val", "key <= val", "key LIKE '%val%'"
        const eqMatch = cond.match(/^([a-zA-Z0-9_]+)\s*(=|!=|<>|>|>=|<|<=|LIKE|ILIKE)\s*(.*)$/i);
        if (!eqMatch) return true;

        const [, col, op, rawVal] = eqMatch;
        const cleanVal = rawVal.replace(/^['"]|['"]$/g, '').trim();
        const rowVal = row[col];

        if (rowVal === undefined) return false;

        const operator = op.toUpperCase();
        if (operator === '=' || operator === '==') {
          return String(rowVal).toLowerCase() === cleanVal.toLowerCase();
        } else if (operator === '!=' || operator === '<>') {
          return String(rowVal).toLowerCase() !== cleanVal.toLowerCase();
        } else if (operator === '>') {
          return Number(rowVal) > Number(cleanVal);
        } else if (operator === '>=') {
          return Number(rowVal) >= Number(cleanVal);
        } else if (operator === '<') {
          return Number(rowVal) < Number(cleanVal);
        } else if (operator === '<=') {
          return Number(rowVal) <= Number(cleanVal);
        } else if (operator === 'LIKE' || operator === 'ILIKE') {
          const search = cleanVal.replace(/%/g, '').toLowerCase();
          return String(rowVal).toLowerCase().includes(search);
        }
        return true;
      });
    });
  }
}

export const sqlExecutionService = new SqlExecutionService();
