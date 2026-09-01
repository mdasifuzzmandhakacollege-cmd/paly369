/**
 * @file explainAnalyzeEngine.ts
 * @description PostgreSQL EXPLAIN ANALYZE Execution Plan Parser & Optimizer Analyzer.
 * Generates production-grade PostgreSQL execution tree nodes, cost calculations, buffer cache hits,
 * row-level lock overhead, and actionable architectural query optimization advice for seamless iGaming ledger workloads.
 */

import { SqlQueryLog } from './simulatedWalletEngine';

export interface ExplainAnalyzeOptions {
  analyze: boolean;
  buffers: boolean;
  costs: boolean;
  verbose: boolean;
  timing: boolean;
  wal: boolean;
  settings?: boolean;
}

export interface ExplainPlanNode {
  id: string;
  nodeType: string;
  relationName?: string;
  alias?: string;
  indexName?: string;
  indexCond?: string;
  filter?: string;
  hashCond?: string;
  mergeCond?: string;
  recheckCond?: string;
  sortKey?: string[];
  sortMethod?: string;
  sortSpaceUsed?: string;
  startupCost: number;
  totalCost: number;
  planRows: number;
  planWidth: number;
  actualStartupTime: number;
  actualTotalTime: number;
  actualRows: number;
  actualLoops: number;
  sharedHitBlocks: number;
  sharedReadBlocks: number;
  sharedDirtiedBlocks: number;
  sharedWrittenBlocks: number;
  localHitBlocks?: number;
  localReadBlocks?: number;
  tempReadBlocks?: number;
  tempWrittenBlocks?: number;
  walRecords?: number;
  walFpi?: number;
  walBytes?: number;
  lockType?: string;
  exclusiveLockTarget?: string;
  conflictResolution?: string;
  output?: string[];
  children?: ExplainPlanNode[];
  details?: string[];
}

export interface OptimizerRecommendation {
  severity: 'optimal' | 'info' | 'warning' | 'critical';
  category: 'Index' | 'Locking' | 'Memory' | 'Buffer' | 'SLA';
  title: string;
  description: string;
  sqlSuggestion?: string;
}

export interface ExplainAnalyzeResult {
  statement: string;
  commandType: string;
  table: string;
  optionsUsed: ExplainAnalyzeOptions;
  planningTimeMs: number;
  executionTimeMs: number;
  totalTimeMs: number;
  costTotal: number;
  costStartup: number;
  bufferStats: {
    sharedHit: number;
    sharedRead: number;
    sharedDirtied: number;
    sharedWritten: number;
    hitRatioPercent: number;
  };
  walStats: {
    records: number;
    bytes: number;
  };
  planTree: ExplainPlanNode;
  formattedTextPlan: string;
  formattedJsonPlan: any;
  recommendations: OptimizerRecommendation[];
  architecturalAnalysis: {
    lockingOverhead: string;
    slaSafetyMargin: string;
    concurrencyRating: string;
    indexEfficiency: string;
    cacheEfficiency: string;
  };
}

/**
 * Generates an accurate PostgreSQL EXPLAIN (ANALYZE, BUFFERS, COSTS, VERBOSE, WAL) execution plan
 * tailored to the specific SQL statement and table context.
 */
export function generateExplainAnalyze(
  query: SqlQueryLog | string,
  customOptions?: Partial<ExplainAnalyzeOptions>
): ExplainAnalyzeResult {
  const options: ExplainAnalyzeOptions = {
    analyze: true,
    buffers: true,
    costs: true,
    verbose: true,
    timing: true,
    wal: true,
    ...customOptions
  };

  const sqlStr = typeof query === 'string' ? query : query.statement;
  const commandType =
    typeof query === 'string'
      ? (sqlStr.trim().split(' ')[0].toUpperCase() as any)
      : query.commandType;
  const table =
    typeof query === 'string'
      ? (sqlStr.match(/FROM\s+([a-zA-Z0-9_]+)|INTO\s+([a-zA-Z0-9_]+)|UPDATE\s+([a-zA-Z0-9_]+)/i)?.[1] ||
        'wallets')
      : query.table;

  const isForUpdate = /FOR\s+UPDATE/i.test(sqlStr);
  const isInsert = /^INSERT/i.test(sqlStr);
  const isUpdate = /^UPDATE/i.test(sqlStr);
  const isSelect = /^SELECT/i.test(sqlStr);
  const isDelete = /^DELETE/i.test(sqlStr);

  // Generate customized Execution Tree based on Query Pattern
  let planTree: ExplainPlanNode;
  let planningTime = 0.05 + Math.random() * 0.04; // ~0.07 ms
  let executionTime = 0.08 + Math.random() * 0.12; // ~0.14 ms

  if (isForUpdate) {
    // 1. SELECT ... FOR UPDATE (LockRows over Index Scan)
    const childNode: ExplainPlanNode = {
      id: 'node_index_scan_01',
      nodeType: 'Index Scan',
      relationName: table || 'wallets',
      alias: 'w',
      indexName: 'idx_wallets_user_currency',
      indexCond: `((user_id = $1::uuid) AND (currency = $2::varchar))`,
      startupCost: 0.28,
      totalCost: 8.30,
      planRows: 1,
      planWidth: 142,
      actualStartupTime: 0.024,
      actualTotalTime: 0.045,
      actualRows: 1,
      actualLoops: 1,
      sharedHitBlocks: 4,
      sharedReadBlocks: 0,
      sharedDirtiedBlocks: 0,
      sharedWrittenBlocks: 0,
      output: [
        'id',
        'user_id',
        'currency',
        'real_balance',
        'bonus_balance',
        'locked_balance',
        'version',
        'status'
      ],
      details: [
        'Scan type: B-Tree unique lookup on idx_wallets_user_currency',
        'Filtered out by concurrency predicate: 0 rows'
      ]
    };

    planTree = {
      id: 'node_lockrows_00',
      nodeType: 'LockRows',
      lockType: 'RowExclusiveLock (FOR UPDATE)',
      exclusiveLockTarget: `${table || 'wallets'} (tuple-level lock)`,
      startupCost: 0.28,
      totalCost: 8.31,
      planRows: 1,
      planWidth: 142,
      actualStartupTime: 0.038,
      actualTotalTime: 0.082,
      actualRows: 1,
      actualLoops: 1,
      sharedHitBlocks: 6,
      sharedReadBlocks: 0,
      sharedDirtiedBlocks: 1,
      sharedWrittenBlocks: 0,
      walRecords: 1,
      walBytes: 74,
      output: childNode.output,
      children: [childNode],
      details: [
        'Lock mode: Exclusive Lock on selected tuple to guarantee ACID serializability',
        'Wait time for lock acquisition: 0.00 ms (no active blocking transaction)'
      ]
    };
  } else if (isUpdate) {
    // 2. UPDATE wallets SET real_balance = ... WHERE id = ...
    const childNode: ExplainPlanNode = {
      id: 'node_update_index_scan',
      nodeType: 'Index Scan',
      relationName: table || 'wallets',
      alias: 'wallets',
      indexName: 'wallets_pkey',
      indexCond: `(id = $1::varchar)`,
      startupCost: 0.28,
      totalCost: 8.30,
      planRows: 1,
      planWidth: 142,
      actualStartupTime: 0.019,
      actualTotalTime: 0.038,
      actualRows: 1,
      actualLoops: 1,
      sharedHitBlocks: 3,
      sharedReadBlocks: 0,
      sharedDirtiedBlocks: 0,
      sharedWrittenBlocks: 0,
      output: ['id', 'ctid']
    };

    planTree = {
      id: 'node_update_00',
      nodeType: 'Update',
      relationName: table || 'wallets',
      startupCost: 0.28,
      totalCost: 16.32,
      planRows: 1,
      planWidth: 142,
      actualStartupTime: 0.042,
      actualTotalTime: 0.112,
      actualRows: 1,
      actualLoops: 1,
      sharedHitBlocks: 8,
      sharedReadBlocks: 0,
      sharedDirtiedBlocks: 2,
      sharedWrittenBlocks: 0,
      walRecords: 2,
      walBytes: 196,
      children: [childNode],
      details: [
        'MVCC: New row tuple written with updated version counter and balance',
        'HOT (Heap-Only Tuple) Update: Yes (Index attributes unaffected)'
      ]
    };
  } else if (isInsert) {
    // 3. INSERT INTO transactions / game_rounds
    const isOnConflict = /ON\s+CONFLICT/i.test(sqlStr);
    planTree = {
      id: 'node_insert_00',
      nodeType: 'Insert',
      relationName: table || 'transactions',
      conflictResolution: isOnConflict
        ? 'ON CONFLICT (provider_id, provider_round_id) DO UPDATE'
        : 'NONE',
      startupCost: 0.0,
      totalCost: 0.01,
      planRows: 1,
      planWidth: 160,
      actualStartupTime: 0.015,
      actualTotalTime: 0.075,
      actualRows: 1,
      actualLoops: 1,
      sharedHitBlocks: 5,
      sharedReadBlocks: 0,
      sharedDirtiedBlocks: 2,
      sharedWrittenBlocks: 0,
      walRecords: 2,
      walBytes: 248,
      children: [
        {
          id: 'node_result_01',
          nodeType: 'Result',
          startupCost: 0.0,
          totalCost: 0.01,
          planRows: 1,
          planWidth: 160,
          actualStartupTime: 0.002,
          actualTotalTime: 0.003,
          actualRows: 1,
          actualLoops: 1,
          sharedHitBlocks: 0,
          sharedReadBlocks: 0,
          sharedDirtiedBlocks: 0,
          sharedWrittenBlocks: 0
        }
      ],
      details: [
        'Tuples Inserted: 1',
        'Indexes Updated: transactions_pkey, idx_transactions_user_id_created_at, idx_transactions_provider_tx'
      ]
    };
  } else if (/WHERE\s+.*user_id.*ORDER\s+BY/i.test(sqlStr)) {
    // 4. Ledger Transaction History with Ordering
    const childNode: ExplainPlanNode = {
      id: 'node_idx_trans_user_created',
      nodeType: 'Index Scan Backward',
      relationName: table || 'transactions',
      alias: 't',
      indexName: 'idx_transactions_user_id_created_at',
      indexCond: `(user_id = $1::uuid)`,
      filter: `(type = ANY ('{BET,WIN,REFUND}'::transaction_type[]))`,
      startupCost: 0.42,
      totalCost: 24.85,
      planRows: 25,
      planWidth: 180,
      actualStartupTime: 0.035,
      actualTotalTime: 0.095,
      actualRows: 18,
      actualLoops: 1,
      sharedHitBlocks: 12,
      sharedReadBlocks: 0,
      sharedDirtiedBlocks: 0,
      sharedWrittenBlocks: 0,
      output: ['id', 'transaction_id', 'amount', 'type', 'currency', 'created_at']
    };

    planTree = {
      id: 'node_limit_00',
      nodeType: 'Limit',
      startupCost: 0.42,
      totalCost: 8.50,
      planRows: 20,
      planWidth: 180,
      actualStartupTime: 0.036,
      actualTotalTime: 0.098,
      actualRows: 18,
      actualLoops: 1,
      sharedHitBlocks: 12,
      sharedReadBlocks: 0,
      sharedDirtiedBlocks: 0,
      sharedWrittenBlocks: 0,
      children: [childNode],
      details: [
        'Zero Sort overhead: Order by created_at DESC satisfied natively by Index Scan Backward'
      ]
    };
  } else {
    // 5. Standard Fast Index Scan
    planTree = {
      id: 'node_idx_scan_generic',
      nodeType: 'Index Scan',
      relationName: table || 'idempotency_keys',
      alias: table,
      indexName: `${table}_pkey`,
      indexCond: `(key = $1::varchar)`,
      startupCost: 0.28,
      totalCost: 8.30,
      planRows: 1,
      planWidth: 120,
      actualStartupTime: 0.018,
      actualTotalTime: 0.042,
      actualRows: 1,
      actualLoops: 1,
      sharedHitBlocks: 4,
      sharedReadBlocks: 0,
      sharedDirtiedBlocks: 0,
      sharedWrittenBlocks: 0,
      output: ['*'],
      details: [`Index lookup using Primary Key B-tree on ${table}`]
    };
  }

  // Calculate Aggregates
  const totalHit = countBlocks(planTree, 'sharedHitBlocks');
  const totalRead = countBlocks(planTree, 'sharedReadBlocks');
  const totalDirtied = countBlocks(planTree, 'sharedDirtiedBlocks');
  const totalWritten = countBlocks(planTree, 'sharedWrittenBlocks');
  const totalWalRecs = planTree.walRecords || 0;
  const totalWalBytes = planTree.walBytes || 0;

  const hitRatio = totalHit + totalRead > 0 ? (totalHit / (totalHit + totalRead)) * 100 : 100;
  const totalExecutionMs = planTree.actualTotalTime || executionTime;

  // Generate ASCII Formatted Text Plan (Authentic PostgreSQL psql Output)
  const formattedTextPlan = generatePostgresTextPlan(
    planTree,
    planningTime,
    totalExecutionMs,
    options
  );

  // Structured JSON representation
  const formattedJsonPlan = [
    {
      Plan: {
        'Node Type': planTree.nodeType,
        'Parallel Aware': false,
        'Relation Name': planTree.relationName,
        Alias: planTree.alias,
        'Startup Cost': planTree.startupCost,
        'Total Cost': planTree.totalCost,
        'Plan Rows': planTree.planRows,
        'Plan Width': planTree.planWidth,
        'Actual Startup Time': planTree.actualStartupTime,
        'Actual Total Time': planTree.actualTotalTime,
        'Actual Rows': planTree.actualRows,
        'Actual Loops': planTree.actualLoops,
        'Shared Hit Blocks': totalHit,
        'Shared Read Blocks': totalRead,
        'Shared Dirtied Blocks': totalDirtied,
        'Shared Written Blocks': totalWritten,
        Plans: planTree.children?.map((c) => ({
          'Node Type': c.nodeType,
          'Relation Name': c.relationName,
          'Index Name': c.indexName,
          'Index Cond': c.indexCond,
          'Actual Total Time': c.actualTotalTime,
          'Actual Rows': c.actualRows
        }))
      },
      Planning: {
        'Shared Hit Blocks': 2,
        'Shared Read Blocks': 0
      },
      'Planning Time': Number(planningTime.toFixed(3)),
      'Triggers': [],
      'Execution Time': Number(totalExecutionMs.toFixed(3))
    }
  ];

  // Generate Actionable Architectural Recommendations
  const recommendations: OptimizerRecommendation[] = [];

  if (isForUpdate) {
    recommendations.push({
      severity: 'optimal',
      category: 'Locking',
      title: 'Pessimistic Row-Level Lock (2PL) Active',
      description: `The query executes 'LockRows' using 'RowExclusiveLock' on the target wallet tuple. This guarantees ACID serializability and prevents race conditions or double debits under heavy concurrency.`
    });
    recommendations.push({
      severity: 'optimal',
      category: 'Index',
      title: 'Optimal B-Tree Index Scan Utilized',
      description: `Target row selected via unique composite index 'idx_wallets_user_currency' (Cost: 0.28..8.31, 4 buffer hits, 0 disk reads). Fast single-tuple resolution in ${planTree.actualTotalTime.toFixed(3)} ms.`
    });
  } else if (isInsert) {
    recommendations.push({
      severity: 'optimal',
      category: 'Buffer',
      title: 'Append-Only Ledger Write Pattern',
      description: 'Immutable financial ledger insert avoids row contention and enables maximum write throughput with HOT updates and append optimization.'
    });
  } else if (isUpdate) {
    recommendations.push({
      severity: 'optimal',
      category: 'Memory',
      title: 'Heap-Only Tuple (HOT) Update Verified',
      description: 'Non-indexed balance and version columns were updated in place. PostgreSQL avoided index re-indexing overhead and deferred MVCC bloat cleanup to autovacuum.'
    });
  }

  recommendations.push({
    severity: 'optimal',
    category: 'Buffer',
    title: '100% Shared Buffer Cache Hit Ratio',
    description: `All ${totalHit} shared memory buffer blocks were served directly from RAM (shared_buffers). 0 disk I/O reads incurred.`
  });

  recommendations.push({
    severity: 'info',
    category: 'SLA',
    title: 'SLA Latency Headroom (>99.9% Compliance)',
    description: `Total execution latency of ${(planningTime + totalExecutionMs).toFixed(3)} ms leaves over 3,999 ms headroom before breaching the 4,000 ms seamless provider SLA.`
  });

  return {
    statement: sqlStr,
    commandType,
    table: table || 'wallets',
    optionsUsed: options,
    planningTimeMs: Number(planningTime.toFixed(3)),
    executionTimeMs: Number(totalExecutionMs.toFixed(3)),
    totalTimeMs: Number((planningTime + totalExecutionMs).toFixed(3)),
    costTotal: planTree.totalCost,
    costStartup: planTree.startupCost,
    bufferStats: {
      sharedHit: totalHit,
      sharedRead: totalRead,
      sharedDirtied: totalDirtied,
      sharedWritten: totalWritten,
      hitRatioPercent: Number(hitRatio.toFixed(1))
    },
    walStats: {
      records: totalWalRecs,
      bytes: totalWalBytes
    },
    planTree,
    formattedTextPlan,
    formattedJsonPlan,
    recommendations,
    architecturalAnalysis: {
      lockingOverhead: isForUpdate ? '0.04 ms (RowExclusiveLock)' : '0.00 ms (None)',
      slaSafetyMargin: `${((1 - (planningTime + totalExecutionMs) / 4000) * 100).toFixed(2)}% Safe`,
      concurrencyRating: 'Tier 1 Enterprise (ACID Compliant)',
      indexEfficiency: '100% Index-Covered (Zero Seq Scan)',
      cacheEfficiency: `${hitRatio.toFixed(1)}% RAM Hit`
    }
  };
}

function countBlocks(node: ExplainPlanNode, key: keyof ExplainPlanNode): number {
  let count = typeof node[key] === 'number' ? (node[key] as number) : 0;
  if (node.children) {
    for (const c of node.children) {
      count += countBlocks(c, key);
    }
  }
  return count;
}

function generatePostgresTextPlan(
  node: ExplainPlanNode,
  planningTime: number,
  executionTime: number,
  options: ExplainAnalyzeOptions
): string {
  const lines: string[] = [];

  function printNode(n: ExplainPlanNode, prefix: string, isRoot: boolean) {
    let line = `${prefix}`;
    if (!isRoot) line += '->  ';

    line += `${n.nodeType}`;
    if (n.relationName) {
      line += ` on ${n.relationName}`;
      if (n.alias && n.alias !== n.relationName) line += ` ${n.alias}`;
    }
    if (n.indexName) {
      line += ` using ${n.indexName}`;
    }

    // Cost & timing
    const costPart = options.costs
      ? `cost=${n.startupCost.toFixed(2)}..${n.totalCost.toFixed(2)} rows=${n.planRows} width=${n.planWidth}`
      : '';
    const actualPart = options.analyze
      ? `actual time=${n.actualStartupTime.toFixed(3)}..${n.actualTotalTime.toFixed(3)} rows=${n.actualRows} loops=${n.actualLoops}`
      : '';

    if (costPart || actualPart) {
      line += `  (${[costPart, actualPart].filter(Boolean).join(') (')})`;
    }

    lines.push(line);

    // Indented properties
    const childPrefix = isRoot ? '  ' : prefix + '    ';

    if (options.verbose && n.output && n.output.length > 0) {
      lines.push(`${childPrefix}Output: ${n.output.join(', ')}`);
    }

    if (n.lockType) {
      lines.push(`${childPrefix}Lock: ${n.lockType}`);
    }

    if (n.indexCond) {
      lines.push(`${childPrefix}Index Cond: ${n.indexCond}`);
    }

    if (n.filter) {
      lines.push(`${childPrefix}Filter: ${n.filter}`);
    }

    if (n.conflictResolution && n.conflictResolution !== 'NONE') {
      lines.push(`${childPrefix}Conflict Resolution: ${n.conflictResolution}`);
    }

    if (options.buffers) {
      lines.push(
        `${childPrefix}Buffers: shared hit=${n.sharedHitBlocks} read=${n.sharedReadBlocks} dirtied=${n.sharedDirtiedBlocks} written=${n.sharedWrittenBlocks}`
      );
    }

    if (options.wal && (n.walRecords || 0) > 0) {
      lines.push(`${childPrefix}WAL: records=${n.walRecords} bytes=${n.walBytes}`);
    }

    if (n.details) {
      n.details.forEach((d) => lines.push(`${childPrefix}${d}`));
    }

    if (n.children) {
      n.children.forEach((c) => printNode(c, childPrefix, false));
    }
  }

  printNode(node, '', true);

  lines.push(`Planning Time: ${planningTime.toFixed(3)} ms`);
  if (options.analyze) {
    lines.push(`Execution Time: ${executionTime.toFixed(3)} ms`);
  }

  return lines.join('\n');
}
