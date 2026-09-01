/**
 * @file DeadlockSimulator.tsx
 * @description Interactive PostgreSQL Row-Level Locking & Deadlock Simulator for iGaming Architects.
 * Demonstrates 2PL (Two-Phase Locking), SELECT ... FOR UPDATE, Lock Wait Queues,
 * Deadlock Graph Cycle Detection (Error 40P01), and Deterministic Sorted Lock Ordering Solutions.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  Unlock,
  AlertOctagon,
  Play,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  Activity,
  GitFork,
  ArrowRight,
  Sparkles,
  Zap,
  Layers,
  ChevronRight,
  Info,
  Sliders,
  RefreshCw,
  Cpu,
  Share2
} from 'lucide-react';
import { UserEntity, WalletEntity } from '../server/types/seamless';
import { seamlessEngine } from '../services/simulatedWalletEngine';
import { ForceDirectedLockGraph } from './ForceDirectedLockGraph';

interface DeadlockSimulatorProps {
  currentUser: UserEntity;
  currentWallet?: WalletEntity;
  onLedgerMutated: () => void;
}

type SimulationScenario = 'deadlock_cycle' | 'same_row_contention' | 'sorted_order_solution';

interface LogEntry {
  id: string;
  timestamp: string;
  pid: number;
  threadName: string;
  threadColor: string;
  type: 'sql' | 'lock' | 'wait' | 'deadlock' | 'rollback' | 'commit' | 'info';
  message: string;
  query?: string;
}

interface WorkerState {
  id: string;
  name: string;
  pid: number;
  color: string;
  status: 'idle' | 'running' | 'waiting' | 'committed' | 'aborted';
  step: number;
  currentAction: string;
  heldLocks: string[];
  waitingOnLock: string | null;
  transferredAmount?: number;
}

export const DeadlockSimulator: React.FC<DeadlockSimulatorProps> = ({
  currentUser,
  currentWallet,
  onLedgerMutated
}) => {
  const [scenario, setScenario] = useState<SimulationScenario>('deadlock_cycle');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [stepMode, setStepMode] = useState<boolean>(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(800); // ms per step
  const [deadlockTimeoutMs, setDeadlockTimeoutMs] = useState<number>(1000);
  const [activeCycleDetected, setActiveCycleDetected] = useState<boolean>(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Simulated Wallets State
  const [walletA, setWalletA] = useState<{ id: string; name: string; balance: number; lockHolder: string | null; lockWaiters: string[] }>({
    id: 'w_sakib_01',
    name: 'Wallet A (Sakib - Dhaka)',
    balance: 5000.0,
    lockHolder: null,
    lockWaiters: []
  });

  const [walletB, setWalletB] = useState<{ id: string; name: string; balance: number; lockHolder: string | null; lockWaiters: string[] }>({
    id: 'w_maria_02',
    name: 'Wallet B (Maria - Berlin)',
    balance: 3500.0,
    lockHolder: null,
    lockWaiters: []
  });

  // Workers
  const [workers, setWorkers] = useState<WorkerState[]>([
    {
      id: 'T1',
      name: 'Tx-1: Pragmatic Provider',
      pid: 14820,
      color: 'cyan',
      status: 'idle',
      step: 0,
      currentAction: 'Idle (Awaiting transaction dispatch)',
      heldLocks: [],
      waitingOnLock: null,
      transferredAmount: 500
    },
    {
      id: 'T2',
      name: 'Tx-2: Evolution Provider',
      pid: 14821,
      color: 'amber',
      status: 'idle',
      step: 0,
      currentAction: 'Idle (Awaiting transaction dispatch)',
      heldLocks: [],
      waitingOnLock: null,
      transferredAmount: 300
    }
  ]);

  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll console
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (
    pid: number,
    threadName: string,
    threadColor: string,
    type: LogEntry['type'],
    message: string,
    query?: string
  ) => {
    const now = new Date();
    const timeStr = `${now.toTimeString().split(' ')[0]}.${String(now.getMilliseconds()).padStart(3, '0')}`;
    setLogs((prev) => [
      ...prev,
      {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        timestamp: timeStr,
        pid,
        threadName,
        threadColor,
        type,
        message,
        query
      }
    ]);
  };

  const resetSimulation = () => {
    setIsRunning(false);
    setActiveCycleDetected(false);
    setCurrentStepIndex(0);
    setWalletA({
      id: 'w_sakib_01',
      name: 'Wallet A (Sakib - Dhaka)',
      balance: 5000.0,
      lockHolder: null,
      lockWaiters: []
    });
    setWalletB({
      id: 'w_maria_02',
      name: 'Wallet B (Maria - Berlin)',
      balance: 3500.0,
      lockHolder: null,
      lockWaiters: []
    });

    if (scenario === 'same_row_contention') {
      setWorkers([
        { id: 'T1', name: 'Tx-1: Pragmatic Bet ($100)', pid: 14820, color: 'cyan', status: 'idle', step: 0, currentAction: 'Ready', heldLocks: [], waitingOnLock: null },
        { id: 'T2', name: 'Tx-2: Evolution Bet ($150)', pid: 14821, color: 'amber', status: 'idle', step: 0, currentAction: 'Ready', heldLocks: [], waitingOnLock: null },
        { id: 'T3', name: 'Tx-3: PGSoft Bet ($200)', pid: 14822, color: 'purple', status: 'idle', step: 0, currentAction: 'Ready', heldLocks: [], waitingOnLock: null },
        { id: 'T4', name: 'Tx-4: Spribe Win ($300)', pid: 14823, color: 'emerald', status: 'idle', step: 0, currentAction: 'Ready', heldLocks: [], waitingOnLock: null }
      ]);
    } else {
      setWorkers([
        {
          id: 'T1',
          name: 'Tx-1: Transfer A -> B ($500)',
          pid: 14820,
          color: 'cyan',
          status: 'idle',
          step: 0,
          currentAction: 'Ready to acquire Lock on Wallet A',
          heldLocks: [],
          waitingOnLock: null,
          transferredAmount: 500
        },
        {
          id: 'T2',
          name: scenario === 'sorted_order_solution' ? 'Tx-2: Transfer B -> A ($300) [Sorted Order]' : 'Tx-2: Transfer B -> A ($300) [Inverted Order]',
          pid: 14821,
          color: 'amber',
          status: 'idle',
          step: 0,
          currentAction: 'Ready to acquire Lock',
          heldLocks: [],
          waitingOnLock: null,
          transferredAmount: 300
        }
      ]);
    }

    setLogs([
      {
        id: 'init_1',
        timestamp: new Date().toTimeString().split(' ')[0],
        pid: 14800,
        threadName: 'POSTGRES_DAEMON',
        threadColor: 'slate',
        type: 'info',
        message: `PostgreSQL 15.4 Session Initialized. deadlock_timeout = ${deadlockTimeoutMs}ms. Ready for simulation.`
      }
    ]);
  };

  useEffect(() => {
    resetSimulation();
  }, [scenario, deadlockTimeoutMs]);

  // Execute Scenario 1: Deadlock Cycle
  const runDeadlockCycleSimulation = async () => {
    setIsRunning(true);
    resetSimulation();
    await new Promise((r) => setTimeout(r, 200));

    // Step 1: Both start transactions
    addLog(14820, 'Tx-1 (T1)', 'cyan', 'sql', 'BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;');
    addLog(14821, 'Tx-2 (T2)', 'amber', 'sql', 'BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;');

    setWorkers((prev) => [
      { ...prev[0], status: 'running', step: 1, currentAction: 'Executing: BEGIN' },
      { ...prev[1], status: 'running', step: 1, currentAction: 'Executing: BEGIN' }
    ]);
    await new Promise((r) => setTimeout(r, simulationSpeed));

    // Step 2: T1 locks Wallet A
    addLog(14820, 'Tx-1 (T1)', 'cyan', 'sql', 'SELECT * FROM wallets WHERE id = \'w_sakib_01\' FOR UPDATE;', 'SELECT * FROM wallets WHERE id = \'w_sakib_01\' FOR UPDATE;');
    addLog(14820, 'Tx-1 (T1)', 'cyan', 'lock', 'LockManager: ExclusiveLock acquired on tuple (0,1) [Wallet A]');
    setWalletA((w) => ({ ...w, lockHolder: 'T1' }));
    setWorkers((prev) => [
      { ...prev[0], status: 'running', step: 2, currentAction: 'Acquired Lock on Wallet A. Processing calculation...', heldLocks: ['Wallet A'] },
      prev[1]
    ]);
    await new Promise((r) => setTimeout(r, simulationSpeed / 2));

    // Step 3: T2 locks Wallet B (Inverted order!)
    addLog(14821, 'Tx-2 (T2)', 'amber', 'sql', 'SELECT * FROM wallets WHERE id = \'w_maria_02\' FOR UPDATE;', 'SELECT * FROM wallets WHERE id = \'w_maria_02\' FOR UPDATE;');
    addLog(14821, 'Tx-2 (T2)', 'amber', 'lock', 'LockManager: ExclusiveLock acquired on tuple (0,2) [Wallet B]');
    setWalletB((w) => ({ ...w, lockHolder: 'T2' }));
    setWorkers((prev) => [
      prev[0],
      { ...prev[1], status: 'running', step: 2, currentAction: 'Acquired Lock on Wallet B. Processing calculation...', heldLocks: ['Wallet B'] }
    ]);
    await new Promise((r) => setTimeout(r, simulationSpeed));

    // Step 4: T1 tries to lock Wallet B (Blocked by T2)
    addLog(14820, 'Tx-1 (T1)', 'cyan', 'sql', 'SELECT * FROM wallets WHERE id = \'w_maria_02\' FOR UPDATE;', 'SELECT * FROM wallets WHERE id = \'w_maria_02\' FOR UPDATE;');
    addLog(14820, 'Tx-1 (T1)', 'cyan', 'wait', 'LockManager: Tuple (0,2) [Wallet B] is locked by Tx-2 (PID 14821). Tx-1 entering LockWait...');
    setWalletB((w) => ({ ...w, lockWaiters: ['T1'] }));
    setWorkers((prev) => [
      { ...prev[0], status: 'waiting', step: 3, currentAction: 'LOCK_WAIT: Blocked by Tx-2 on Wallet B', waitingOnLock: 'Wallet B' },
      prev[1]
    ]);
    await new Promise((r) => setTimeout(r, simulationSpeed));

    // Step 5: T2 tries to lock Wallet A (Blocked by T1) -> CYCLE FORMED!
    addLog(14821, 'Tx-2 (T2)', 'amber', 'sql', 'SELECT * FROM wallets WHERE id = \'w_sakib_01\' FOR UPDATE;', 'SELECT * FROM wallets WHERE id = \'w_sakib_01\' FOR UPDATE;');
    addLog(14821, 'Tx-2 (T2)', 'amber', 'wait', 'LockManager: Tuple (0,1) [Wallet A] is locked by Tx-1 (PID 14820). Tx-2 entering LockWait...');
    setWalletA((w) => ({ ...w, lockWaiters: ['T2'] }));
    setWorkers((prev) => [
      prev[0],
      { ...prev[1], status: 'waiting', step: 3, currentAction: 'LOCK_WAIT: Blocked by Tx-1 on Wallet A', waitingOnLock: 'Wallet A' }
    ]);

    // Graph cycle formation alert
    setActiveCycleDetected(true);
    await new Promise((r) => setTimeout(r, simulationSpeed));

    // Step 6: Deadlock timeout triggers graph traversal
    addLog(14800, 'DEADLOCK_DETECTOR', 'slate', 'deadlock', `Deadlock search timer expired (${deadlockTimeoutMs}ms). Building Lock-Wait Graph...`);
    addLog(14800, 'DEADLOCK_DETECTOR', 'slate', 'deadlock', 'CYCLE DETECTED: [Tx-1 PID 14820] -> waits on Wallet B (held by Tx-2) -> [Tx-2 PID 14821] -> waits on Wallet A (held by Tx-1).');
    addLog(14821, 'Tx-2 (T2)', 'amber', 'deadlock', 'ERROR: 40P01: deadlock detected. DETAIL: Process 14821 waits for ExclusiveLock on tuple (0,1); blocked by process 14820. HINT: See server log for query details.');

    await new Promise((r) => setTimeout(r, simulationSpeed));

    // Step 7: Victim Chosen (Tx-2 aborted and rolled back)
    addLog(14821, 'Tx-2 (T2)', 'amber', 'rollback', 'ROLLBACK; (Transaction aborted by server kernel to resolve deadlock cycle). All locks on Wallet B released.');
    setWalletB((w) => ({ ...w, lockHolder: null }));
    setWalletA((w) => ({ ...w, lockWaiters: [] }));
    setWorkers((prev) => [
      prev[0],
      { ...prev[1], status: 'aborted', step: 4, currentAction: 'ABORTED: 40P01 Deadlock Victim (Rolled back)', heldLocks: [], waitingOnLock: null }
    ]);
    await new Promise((r) => setTimeout(r, simulationSpeed));

    // Step 8: Tx-1 unblocks and acquires Wallet B lock
    addLog(14820, 'Tx-1 (T1)', 'cyan', 'lock', 'LockManager: ExclusiveLock acquired on tuple (0,2) [Wallet B] following Tx-2 abort.');
    setWalletB((w) => ({ ...w, lockHolder: 'T1', lockWaiters: [] }));
    setWorkers((prev) => [
      { ...prev[0], status: 'running', step: 4, currentAction: 'Unblocked! Acquired Lock on Wallet B. Executing balance update...', heldLocks: ['Wallet A', 'Wallet B'], waitingOnLock: null },
      prev[1]
    ]);
    await new Promise((r) => setTimeout(r, simulationSpeed / 2));

    // Step 9: Tx-1 updates balances and commits
    addLog(14820, 'Tx-1 (T1)', 'cyan', 'sql', 'UPDATE wallets SET real_balance = real_balance - 500 WHERE id = \'w_sakib_01\';');
    addLog(14820, 'Tx-1 (T1)', 'cyan', 'sql', 'UPDATE wallets SET real_balance = real_balance + 500 WHERE id = \'w_maria_02\';');
    setWalletA((w) => ({ ...w, balance: w.balance - 500 }));
    setWalletB((w) => ({ ...w, balance: w.balance + 500 }));

    await new Promise((r) => setTimeout(r, simulationSpeed / 2));
    addLog(14820, 'Tx-1 (T1)', 'cyan', 'commit', 'COMMIT; Transaction committed. All row locks released to free pool.');
    setWalletA((w) => ({ ...w, lockHolder: null }));
    setWalletB((w) => ({ ...w, lockHolder: null }));

    setWorkers((prev) => [
      { ...prev[0], status: 'committed', step: 5, currentAction: 'COMMITTED: Transfer of $500 succeeded', heldLocks: [] },
      prev[1]
    ]);

    addLog(14800, 'POSTGRES_DAEMON', 'slate', 'info', 'Ledger financial integrity preserved: 1 transaction committed, 1 transaction aborted without corrupting balances.');
    setIsRunning(false);
  };

  // Execute Scenario 2: Same-Row Contention (Serialized Mutex Queue)
  const runSameRowContentionSimulation = async () => {
    setIsRunning(true);
    resetSimulation();
    await new Promise((r) => setTimeout(r, 200));

    addLog(14800, 'POSTGRES_DAEMON', 'slate', 'info', 'Fired 4 concurrent incoming game provider transactions targeting the same wallet row (w_sakib_01)...');

    // All threads start BEGIN
    addLog(14820, 'Tx-1 (Pragmatic)', 'cyan', 'sql', 'BEGIN;');
    addLog(14821, 'Tx-2 (Evolution)', 'amber', 'sql', 'BEGIN;');
    addLog(14822, 'Tx-3 (PGSoft)', 'purple', 'sql', 'BEGIN;');
    addLog(14823, 'Tx-4 (Spribe)', 'emerald', 'sql', 'BEGIN;');

    setWorkers((prev) => prev.map((w) => ({ ...w, status: 'running', step: 1, currentAction: 'Executing: BEGIN' })));
    await new Promise((r) => setTimeout(r, simulationSpeed));

    // Tx-1 wins the lock first
    addLog(14820, 'Tx-1 (Pragmatic)', 'cyan', 'sql', 'SELECT * FROM wallets WHERE id = \'w_sakib_01\' FOR UPDATE;');
    addLog(14820, 'Tx-1 (Pragmatic)', 'cyan', 'lock', 'ExclusiveLock acquired by Tx-1 on Wallet A.');
    setWalletA((w) => ({ ...w, lockHolder: 'T1', lockWaiters: ['T2', 'T3', 'T4'] }));

    setWorkers((prev) => [
      { ...prev[0], status: 'running', step: 2, currentAction: 'LOCK HELD: Processing $100 bet debit...', heldLocks: ['Wallet A'] },
      { ...prev[1], status: 'waiting', step: 2, currentAction: 'LOCK_WAIT: Queued behind T1', waitingOnLock: 'Wallet A' },
      { ...prev[2], status: 'waiting', step: 2, currentAction: 'LOCK_WAIT: Queued behind T1, T2', waitingOnLock: 'Wallet A' },
      { ...prev[3], status: 'waiting', step: 2, currentAction: 'LOCK_WAIT: Queued behind T1, T2, T3', waitingOnLock: 'Wallet A' }
    ]);
    addLog(14821, 'Tx-2 (Evolution)', 'amber', 'wait', 'Tx-2 entering LockWait queue on Wallet A...');
    addLog(14822, 'Tx-3 (PGSoft)', 'purple', 'wait', 'Tx-3 entering LockWait queue on Wallet A...');
    addLog(14823, 'Tx-4 (Spribe)', 'emerald', 'wait', 'Tx-4 entering LockWait queue on Wallet A...');
    await new Promise((r) => setTimeout(r, simulationSpeed));

    // Tx-1 completes and commits
    addLog(14820, 'Tx-1 (Pragmatic)', 'cyan', 'sql', 'UPDATE wallets SET real_balance = real_balance - 100 WHERE id = \'w_sakib_01\'; COMMIT;');
    setWalletA((w) => ({ ...w, balance: w.balance - 100 }));
    setWorkers((prev) => [
      { ...prev[0], status: 'committed', step: 3, currentAction: 'COMMITTED: $100 bet settled', heldLocks: [] },
      prev[1],
      prev[2],
      prev[3]
    ]);
    await new Promise((r) => setTimeout(r, simulationSpeed / 2));

    // Lock passes to Tx-2
    addLog(14821, 'Tx-2 (Evolution)', 'amber', 'lock', 'Lock granted to Tx-2 following Tx-1 commit.');
    setWalletA((w) => ({ ...w, lockHolder: 'T2', lockWaiters: ['T3', 'T4'] }));
    setWorkers((prev) => [
      prev[0],
      { ...prev[1], status: 'running', step: 3, currentAction: 'LOCK HELD: Processing $150 bet debit...', heldLocks: ['Wallet A'], waitingOnLock: null },
      prev[2],
      prev[3]
    ]);
    await new Promise((r) => setTimeout(r, simulationSpeed / 2));

    // Tx-2 commits
    addLog(14821, 'Tx-2 (Evolution)', 'amber', 'sql', 'UPDATE wallets SET real_balance = real_balance - 150 WHERE id = \'w_sakib_01\'; COMMIT;');
    setWalletA((w) => ({ ...w, balance: w.balance - 150 }));
    setWorkers((prev) => [
      prev[0],
      { ...prev[1], status: 'committed', step: 4, currentAction: 'COMMITTED: $150 bet settled', heldLocks: [] },
      prev[2],
      prev[3]
    ]);
    await new Promise((r) => setTimeout(r, simulationSpeed / 2));

    // Lock passes to Tx-3
    addLog(14822, 'Tx-3 (PGSoft)', 'purple', 'lock', 'Lock granted to Tx-3.');
    setWalletA((w) => ({ ...w, lockHolder: 'T3', lockWaiters: ['T4'] }));
    setWorkers((prev) => [
      prev[0],
      prev[1],
      { ...prev[2], status: 'running', step: 3, currentAction: 'LOCK HELD: Processing $200 bet debit...', heldLocks: ['Wallet A'], waitingOnLock: null },
      prev[3]
    ]);
    await new Promise((r) => setTimeout(r, simulationSpeed / 2));

    // Tx-3 commits
    addLog(14822, 'Tx-3 (PGSoft)', 'purple', 'sql', 'UPDATE wallets SET real_balance = real_balance - 200 WHERE id = \'w_sakib_01\'; COMMIT;');
    setWalletA((w) => ({ ...w, balance: w.balance - 200 }));
    setWorkers((prev) => [
      prev[0],
      prev[1],
      { ...prev[2], status: 'committed', step: 4, currentAction: 'COMMITTED: $200 bet settled', heldLocks: [] },
      prev[3]
    ]);
    await new Promise((r) => setTimeout(r, simulationSpeed / 2));

    // Lock passes to Tx-4
    addLog(14823, 'Tx-4 (Spribe)', 'emerald', 'lock', 'Lock granted to Tx-4.');
    setWalletA((w) => ({ ...w, lockHolder: 'T4', lockWaiters: [] }));
    setWorkers((prev) => [
      prev[0],
      prev[1],
      prev[2],
      { ...prev[3], status: 'running', step: 3, currentAction: 'LOCK HELD: Processing $300 win credit...', heldLocks: ['Wallet A'], waitingOnLock: null }
    ]);
    await new Promise((r) => setTimeout(r, simulationSpeed / 2));

    // Tx-4 commits
    addLog(14823, 'Tx-4 (Spribe)', 'emerald', 'sql', 'UPDATE wallets SET real_balance = real_balance + 300 WHERE id = \'w_sakib_01\'; COMMIT;');
    setWalletA((w) => ({ ...w, balance: w.balance + 300, lockHolder: null }));
    setWorkers((prev) => [
      prev[0],
      prev[1],
      prev[2],
      { ...prev[3], status: 'committed', step: 4, currentAction: 'COMMITTED: $300 win credited', heldLocks: [] }
    ]);

    addLog(14800, 'POSTGRES_DAEMON', 'slate', 'info', 'Zero race conditions! All 4 transactions serialized safely via Row-Level Mutex queue without deadlocks.');
    setIsRunning(false);
  };

  // Execute Scenario 3: Deterministic Sorted Order Solution
  const runSortedOrderSolutionSimulation = async () => {
    setIsRunning(true);
    resetSimulation();
    await new Promise((r) => setTimeout(r, 200));

    addLog(14800, 'POSTGRES_DAEMON', 'slate', 'info', 'Deterministic Lock Ordering: Both Tx-1 and Tx-2 enforce ascending UUID lock sorting (min(A,B) -> max(A,B)).');

    // Both start
    addLog(14820, 'Tx-1 (T1)', 'cyan', 'sql', 'BEGIN;');
    addLog(14821, 'Tx-2 (T2)', 'amber', 'sql', 'BEGIN;');

    setWorkers((prev) => [
      { ...prev[0], status: 'running', step: 1, currentAction: 'BEGIN transaction' },
      { ...prev[1], status: 'running', step: 1, currentAction: 'BEGIN transaction' }
    ]);
    await new Promise((r) => setTimeout(r, simulationSpeed));

    // Both try to lock Wallet A first because 'w_sakib_01' < 'w_maria_02' lexicographically!
    addLog(14820, 'Tx-1 (T1)', 'cyan', 'sql', '-- Order sorted: Acquiring Lock on lower ID \'w_sakib_01\' first');
    addLog(14820, 'Tx-1 (T1)', 'cyan', 'lock', 'ExclusiveLock acquired by Tx-1 on Wallet A.');
    setWalletA((w) => ({ ...w, lockHolder: 'T1', lockWaiters: ['T2'] }));

    setWorkers((prev) => [
      { ...prev[0], status: 'running', step: 2, currentAction: 'Acquired Lock on Wallet A (Sorted 1st). Now requesting Wallet B...', heldLocks: ['Wallet A'] },
      prev[1]
    ]);
    await new Promise((r) => setTimeout(r, simulationSpeed / 2));

    // Tx-2 also requests Wallet A first (since it follows the same sorted ordering rule)
    addLog(14821, 'Tx-2 (T2)', 'amber', 'sql', '-- Order sorted: Tx-2 also requests lower ID \'w_sakib_01\' first');
    addLog(14821, 'Tx-2 (T2)', 'amber', 'wait', 'Tx-2 waits for Wallet A lock (Held by Tx-1). NO CIRCULAR WAIT CYCLE CAN FORM!');
    setWorkers((prev) => [
      prev[0],
      { ...prev[1], status: 'waiting', step: 2, currentAction: 'LOCK_WAIT: Waiting for Wallet A (No cycle can form!)', waitingOnLock: 'Wallet A' }
    ]);
    await new Promise((r) => setTimeout(r, simulationSpeed));

    // Tx-1 then easily acquires Wallet B (which is free!)
    addLog(14820, 'Tx-1 (T1)', 'cyan', 'sql', 'SELECT * FROM wallets WHERE id = \'w_maria_02\' FOR UPDATE;');
    addLog(14820, 'Tx-1 (T1)', 'cyan', 'lock', 'ExclusiveLock acquired by Tx-1 on Wallet B (Unlocked).');
    setWalletB((w) => ({ ...w, lockHolder: 'T1' }));
    setWorkers((prev) => [
      { ...prev[0], status: 'running', step: 3, currentAction: 'Acquired Both Locks! Updating balances...', heldLocks: ['Wallet A', 'Wallet B'] },
      prev[1]
    ]);
    await new Promise((r) => setTimeout(r, simulationSpeed));

    // Tx-1 transfers $500 from A to B and commits
    addLog(14820, 'Tx-1 (T1)', 'cyan', 'sql', 'UPDATE wallets SET real_balance = real_balance - 500 WHERE id = \'w_sakib_01\';');
    addLog(14820, 'Tx-1 (T1)', 'cyan', 'sql', 'UPDATE wallets SET real_balance = real_balance + 500 WHERE id = \'w_maria_02\';');
    addLog(14820, 'Tx-1 (T1)', 'cyan', 'commit', 'COMMIT; Tx-1 completed successfully. Releasing Wallet A & Wallet B.');
    setWalletA((w) => ({ ...w, balance: w.balance - 500 }));
    setWalletB((w) => ({ ...w, balance: w.balance + 500 }));

    setWorkers((prev) => [
      { ...prev[0], status: 'committed', step: 4, currentAction: 'COMMITTED: $500 transferred', heldLocks: [] },
      prev[1]
    ]);
    await new Promise((r) => setTimeout(r, simulationSpeed));

    // Tx-2 unblocks, acquires Wallet A, then Wallet B, and completes!
    addLog(14821, 'Tx-2 (T2)', 'amber', 'lock', 'Tx-2 unblocked! Acquiring Lock on Wallet A and Wallet B in sequence.');
    setWalletA((w) => ({ ...w, lockHolder: 'T2', lockWaiters: [] }));
    setWalletB((w) => ({ ...w, lockHolder: 'T2' }));
    setWorkers((prev) => [
      prev[0],
      { ...prev[1], status: 'running', step: 3, currentAction: 'Unblocked! Acquired Both Locks. Executing transfer...', heldLocks: ['Wallet A', 'Wallet B'], waitingOnLock: null }
    ]);
    await new Promise((r) => setTimeout(r, simulationSpeed));

    // Tx-2 transfers $300 from B to A and commits
    addLog(14821, 'Tx-2 (T2)', 'amber', 'sql', 'UPDATE wallets SET real_balance = real_balance - 300 WHERE id = \'w_maria_02\';');
    addLog(14821, 'Tx-2 (T2)', 'amber', 'sql', 'UPDATE wallets SET real_balance = real_balance + 300 WHERE id = \'w_sakib_01\';');
    addLog(14821, 'Tx-2 (T2)', 'amber', 'commit', 'COMMIT; Tx-2 completed successfully. Releasing all locks.');
    setWalletA((w) => ({ ...w, balance: w.balance + 300, lockHolder: null }));
    setWalletB((w) => ({ ...w, balance: w.balance - 300, lockHolder: null }));

    setWorkers((prev) => [
      prev[0],
      { ...prev[1], status: 'committed', step: 4, currentAction: 'COMMITTED: $300 transferred', heldLocks: [] }
    ]);

    addLog(14800, 'POSTGRES_DAEMON', 'slate', 'info', '100% SUCCESS: Both concurrent transactions committed without a single deadlock error (40P01 eliminated)!');
    setIsRunning(false);
  };

  const handleStart = () => {
    if (scenario === 'deadlock_cycle') {
      runDeadlockCycleSimulation();
    } else if (scenario === 'same_row_contention') {
      runSameRowContentionSimulation();
    } else if (scenario === 'sorted_order_solution') {
      runSortedOrderSolutionSimulation();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <AlertOctagon className="w-5 h-5" />
              </span>
              <h1 className="text-lg font-black text-white flex items-center gap-2">
                <span>PostgreSQL Row-Level Locking &amp; Deadlock Simulator</span>
                <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded uppercase">
                  ACID Kernel Visualizer
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Experience real-time Two-Phase Locking (2PL), <code className="text-amber-300 font-mono">SELECT ... FOR UPDATE</code> mutex queues, circular lock-wait graphs, and PostgreSQL error <code className="text-rose-400 font-mono">40P01: deadlock_detected</code> resolution.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={resetSimulation}
              disabled={isRunning}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset State</span>
            </button>

            <button
              onClick={handleStart}
              disabled={isRunning}
              className={`px-5 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg cursor-pointer ${
                isRunning
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white shadow-orange-500/20'
              }`}
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Simulating Kernel...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Trigger Simulation</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Scenario Selection Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
          {[
            {
              id: 'deadlock_cycle',
              title: '1. Inverted Order Deadlock Cycle',
              badge: 'Deadlock 40P01 Error',
              badgeColor: 'text-rose-400 bg-rose-950/80 border-rose-500/30',
              description: 'Tx-1 locks Wallet A then requests B. Tx-2 locks Wallet B then requests A. Triggers deadlock abort & rollback.'
            },
            {
              id: 'same_row_contention',
              title: '2. High-Frequency Same-Row Contention',
              badge: 'FIFO Mutex Queue',
              badgeColor: 'text-cyan-400 bg-cyan-950/80 border-cyan-500/30',
              description: '4 concurrent provider threads compete for the same user wallet row. Visualizes serialized LockWait queues.'
            },
            {
              id: 'sorted_order_solution',
              title: '3. Deterministic Sorted Lock Ordering',
              badge: 'Zero-Deadlock Solution',
              badgeColor: 'text-emerald-400 bg-emerald-950/80 border-emerald-500/30',
              description: 'Enterprise solution: Locks acquired in strict ascending UUID order (min->max), eliminating circular wait graph cycles.'
            }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (!isRunning) setScenario(item.id as any);
              }}
              disabled={isRunning}
              className={`p-3.5 rounded-xl border text-left transition-all font-sans cursor-pointer ${
                scenario === item.id
                  ? 'bg-slate-950 border-amber-500/60 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30'
                  : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-white font-mono">{item.title}</span>
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border font-bold ${item.badgeColor}`}>
                  {item.badge}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{item.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Simulator Control & Config Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span>Step Delay:</span>
          </span>
          <div className="flex items-center gap-1.5">
            {[400, 800, 1400].map((spd) => (
              <button
                key={spd}
                onClick={() => setSimulationSpeed(spd)}
                className={`px-2.5 py-1 rounded text-[11px] border ${
                  simulationSpeed === spd
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {spd === 400 ? 'Fast (400ms)' : spd === 800 ? 'Normal (800ms)' : 'Slow-Mo (1.4s)'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-400">deadlock_timeout:</span>
          <span className="bg-slate-950 px-2.5 py-1 rounded text-amber-400 font-bold border border-slate-800">
            {deadlockTimeoutMs} ms (Kernel Default)
          </span>
        </div>
      </div>

      {/* Force-Directed Physics Lock Contention Graph */}
      <ForceDirectedLockGraph
        workers={workers}
        wallets={{ walletA, walletB }}
        activeCycleDetected={activeCycleDetected}
        scenario={scenario}
        deadlockTimeoutMs={deadlockTimeoutMs}
      />

      {/* Visual Live State: Wallet Rows & Lock Mutex Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Wallets and Worker Threads (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Target Wallets Database Rows */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 font-mono">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>PostgreSQL `wallets` Table Rows (In-Memory Buffer)</span>
              </h2>
              <span className="text-[10px] font-mono text-slate-500">Row-Level Mutexes</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono">
              {/* Wallet A */}
              <div
                className={`p-4 rounded-xl border transition-all relative overflow-hidden ${
                  walletA.lockHolder
                    ? 'bg-amber-950/20 border-amber-500/60 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{walletA.name}</span>
                  </div>
                  {walletA.lockHolder ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      LOCKED BY {walletA.lockHolder}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                      <Unlock className="w-3 h-3" />
                      UNLOCKED
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Row ID:</span>
                    <span className="text-slate-300 font-bold">{walletA.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Real Balance:</span>
                    <span className="text-amber-400 font-bold">${walletA.balance.toFixed(2)} USD</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Lock Queue:</span>
                    <span className="text-cyan-300">
                      {walletA.lockWaiters.length > 0
                        ? `[ ${walletA.lockWaiters.join(', ')} waiting ]`
                        : 'Empty queue'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Wallet B */}
              <div
                className={`p-4 rounded-xl border transition-all relative overflow-hidden ${
                  walletB.lockHolder
                    ? 'bg-amber-950/20 border-amber-500/60 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{walletB.name}</span>
                  </div>
                  {walletB.lockHolder ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      LOCKED BY {walletB.lockHolder}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                      <Unlock className="w-3 h-3" />
                      UNLOCKED
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Row ID:</span>
                    <span className="text-slate-300 font-bold">{walletB.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Real Balance:</span>
                    <span className="text-amber-400 font-bold">${walletB.balance.toFixed(2)} USD</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Lock Queue:</span>
                    <span className="text-cyan-300">
                      {walletB.lockWaiters.length > 0
                        ? `[ ${walletB.lockWaiters.join(', ')} waiting ]`
                        : 'Empty queue'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Wait-For Dependency Graph */}
            {scenario === 'deadlock_cycle' && (
              <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 font-mono text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
                    <GitFork className="w-3.5 h-3.5 text-amber-400" />
                    Lock-Wait Dependency Graph (Cycle Detection)
                  </span>
                  {activeCycleDetected && (
                    <span className="text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded animate-pulse">
                      CIRCULAR DEPENDENCY DETECTED
                    </span>
                  )}
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] flex flex-col md:flex-row items-center justify-around gap-2 text-center">
                  <div className="p-2 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-300">
                    <div className="font-bold">Tx-1 (T1)</div>
                    <div className="text-[9px] text-slate-400">Holds: Wallet A</div>
                  </div>

                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-rose-400 font-bold">Waits for Lock on Wallet B &rarr;</span>
                    <span className="text-[10px] text-amber-400 font-bold">&larr; Waits for Lock on Wallet A</span>
                  </div>

                  <div className="p-2 rounded bg-amber-950/60 border border-amber-500/30 text-amber-300">
                    <div className="font-bold">Tx-2 (T2)</div>
                    <div className="text-[9px] text-slate-400">Holds: Wallet B</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Active Concurrent Worker Threads */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Cpu className="w-4 h-4 text-amber-400" />
                <span>Concurrent Backend Worker Sessions (Processes)</span>
              </h2>
              <span className="text-[10px] text-slate-500">{workers.length} Active Sessions</span>
            </div>

            <div className="space-y-2.5">
              {workers.map((w) => (
                <div
                  key={w.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    w.status === 'aborted'
                      ? 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                      : w.status === 'committed'
                      ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                      : w.status === 'waiting'
                      ? 'bg-amber-950/20 border-amber-500/40 text-amber-300'
                      : w.status === 'running'
                      ? 'bg-cyan-950/20 border-cyan-500/40 text-cyan-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs">{w.name}</span>
                      <span className="text-[10px] text-slate-500">PID: {w.pid}</span>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
                        w.status === 'aborted'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : w.status === 'committed'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : w.status === 'waiting'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : w.status === 'running'
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {w.status}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-300 flex items-center justify-between">
                    <span className="text-slate-400 truncate max-w-[70%]">{w.currentAction}</span>
                    <span>
                      {w.heldLocks.length > 0 && (
                        <span className="text-amber-400 font-bold">Locks: {w.heldLocks.join(', ')}</span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: PostgreSQL Server Console (5 cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-xl flex-1 flex flex-col min-h-[500px] font-mono">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  <span>PostgreSQL Engine Console Logs</span>
                </span>
              </div>
              <span className="text-[10px] text-slate-500">STDERR / STDOUT</span>
            </div>

            {/* Console Log Feed */}
            <div className="flex-1 overflow-y-auto space-y-2 text-[11px] max-h-[520px] pr-1 scrollbar-thin">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`p-2 rounded-lg border leading-relaxed ${
                    log.type === 'deadlock'
                      ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                      : log.type === 'rollback'
                      ? 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                      : log.type === 'commit'
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                      : log.type === 'lock'
                      ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                      : log.type === 'wait'
                      ? 'bg-orange-950/20 border-orange-500/30 text-orange-200'
                      : log.type === 'sql'
                      ? 'bg-slate-900 border-slate-800 text-slate-300'
                      : 'bg-slate-900/60 border-slate-800/60 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                    <span className="font-bold text-cyan-400">
                      [{log.timestamp}] [PID {log.pid}] {log.threadName}
                    </span>
                    <span className="uppercase text-[9px] font-bold px-1 rounded bg-slate-800">
                      {log.type}
                    </span>
                  </div>
                  <div className="break-words font-mono">{log.message}</div>
                  {log.query && (
                    <div className="mt-1 p-1 bg-slate-950/80 rounded border border-slate-800 text-amber-300 font-mono text-[10px] break-all">
                      {log.query}
                    </div>
                  )}
                </div>
              ))}
              <div ref={consoleEndRef} />
            </div>
          </div>
        </div>
      </div>

      {/* Architect Architectural Deep Dive */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center gap-2 text-white font-bold text-sm font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>PostgreSQL Row-Locking Best Practices for iGaming Architects</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300 font-sans">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
            <div className="text-amber-400 font-bold font-mono text-xs">1. Deterministic Lock Ordering</div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              When a transaction must lock multiple wallet rows (e.g. peer-to-peer transfers or bonus allocations), always order the row IDs lexicographically:
            </p>
            <pre className="bg-slate-900 p-2 rounded text-[10px] font-mono text-emerald-300 overflow-x-auto">
              SELECT * FROM wallets WHERE id IN (w1, w2) ORDER BY id ASC FOR UPDATE;
            </pre>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
            <div className="text-cyan-400 font-bold font-mono text-xs">2. Minimize Critical Section Latency</div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              Keep transactions minimal. Never perform external HTTP calls (game provider API, 3rd party webhooks) while holding a PostgreSQL row lock. Calculate before locking, or lock, update, and commit immediately.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
            <div className="text-purple-400 font-bold font-mono text-xs">3. `NOWAIT` &amp; `SKIP LOCKED` Alternatives</div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              For batch payout queues or background rake sweeps, use <code className="text-purple-300 font-mono">FOR UPDATE SKIP LOCKED</code> to allow concurrent worker workers to process non-overlapping queue elements without waiting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
