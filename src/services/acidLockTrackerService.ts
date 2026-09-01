/**
 * @file acidLockTrackerService.ts
 * @description Real-time PostgreSQL ACID Transaction & Row-Level Lock State Tracker.
 * Emulates PostgreSQL pg_locks, pg_stat_activity, MVCC tuple snapshots, and 2PL mutex queues.
 */

export type LockMode =
  | 'RowExclusiveLock (FOR UPDATE)'
  | 'AccessShareLock (SELECT)'
  | 'ExclusiveLock (UPDATE/INSERT)'
  | 'ShareLock'
  | 'RowShareLock (FOR SHARE)'
  | 'AccessExclusiveLock (DDL)';

export type TransactionState =
  | 'active'
  | 'idle_in_transaction'
  | 'waiting_on_lock'
  | 'committing'
  | 'committed'
  | 'aborted'
  | 'deadlock_rolled_back';

export type IsolationLevel = 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';

export interface PostgresBackendSession {
  pid: number;
  xid: number;
  virtualXid: string;
  clientAddr: string;
  applicationName: string;
  database: string;
  userName: string;
  state: TransactionState;
  isolationLevel: IsolationLevel;
  query: string;
  currentLockTarget?: string | null;
  heldLocks: string[];
  waitingOnLock: string | null;
  waitingSince?: number | null;
  startedAt: number;
  durationMs: number;
  xmin: number;
  xmax: number;
  cmin: number;
  cmax: number;
}

export interface PostgresRowLock {
  id: string;
  relation: 'wallets' | 'users' | 'transactions' | 'game_rounds' | 'idempotency_keys';
  tupleKey: string; // e.g. "wallet:a000...:BDT" or "user:a000..."
  lockMode: LockMode;
  holderPid: number;
  holderXid: number;
  granted: boolean;
  waitQueue: Array<{
    pid: number;
    xid: number;
    appName: string;
    requestedMode: LockMode;
    waitingSince: number;
  }>;
  acquiredAt: number;
  durationMs: number;
}

export interface LockHistoryEntry {
  id: string;
  timestamp: number;
  timeLabel: string;
  pid: number;
  xid: number;
  relation: string;
  tupleKey: string;
  lockMode: LockMode;
  action: 'ACQUIRE_REQUESTED' | 'LOCK_GRANTED' | 'LOCK_RELEASED' | 'WAIT_ENQUEUED' | 'DEADLOCK_DETECTED' | 'ROLLED_BACK' | 'COMMITTED';
  durationMs: number;
  details: string;
}

export interface AcidLockMetrics {
  activeBackendsCount: number;
  activeTransactionsCount: number;
  totalLocksHeld: number;
  lockWaitQueueLength: number;
  deadlocksResolvedCount: number;
  totalTransactionsCommitted: number;
  totalTransactionsRolledBack: number;
  averageLockDurationMs: number;
  mvccSnapshotIsolationOk: boolean;
}

class AcidLockTrackerService {
  private backends: Map<number, PostgresBackendSession> = new Map();
  private activeLocks: Map<string, PostgresRowLock> = new Map(); // key: relation:tupleKey
  private history: LockHistoryEntry[] = [];
  private listeners: Array<(state: {
    backends: PostgresBackendSession[];
    locks: PostgresRowLock[];
    history: LockHistoryEntry[];
    metrics: AcidLockMetrics;
  }) => void> = [];

  private nextXid: number = 728901;
  private nextPid: number = 4120;
  private deadlocksResolved: number = 0;
  private txCommittedCount: number = 1420;
  private txRolledBackCount: number = 3;

  constructor() {
    this.seedInitialSessions();
    this.startMetricsTicker();
  }

  private seedInitialSessions() {
    const now = Date.now();

    // Session 1: Background autovacuum daemon (Idle)
    this.backends.set(4101, {
      pid: 4101,
      xid: 728890,
      virtualXid: '3/102',
      clientAddr: '127.0.0.1:5432',
      applicationName: 'autovacuum worker',
      database: 'playall_casino_db',
      userName: 'postgres',
      state: 'active',
      isolationLevel: 'READ COMMITTED',
      query: 'VACUUM (ANALYZE) wallets;',
      heldLocks: ['wallets:table_share'],
      waitingOnLock: null,
      startedAt: now - 3500,
      durationMs: 3500,
      xmin: 728880,
      xmax: 0,
      cmin: 0,
      cmax: 0
    });

    // Session 2: Seamless Bet Processor Worker 1 (Active)
    this.backends.set(4102, {
      pid: 4102,
      xid: 728898,
      virtualXid: '4/45',
      clientAddr: '10.0.1.18:49210',
      applicationName: 'seamless_engine_worker_pool_01',
      database: 'playall_casino_db',
      userName: 'seamless_app_role',
      state: 'idle_in_transaction',
      isolationLevel: 'REPEATABLE READ',
      query: 'SELECT id, real_balance FROM wallets WHERE user_id = $1 FOR UPDATE;',
      heldLocks: [],
      waitingOnLock: null,
      startedAt: now - 120,
      durationMs: 120,
      xmin: 728895,
      xmax: 0,
      cmin: 1,
      cmax: 1
    });

    // Session 3: Realtime Webhook Dispatcher
    this.backends.set(4103, {
      pid: 4103,
      xid: 728900,
      virtualXid: '5/18',
      clientAddr: '10.0.1.22:38902',
      applicationName: 'webhook_dispatcher_pool_02',
      database: 'playall_casino_db',
      userName: 'webhook_role',
      state: 'active',
      isolationLevel: 'READ COMMITTED',
      query: 'INSERT INTO transactions (id, type, amount, status) VALUES ($1, $2, $3, $4);',
      heldLocks: ['transactions:tuple_insert'],
      waitingOnLock: null,
      startedAt: now - 45,
      durationMs: 45,
      xmin: 728899,
      xmax: 0,
      cmin: 2,
      cmax: 2
    });

    // Initial lock entry
    this.activeLocks.set('transactions:tuple_insert', {
      id: 'lock_init_01',
      relation: 'transactions',
      tupleKey: 'tx_latest_head',
      lockMode: 'ExclusiveLock (UPDATE/INSERT)',
      holderPid: 4103,
      holderXid: 728900,
      granted: true,
      waitQueue: [],
      acquiredAt: now - 45,
      durationMs: 45
    });

    this.addHistoryEntry({
      pid: 4103,
      xid: 728900,
      relation: 'transactions',
      tupleKey: 'tx_latest_head',
      lockMode: 'ExclusiveLock (UPDATE/INSERT)',
      action: 'LOCK_GRANTED',
      durationMs: 45,
      details: 'Exclusive row lock acquired for atomic ledger insert.'
    });
  }

  private startMetricsTicker() {
    setInterval(() => {
      // Update durations on active sessions and locks
      const now = Date.now();
      this.backends.forEach((backend) => {
        if (backend.state === 'active' || backend.state === 'waiting_on_lock' || backend.state === 'idle_in_transaction') {
          backend.durationMs = now - backend.startedAt;
        }
      });

      this.activeLocks.forEach((lock) => {
        if (lock.granted) {
          lock.durationMs = now - lock.acquiredAt;
        }
      });

      this.emitChange();
    }, 1000);
  }

  private addHistoryEntry(entry: Omit<LockHistoryEntry, 'id' | 'timestamp' | 'timeLabel'>) {
    const now = Date.now();
    const newEntry: LockHistoryEntry = {
      ...entry,
      id: `lhist_${now}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: now,
      timeLabel: new Date(now).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
      })
    };
    this.history.unshift(newEntry);
    if (this.history.length > 250) {
      this.history.pop();
    }
  }

  public getSnapshot() {
    const backendsList = Array.from(this.backends.values());
    const locksList = Array.from(this.activeLocks.values());
    const metrics = this.computeMetrics();
    return {
      backends: backendsList,
      locks: locksList,
      history: [...this.history],
      metrics
    };
  }

  public subscribe(
    callback: (state: {
      backends: PostgresBackendSession[];
      locks: PostgresRowLock[];
      history: LockHistoryEntry[];
      metrics: AcidLockMetrics;
    }) => void
  ): () => void {
    this.listeners.push(callback);
    callback(this.getSnapshot());
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private emitChange() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((cb) => {
      try {
        cb(snapshot);
      } catch (err) {
        console.error('Error in ACID Lock Tracker listener:', err);
      }
    });
  }

  private computeMetrics(): AcidLockMetrics {
    const backends = Array.from(this.backends.values());
    const activeBackends = backends.filter((b) => b.state !== 'committed' && b.state !== 'aborted');
    const locks = Array.from(this.activeLocks.values());
    const totalHeld = locks.filter((l) => l.granted).length;
    const totalWaiting = locks.reduce((acc, l) => acc + l.waitQueue.length, 0);

    let totalDuration = 0;
    locks.forEach((l) => (totalDuration += l.durationMs));
    const avgDuration = locks.length > 0 ? totalDuration / locks.length : 0.42;

    return {
      activeBackendsCount: activeBackends.length,
      activeTransactionsCount: backends.filter((b) => b.state === 'active' || b.state === 'waiting_on_lock' || b.state === 'idle_in_transaction').length,
      totalLocksHeld: totalHeld,
      lockWaitQueueLength: totalWaiting,
      deadlocksResolvedCount: this.deadlocksResolved,
      totalTransactionsCommitted: this.txCommittedCount,
      totalTransactionsRolledBack: this.txRolledBackCount,
      averageLockDurationMs: Number(avgDuration.toFixed(2)),
      mvccSnapshotIsolationOk: true
    };
  }

  /**
   * Registers a real-time row lock when an actual seamless engine operation executes.
   */
  public registerLiveRowLock(
    relation: 'wallets' | 'users' | 'transactions' | 'game_rounds' | 'idempotency_keys',
    tupleKey: string,
    lockMode: LockMode = 'RowExclusiveLock (FOR UPDATE)',
    query: string = 'SELECT * FROM wallets WHERE id = $1 FOR UPDATE;'
  ): () => void {
    const pid = this.nextPid++;
    const xid = this.nextXid++;
    const now = Date.now();
    const lockKey = `${relation}:${tupleKey}`;

    const session: PostgresBackendSession = {
      pid,
      xid,
      virtualXid: `${Math.floor(pid / 1000)}/${pid % 1000}`,
      clientAddr: '10.0.1.45:51200',
      applicationName: `seamless_api_${relation}_handler`,
      database: 'playall_casino_db',
      userName: 'seamless_app_role',
      state: 'active',
      isolationLevel: 'REPEATABLE READ',
      query,
      currentLockTarget: lockKey,
      heldLocks: [lockKey],
      waitingOnLock: null,
      startedAt: now,
      durationMs: 0,
      xmin: xid - 2,
      xmax: 0,
      cmin: 0,
      cmax: 0
    };

    this.backends.set(pid, session);

    const existingLock = this.activeLocks.get(lockKey);
    if (!existingLock || !existingLock.granted) {
      this.activeLocks.set(lockKey, {
        id: `lock_${now}_${pid}`,
        relation,
        tupleKey,
        lockMode,
        holderPid: pid,
        holderXid: xid,
        granted: true,
        waitQueue: [],
        acquiredAt: now,
        durationMs: 0
      });

      this.addHistoryEntry({
        pid,
        xid,
        relation,
        tupleKey,
        lockMode,
        action: 'LOCK_GRANTED',
        durationMs: 0,
        details: `Granted ${lockMode} on tuple [${tupleKey}]`
      });
    } else {
      // Enqueue as waiter
      existingLock.waitQueue.push({
        pid,
        xid,
        appName: session.applicationName,
        requestedMode: lockMode,
        waitingSince: now
      });
      session.state = 'waiting_on_lock';
      session.waitingOnLock = lockKey;
      session.waitingSince = now;

      this.addHistoryEntry({
        pid,
        xid,
        relation,
        tupleKey,
        lockMode,
        action: 'WAIT_ENQUEUED',
        durationMs: 0,
        details: `Lock conflict: PID ${pid} enqueued in wait queue behind holder PID ${existingLock.holderPid}`
      });
    }

    this.emitChange();

    // Return release lock callback
    return () => {
      const releaseNow = Date.now();
      const holdDuration = releaseNow - now;

      const currentLock = this.activeLocks.get(lockKey);
      if (currentLock && currentLock.holderPid === pid) {
        if (currentLock.waitQueue.length > 0) {
          // Grant next waiter in FIFO queue
          const nextWaiter = currentLock.waitQueue.shift()!;
          currentLock.holderPid = nextWaiter.pid;
          currentLock.holderXid = nextWaiter.xid;
          currentLock.acquiredAt = releaseNow;
          currentLock.durationMs = 0;

          const nextBackend = this.backends.get(nextWaiter.pid);
          if (nextBackend) {
            nextBackend.state = 'active';
            nextBackend.waitingOnLock = null;
            nextBackend.heldLocks.push(lockKey);
          }

          this.addHistoryEntry({
            pid: nextWaiter.pid,
            xid: nextWaiter.xid,
            relation,
            tupleKey,
            lockMode: nextWaiter.requestedMode,
            action: 'LOCK_GRANTED',
            durationMs: releaseNow - nextWaiter.waitingSince,
            details: `Lock granted to queued waiter PID ${nextWaiter.pid} after ${releaseNow - nextWaiter.waitingSince}ms wait.`
          });
        } else {
          this.activeLocks.delete(lockKey);
        }
      }

      const closedSession = this.backends.get(pid);
      if (closedSession) {
        closedSession.state = 'committed';
        closedSession.durationMs = holdDuration;
        this.txCommittedCount++;
      }

      this.addHistoryEntry({
        pid,
        xid,
        relation,
        tupleKey,
        lockMode,
        action: 'LOCK_RELEASED',
        durationMs: holdDuration,
        details: `Transaction committed and released row lock on [${tupleKey}] in ${holdDuration}ms.`
      });

      // Prune committed sessions after 4 seconds to keep list clean
      setTimeout(() => {
        this.backends.delete(pid);
        this.emitChange();
      }, 4000);

      this.emitChange();
    };
  }

  // --------------------------------------------------------------------------
  // INTERACTIVE SIMULATION DEMOS FOR IGAMING ARCHITECTS
  // --------------------------------------------------------------------------

  /**
   * Scenario 1: High Concurrency Contention on Single Wallet Row
   * Demonstrates 5 parallel transactions serializing cleanly via Two-Phase Locking without race conditions.
   */
  public async simulateConcurrentContention(
    walletKey: string = 'wallet:player_sakib:BDT',
    workersCount: number = 5
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    for (let i = 0; i < workersCount; i++) {
      const p = new Promise<void>((resolve) => {
        setTimeout(() => {
          const release = this.registerLiveRowLock(
            'wallets',
            walletKey,
            'RowExclusiveLock (FOR UPDATE)',
            `-- Worker Thread #${i + 1} (Concurrent Bet)\nSELECT id, real_balance FROM wallets WHERE id = '${walletKey}' FOR UPDATE;`
          );

          // Simulate processing time inside transaction
          const holdTime = 300 + Math.random() * 400;
          setTimeout(() => {
            release();
            resolve();
          }, holdTime);
        }, i * 80); // Stagger requests slightly to show lock wait queue buildup
      });

      promises.push(p);
    }

    await Promise.all(promises);
  }

  /**
   * Scenario 2: Two-Phase Commit / 2PL Distributed Transfer
   * Transaction acquires locks on Wallet A then Wallet B in deterministic sorted order.
   */
  public async simulateTwoPhaseTransfer(
    walletA: string = 'wallet:user_alpha:USD',
    walletB: string = 'wallet:user_beta:USD',
    amount: number = 100
  ): Promise<void> {
    // Deterministic sorted order to prevent deadlocks: A < B
    const sortedKeys = [walletA, walletB].sort();

    const releaseA = this.registerLiveRowLock(
      'wallets',
      sortedKeys[0],
      'RowExclusiveLock (FOR UPDATE)',
      `BEGIN; -- 2PL Distributed Transfer\nSELECT * FROM wallets WHERE id = '${sortedKeys[0]}' FOR UPDATE;`
    );

    await new Promise((r) => setTimeout(r, 250));

    const releaseB = this.registerLiveRowLock(
      'wallets',
      sortedKeys[1],
      'RowExclusiveLock (FOR UPDATE)',
      `SELECT * FROM wallets WHERE id = '${sortedKeys[1]}' FOR UPDATE;\nUPDATE wallets SET real_balance = real_balance + ${amount} WHERE id = '${sortedKeys[1]}';`
    );

    await new Promise((r) => setTimeout(r, 450));

    // Release both on COMMIT
    releaseA();
    releaseB();
  }

  /**
   * Scenario 3: Deadlock Cycle Simulation & Automatic 40P01 Error Resolution
   * Tx 1 locks A -> tries to lock B
   * Tx 2 locks B -> tries to lock A
   * PostgreSQL Deadlock Detector fires after timeout, aborts Tx 2 with 40P01, Tx 1 succeeds!
   */
  public async simulateDeadlockDetection(
    walletA: string = 'wallet:account_01:USD',
    walletB: string = 'wallet:account_02:USD'
  ): Promise<void> {
    const pid1 = this.nextPid++;
    const xid1 = this.nextXid++;
    const pid2 = this.nextPid++;
    const xid2 = this.nextXid++;
    const now = Date.now();

    const session1: PostgresBackendSession = {
      pid: pid1,
      xid: xid1,
      virtualXid: `7/${pid1 % 100}`,
      clientAddr: '10.0.1.50:48201',
      applicationName: 'tx1_worker_thread',
      database: 'playall_casino_db',
      userName: 'seamless_app_role',
      state: 'active',
      isolationLevel: 'REPEATABLE READ',
      query: `BEGIN; SELECT * FROM wallets WHERE id = '${walletA}' FOR UPDATE;`,
      currentLockTarget: `wallets:${walletA}`,
      heldLocks: [`wallets:${walletA}`],
      waitingOnLock: null,
      startedAt: now,
      durationMs: 0,
      xmin: xid1 - 1,
      xmax: 0,
      cmin: 0,
      cmax: 0
    };

    const session2: PostgresBackendSession = {
      pid: pid2,
      xid: xid2,
      virtualXid: `8/${pid2 % 100}`,
      clientAddr: '10.0.1.51:48202',
      applicationName: 'tx2_worker_thread',
      database: 'playall_casino_db',
      userName: 'seamless_app_role',
      state: 'active',
      isolationLevel: 'REPEATABLE READ',
      query: `BEGIN; SELECT * FROM wallets WHERE id = '${walletB}' FOR UPDATE;`,
      currentLockTarget: `wallets:${walletB}`,
      heldLocks: [`wallets:${walletB}`],
      waitingOnLock: null,
      startedAt: now,
      durationMs: 0,
      xmin: xid2 - 1,
      xmax: 0,
      cmin: 0,
      cmax: 0
    };

    this.backends.set(pid1, session1);
    this.backends.set(pid2, session2);

    this.activeLocks.set(`wallets:${walletA}`, {
      id: `lock_dl_${pid1}`,
      relation: 'wallets',
      tupleKey: walletA,
      lockMode: 'RowExclusiveLock (FOR UPDATE)',
      holderPid: pid1,
      holderXid: xid1,
      granted: true,
      waitQueue: [],
      acquiredAt: now,
      durationMs: 0
    });

    this.activeLocks.set(`wallets:${walletB}`, {
      id: `lock_dl_${pid2}`,
      relation: 'wallets',
      tupleKey: walletB,
      lockMode: 'RowExclusiveLock (FOR UPDATE)',
      holderPid: pid2,
      holderXid: xid2,
      granted: true,
      waitQueue: [],
      acquiredAt: now,
      durationMs: 0
    });

    this.addHistoryEntry({
      pid: pid1,
      xid: xid1,
      relation: 'wallets',
      tupleKey: walletA,
      lockMode: 'RowExclusiveLock (FOR UPDATE)',
      action: 'LOCK_GRANTED',
      durationMs: 0,
      details: `Tx1 (PID ${pid1}) acquired exclusive row lock on [${walletA}]`
    });

    this.addHistoryEntry({
      pid: pid2,
      xid: xid2,
      relation: 'wallets',
      tupleKey: walletB,
      lockMode: 'RowExclusiveLock (FOR UPDATE)',
      action: 'LOCK_GRANTED',
      durationMs: 0,
      details: `Tx2 (PID ${pid2}) acquired exclusive row lock on [${walletB}]`
    });

    this.emitChange();

    // Step 2: Tx1 tries to acquire lock on B (Blocked by Tx2)
    await new Promise((r) => setTimeout(r, 400));
    session1.query = `SELECT * FROM wallets WHERE id = '${walletB}' FOR UPDATE; -- BLOCKED`;
    session1.state = 'waiting_on_lock';
    session1.waitingOnLock = `wallets:${walletB}`;
    session1.waitingSince = Date.now();

    const lockB = this.activeLocks.get(`wallets:${walletB}`);
    if (lockB) {
      lockB.waitQueue.push({
        pid: pid1,
        xid: xid1,
        appName: session1.applicationName,
        requestedMode: 'RowExclusiveLock (FOR UPDATE)',
        waitingSince: Date.now()
      });
    }

    this.addHistoryEntry({
      pid: pid1,
      xid: xid1,
      relation: 'wallets',
      tupleKey: walletB,
      lockMode: 'RowExclusiveLock (FOR UPDATE)',
      action: 'WAIT_ENQUEUED',
      durationMs: 0,
      details: `Tx1 wants lock on [${walletB}] -> enqueued in wait queue (blocked by Tx2 PID ${pid2})`
    });

    this.emitChange();

    // Step 3: Tx2 tries to acquire lock on A (Deadlock Cycle Formed!)
    await new Promise((r) => setTimeout(r, 400));
    session2.query = `SELECT * FROM wallets WHERE id = '${walletA}' FOR UPDATE; -- DEADLOCK CYCLE`;
    session2.state = 'waiting_on_lock';
    session2.waitingOnLock = `wallets:${walletA}`;
    session2.waitingSince = Date.now();

    const lockA = this.activeLocks.get(`wallets:${walletA}`);
    if (lockA) {
      lockA.waitQueue.push({
        pid: pid2,
        xid: xid2,
        appName: session2.applicationName,
        requestedMode: 'RowExclusiveLock (FOR UPDATE)',
        waitingSince: Date.now()
      });
    }

    this.addHistoryEntry({
      pid: pid2,
      xid: xid2,
      relation: 'wallets',
      tupleKey: walletA,
      lockMode: 'RowExclusiveLock (FOR UPDATE)',
      action: 'DEADLOCK_DETECTED',
      durationMs: 0,
      details: `DEADLOCK CYCLE DETECTED! Cycle: Tx1 (PID ${pid1}) waits on [${walletB}] held by Tx2; Tx2 (PID ${pid2}) waits on [${walletA}] held by Tx1.`
    });

    this.emitChange();

    // Step 4: PostgreSQL Deadlock Detector fires (deadlock_timeout = 800ms)
    await new Promise((r) => setTimeout(r, 800));

    this.deadlocksResolved++;
    this.txRolledBackCount++;

    // Abort Tx 2 (Victim Transaction) with Error 40P01
    session2.state = 'deadlock_rolled_back';
    session2.query = `ROLLBACK; -- ERROR: deadlock detected (SQLSTATE 40P01)`;
    session2.waitingOnLock = null;
    session2.heldLocks = [];

    // Remove Tx 2 from Lock A's wait queue and delete Lock B held by Tx 2
    if (lockA) {
      lockA.waitQueue = lockA.waitQueue.filter((w) => w.pid !== pid2);
    }
    this.activeLocks.delete(`wallets:${walletB}`);

    this.addHistoryEntry({
      pid: pid2,
      xid: xid2,
      relation: 'wallets',
      tupleKey: walletB,
      lockMode: 'RowExclusiveLock (FOR UPDATE)',
      action: 'ROLLED_BACK',
      durationMs: Date.now() - session2.startedAt,
      details: `PostgreSQL Deadlock Detector aborted victim Tx2 (PID ${pid2}) with error 40P01. Released [${walletB}].`
    });

    // Step 5: Tx 1 can now acquire Lock B and COMMIT!
    session1.state = 'active';
    session1.waitingOnLock = null;
    session1.heldLocks.push(`wallets:${walletB}`);

    this.activeLocks.set(`wallets:${walletB}`, {
      id: `lock_dl_${pid1}_b`,
      relation: 'wallets',
      tupleKey: walletB,
      lockMode: 'RowExclusiveLock (FOR UPDATE)',
      holderPid: pid1,
      holderXid: xid1,
      granted: true,
      waitQueue: [],
      acquiredAt: Date.now(),
      durationMs: 0
    });

    this.emitChange();

    // Step 6: Tx 1 finishes successfully
    await new Promise((r) => setTimeout(r, 600));
    session1.state = 'committed';
    session1.query = `COMMIT; -- SUCCESS`;
    this.activeLocks.delete(`wallets:${walletA}`);
    this.activeLocks.delete(`wallets:${walletB}`);
    this.txCommittedCount++;

    this.addHistoryEntry({
      pid: pid1,
      xid: xid1,
      relation: 'wallets',
      tupleKey: walletA,
      lockMode: 'RowExclusiveLock (FOR UPDATE)',
      action: 'COMMITTED',
      durationMs: Date.now() - session1.startedAt,
      details: `Tx1 (PID ${pid1}) acquired all locks and committed successfully.`
    });

    this.emitChange();

    setTimeout(() => {
      this.backends.delete(pid1);
      this.backends.delete(pid2);
      this.emitChange();
    }, 4000);
  }

  /**
   * Scenario 4: MVCC Non-blocking Snapshot Read
   * Demonstrates PostgreSQL MVCC: long-running SELECT reporting query reads consistent snapshot tuple
   * without blocking or being blocked by concurrent UPDATE / FOR UPDATE locks!
   */
  public async simulateMvccSnapshotRead(
    walletKey: string = 'wallet:player_maria:USD'
  ): Promise<void> {
    const readerPid = this.nextPid++;
    const readerXid = this.nextXid++;
    const writerPid = this.nextPid++;
    const writerXid = this.nextXid++;
    const now = Date.now();

    // Reader starts with MVCC Snapshot
    const readerSession: PostgresBackendSession = {
      pid: readerPid,
      xid: readerXid,
      virtualXid: `9/${readerPid % 100}`,
      clientAddr: '10.0.1.60:50100',
      applicationName: 'reporting_dashboard_stream',
      database: 'playall_casino_db',
      userName: 'readonly_analytics',
      state: 'active',
      isolationLevel: 'REPEATABLE READ',
      query: `SELECT SUM(real_balance) FROM wallets; -- MVCC Snapshot (xmin: ${readerXid})`,
      currentLockTarget: `wallets:${walletKey}`,
      heldLocks: [`wallets:${walletKey}:access_share`],
      waitingOnLock: null,
      startedAt: now,
      durationMs: 0,
      xmin: readerXid,
      xmax: 0,
      cmin: 0,
      cmax: 0
    };

    this.backends.set(readerPid, readerSession);

    this.addHistoryEntry({
      pid: readerPid,
      xid: readerXid,
      relation: 'wallets',
      tupleKey: walletKey,
      lockMode: 'AccessShareLock (SELECT)',
      action: 'LOCK_GRANTED',
      durationMs: 0,
      details: `MVCC Snapshot Created: Reader PID ${readerPid} reading snapshot with AccessShareLock (Non-blocking).`
    });

    this.emitChange();

    // Concurrently, Writer updates the row with RowExclusiveLock
    await new Promise((r) => setTimeout(r, 200));

    const writerSession: PostgresBackendSession = {
      pid: writerPid,
      xid: writerXid,
      virtualXid: `10/${writerPid % 100}`,
      clientAddr: '10.0.1.61:50101',
      applicationName: 'seamless_bet_processor',
      database: 'playall_casino_db',
      userName: 'seamless_app_role',
      state: 'active',
      isolationLevel: 'READ COMMITTED',
      query: `UPDATE wallets SET real_balance = real_balance - 50 WHERE id = '${walletKey}';`,
      currentLockTarget: `wallets:${walletKey}`,
      heldLocks: [`wallets:${walletKey}`],
      waitingOnLock: null,
      startedAt: Date.now(),
      durationMs: 0,
      xmin: writerXid,
      xmax: 0,
      cmin: 1,
      cmax: 1
    };

    this.backends.set(writerPid, writerSession);
    this.activeLocks.set(`wallets:${walletKey}`, {
      id: `lock_writer_${writerPid}`,
      relation: 'wallets',
      tupleKey: walletKey,
      lockMode: 'RowExclusiveLock (FOR UPDATE)',
      holderPid: writerPid,
      holderXid: writerXid,
      granted: true,
      waitQueue: [],
      acquiredAt: Date.now(),
      durationMs: 0
    });

    this.addHistoryEntry({
      pid: writerPid,
      xid: writerXid,
      relation: 'wallets',
      tupleKey: walletKey,
      lockMode: 'RowExclusiveLock (FOR UPDATE)',
      action: 'LOCK_GRANTED',
      durationMs: 0,
      details: `Writer PID ${writerPid} acquired RowExclusiveLock without waiting for Reader! MVCC allows simultaneous read & write.`
    });

    this.emitChange();

    // Both finish cleanly
    await new Promise((r) => setTimeout(r, 600));
    this.activeLocks.delete(`wallets:${walletKey}`);
    readerSession.state = 'committed';
    writerSession.state = 'committed';
    this.txCommittedCount += 2;

    this.addHistoryEntry({
      pid: readerPid,
      xid: readerXid,
      relation: 'wallets',
      tupleKey: walletKey,
      lockMode: 'AccessShareLock (SELECT)',
      action: 'COMMITTED',
      durationMs: Date.now() - readerSession.startedAt,
      details: `MVCC demonstration completed. Zero lock contention between SELECT reader and UPDATE writer.`
    });

    this.emitChange();

    setTimeout(() => {
      this.backends.delete(readerPid);
      this.backends.delete(writerPid);
      this.emitChange();
    }, 4000);
  }

  /**
   * Resets all simulated state to baseline.
   */
  public resetToDefault(): void {
    this.backends.clear();
    this.activeLocks.clear();
    this.history = [];
    this.seedInitialSessions();
    this.emitChange();
  }
}

export const acidLockTrackerService = new AcidLockTrackerService();
