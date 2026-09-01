/**
 * @file ForceDirectedLockGraph.tsx
 * @description Interactive Force-Directed Physics Graph Visualizer for PostgreSQL Row-Level Locking & Deadlock Simulation.
 * Implements Coulomb repulsion, Hooke's spring attraction, velocity damping, interactive node dragging,
 * animated particle flow along lock edges, and real-time cycle detection visualization.
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  Lock,
  Unlock,
  AlertOctagon,
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Minimize2,
  Info,
  Sliders,
  Layers,
  Cpu,
  Database,
  Sparkles,
  Zap,
  Activity,
  ArrowRight,
  ShieldCheck,
  Flame,
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw
} from 'lucide-react';

export interface GraphNode {
  id: string;
  type: 'transaction' | 'row';
  label: string;
  subLabel: string;
  status: 'idle' | 'running' | 'waiting' | 'committed' | 'aborted' | 'unlocked' | 'locked';
  color: string;
  pid?: number;
  balance?: number;
  heldLocks?: string[];
  waitingOn?: string | null;
  queueDepth?: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isPinned?: boolean;
  isDragging?: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'held_lock' | 'lock_wait' | 'deadlock_cycle';
  label: string;
  color: string;
  dashArray?: string;
  particles?: { progress: number; speed: number }[];
}

interface ForceDirectedLockGraphProps {
  workers: Array<{
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
  }>;
  wallets: {
    walletA: { id: string; name: string; balance: number; lockHolder: string | null; lockWaiters: string[] };
    walletB: { id: string; name: string; balance: number; lockHolder: string | null; lockWaiters: string[] };
  };
  activeCycleDetected: boolean;
  scenario: 'deadlock_cycle' | 'same_row_contention' | 'sorted_order_solution';
  deadlockTimeoutMs: number;
}

export const ForceDirectedLockGraph: React.FC<ForceDirectedLockGraphProps> = ({
  workers,
  wallets,
  activeCycleDetected,
  scenario,
  deadlockTimeoutMs
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Simulation physics parameters
  const [physicsRunning, setPhysicsRunning] = useState<boolean>(true);
  const [repulsionStrength, setRepulsionStrength] = useState<number>(3800);
  const [linkDistance, setLinkDistance] = useState<number>(140);
  const [gravityStrength, setGravityStrength] = useState<number>(0.04);
  const [showParticles, setShowParticles] = useState<boolean>(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showConfig, setShowConfig] = useState<boolean>(false);

  // Persistent nodes & edges state inside ref for smooth 60fps canvas loop
  const nodesRef = useRef<Map<string, GraphNode>>(new Map());
  const edgesRef = useRef<GraphEdge[]>([]);
  const particlesRef = useRef<Array<{ edgeId: string; progress: number; speed: number; color: string }>>([]);
  const draggedNodeRef = useRef<GraphNode | null>(null);
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Sync internal graph nodes when incoming workers or wallets change
  useEffect(() => {
    const nodeMap = nodesRef.current;
    const width = canvasRef.current?.width || 800;
    const height = canvasRef.current?.height || 500;
    const centerX = width / 2;
    const centerY = height / 2;

    // 1. Synchronize Database Row Nodes
    const rowNodesData = [
      {
        id: wallets.walletA.id,
        shortId: 'Row-A',
        label: 'Wallet A',
        subLabel: wallets.walletA.name.split('(')[1]?.replace(')', '') || wallets.walletA.id,
        status: wallets.walletA.lockHolder ? ('locked' as const) : ('unlocked' as const),
        color: wallets.walletA.lockHolder ? '#f43f5e' : '#10b981',
        balance: wallets.walletA.balance,
        queueDepth: wallets.walletA.lockWaiters.length,
        initialX: centerX - 140,
        initialY: centerY
      },
      {
        id: wallets.walletB.id,
        shortId: 'Row-B',
        label: 'Wallet B',
        subLabel: wallets.walletB.name.split('(')[1]?.replace(')', '') || wallets.walletB.id,
        status: wallets.walletB.lockHolder ? ('locked' as const) : ('unlocked' as const),
        color: wallets.walletB.lockHolder ? '#f43f5e' : '#10b981',
        balance: wallets.walletB.balance,
        queueDepth: wallets.walletB.lockWaiters.length,
        initialX: centerX + 140,
        initialY: centerY
      }
    ];

    rowNodesData.forEach((row) => {
      let existing = nodeMap.get(row.id);
      if (!existing) {
        existing = {
          id: row.id,
          type: 'row',
          label: row.label,
          subLabel: row.subLabel,
          status: row.status,
          color: row.color,
          balance: row.balance,
          queueDepth: row.queueDepth,
          x: row.initialX + (Math.random() * 20 - 10),
          y: row.initialY + (Math.random() * 20 - 10),
          vx: 0,
          vy: 0,
          radius: 36
        };
        nodeMap.set(row.id, existing);
      } else {
        existing.status = row.status;
        existing.color = row.color;
        existing.balance = row.balance;
        existing.queueDepth = row.queueDepth;
      }
    });

    // 2. Synchronize Transaction Worker Nodes
    const angleStep = (2 * Math.PI) / Math.max(workers.length, 1);
    workers.forEach((w, idx) => {
      let existing = nodeMap.get(w.id);
      const angle = idx * angleStep - Math.PI / 2;
      const spawnDist = 180;
      const initialX = centerX + Math.cos(angle) * spawnDist;
      const initialY = centerY + Math.sin(angle) * spawnDist;

      let color = '#06b6d4';
      if (w.color === 'amber') color = '#f59e0b';
      if (w.color === 'purple') color = '#a855f7';
      if (w.color === 'emerald') color = '#10b981';

      if (!existing) {
        existing = {
          id: w.id,
          type: 'transaction',
          label: `Tx ${w.id}`,
          subLabel: w.name.split(':')[1]?.trim() || `PID ${w.pid}`,
          status: w.status,
          color,
          pid: w.pid,
          heldLocks: w.heldLocks,
          waitingOn: w.waitingOnLock,
          x: initialX,
          y: initialY,
          vx: 0,
          vy: 0,
          radius: 32
        };
        nodeMap.set(w.id, existing);
      } else {
        existing.status = w.status;
        existing.heldLocks = w.heldLocks;
        existing.waitingOn = w.waitingOnLock;
        existing.subLabel = w.name.split(':')[1]?.trim() || `PID ${w.pid}`;
      }
    });

    // Remove old worker nodes if scenario switched (e.g., from 4 workers down to 2)
    const validIds = new Set([wallets.walletA.id, wallets.walletB.id, ...workers.map((w) => w.id)]);
    Array.from(nodeMap.keys()).forEach((k) => {
      if (!validIds.has(k)) {
        nodeMap.delete(k);
      }
    });

    // 3. Compute Directed Graph Edges (Held Locks, Wait Queues, Deadlock Cycle)
    const newEdges: GraphEdge[] = [];

    // Helper to resolve row entity ID from string label
    const resolveRowId = (name: string) => {
      if (name.includes('Wallet A') || name.includes('w_sakib')) return wallets.walletA.id;
      if (name.includes('Wallet B') || name.includes('w_maria')) return wallets.walletB.id;
      return null;
    };

    // Edge type 1: Held Locks (Solid Gold Edge from Transaction -> Row)
    workers.forEach((w) => {
      w.heldLocks.forEach((lockName) => {
        const rowId = resolveRowId(lockName);
        if (rowId) {
          newEdges.push({
            id: `held_${w.id}_${rowId}`,
            source: w.id,
            target: rowId,
            type: 'held_lock',
            label: 'EXCLUSIVE_LOCK',
            color: '#eab308' // Gold
          });
        }
      });
    });

    // Edge type 2: Lock Waiters (Dashed Rose Edge from Transaction -> Row)
    workers.forEach((w) => {
      if (w.waitingOnLock) {
        const rowId = resolveRowId(w.waitingOnLock);
        if (rowId) {
          const isPartOfDeadlock = activeCycleDetected;
          newEdges.push({
            id: `wait_${w.id}_${rowId}`,
            source: w.id,
            target: rowId,
            type: isPartOfDeadlock ? 'deadlock_cycle' : 'lock_wait',
            label: isPartOfDeadlock ? 'DEADLOCK_WAIT_CYCLE' : 'LOCK_WAIT_QUEUED',
            color: isPartOfDeadlock ? '#f43f5e' : '#fb923c', // Crimson vs Orange
            dashArray: isPartOfDeadlock ? undefined : '6,4'
          });
        }
      }
    });

    // Edge type 3: In deadlock cycle, add direct dependency indicator between transactions if cycle active
    if (activeCycleDetected && workers.length >= 2) {
      newEdges.push({
        id: 'cycle_t1_t2',
        source: 'T1',
        target: 'T2',
        type: 'deadlock_cycle',
        label: 'CIRCULAR_WAIT_CYCLE (40P01)',
        color: '#f43f5e',
        dashArray: '4,4'
      });
    }

    edgesRef.current = newEdges;

    // Seed / replenish animated edge particles
    newEdges.forEach((edge) => {
      const existingParticles = particlesRef.current.filter((p) => p.edgeId === edge.id);
      if (existingParticles.length === 0) {
        for (let i = 0; i < 3; i++) {
          particlesRef.current.push({
            edgeId: edge.id,
            progress: i / 3,
            speed: edge.type === 'deadlock_cycle' ? 0.015 : 0.008,
            color: edge.type === 'deadlock_cycle' ? '#fda4af' : edge.type === 'held_lock' ? '#fde047' : '#fdba74'
          });
        }
      }
    });

    // Clean up particles for defunct edges
    const activeEdgeIds = new Set(newEdges.map((e) => e.id));
    particlesRef.current = particlesRef.current.filter((p) => activeEdgeIds.has(p.edgeId));
  }, [workers, wallets, activeCycleDetected, scenario]);

  // Set initial Canvas Dimensions with Device Pixel Ratio
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvasRef.current.width = rect.width * dpr;
      canvasRef.current.height = (isFullscreen ? window.innerHeight - 180 : 460) * dpr;
      canvasRef.current.style.width = `${rect.width}px`;
      canvasRef.current.style.height = `${isFullscreen ? window.innerHeight - 180 : 460}px`;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isFullscreen]);

  // Reset node positions to balanced layout
  const resetLayout = useCallback(() => {
    if (!canvasRef.current) return;
    const dpr = window.devicePixelRatio || 1;
    const width = canvasRef.current.width / dpr;
    const height = canvasRef.current.height / dpr;
    const centerX = width / 2;
    const centerY = height / 2;

    const nodeMap = nodesRef.current;
    // Position rows in center
    const rowA = nodeMap.get(wallets.walletA.id);
    if (rowA) {
      rowA.x = centerX - 140;
      rowA.y = centerY;
      rowA.vx = 0;
      rowA.vy = 0;
    }
    const rowB = nodeMap.get(wallets.walletB.id);
    if (rowB) {
      rowB.x = centerX + 140;
      rowB.y = centerY;
      rowB.vx = 0;
      rowB.vy = 0;
    }

    // Position workers in orbit
    const angleStep = (2 * Math.PI) / Math.max(workers.length, 1);
    workers.forEach((w, idx) => {
      const node = nodeMap.get(w.id);
      if (node) {
        const angle = idx * angleStep - Math.PI / 2;
        node.x = centerX + Math.cos(angle) * 170;
        node.y = centerY + Math.sin(angle) * 170;
        node.vx = 0;
        node.vy = 0;
      }
    });
  }, [wallets, workers]);

  // Force-Directed Physics Simulation & Canvas Rendering Loop (60 FPS)
  useEffect(() => {
    let lastTime = performance.now();

    const render = (currentTime: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Clear & Draw High-Tech Grid Background
      ctx.clearRect(0, 0, width, height);

      // Background gradient
      const bgGrad = ctx.createRadialGradient(centerX, centerY, 50, centerX, centerY, width * 0.7);
      bgGrad.addColorStop(0, '#0f172a');
      bgGrad.addColorStop(1, '#020617');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Tech Grid Pattern
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Helper function to draw rounded rect cross-browser
      const drawRoundedRect = (
        c: CanvasRenderingContext2D,
        rx: number,
        ry: number,
        rw: number,
        rh: number,
        r: number
      ) => {
        c.beginPath();
        c.moveTo(rx + r, ry);
        c.lineTo(rx + rw - r, ry);
        c.quadraticCurveTo(rx + rw, ry, rx + rw, ry + r);
        c.lineTo(rx + rw, ry + rh - r);
        c.quadraticCurveTo(rx + rw, ry + rh, rx + rw - r, ry + rh);
        c.lineTo(rx + r, ry + rh);
        c.quadraticCurveTo(rx, ry + rh, rx, ry + rh - r);
        c.lineTo(rx, ry + r);
        c.quadraticCurveTo(rx, ry, rx + r, ry);
        c.closePath();
      };

      // Draw Center Kernel Origin Indicator
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.12)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 210, 0, Math.PI * 2);
      ctx.stroke();

      const nodes: GraphNode[] = [];
      nodesRef.current.forEach((n) => nodes.push(n));
      const edges = edgesRef.current;

      // 2. Physics Step (if physics is enabled)
      if (physicsRunning) {
        // A. Coulomb Repulsion between all pairs of nodes
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const n1: GraphNode = nodes[i];
            const n2: GraphNode = nodes[j];
            const dx = n2.x - n1.x;
            const dy = n2.y - n1.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;

            if (dist < 450) {
              const force = repulsionStrength / (dist * dist);
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;

              if (!n1.isDragging && !n1.isPinned) {
                n1.vx -= fx;
                n1.vy -= fy;
              }
              if (!n2.isDragging && !n2.isPinned) {
                n2.vx += fx;
                n2.vy += fy;
              }
            }
          }
        }

        // B. Hooke's Spring Attraction along Edges
        edges.forEach((edge) => {
          const sourceNode = nodesRef.current.get(edge.source);
          const targetNode = nodesRef.current.get(edge.target);
          if (sourceNode && targetNode) {
            const dx = targetNode.x - sourceNode.x;
            const dy = targetNode.y - sourceNode.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const displacement = dist - linkDistance;
            const springK = edge.type === 'deadlock_cycle' ? 0.08 : 0.05;
            const fx = (dx / dist) * displacement * springK;
            const fy = (dy / dist) * displacement * springK;

            if (!sourceNode.isDragging && !sourceNode.isPinned) {
              sourceNode.vx += fx;
              sourceNode.vy += fy;
            }
            if (!targetNode.isDragging && !targetNode.isPinned) {
              targetNode.vx -= fx;
              targetNode.vy += fy;
            }
          }
        });

        // C. Centering Gravity & Velocity Damping
        const damping = 0.88;
        nodes.forEach((n: GraphNode) => {
          if (n.isDragging) return;

          // Pull to center
          const gx = (centerX - n.x) * gravityStrength;
          const gy = (centerY - n.y) * gravityStrength;
          n.vx += gx;
          n.vy += gy;

          // Apply velocity with damping
          n.vx *= damping;
          n.vy *= damping;

          // Clamp max velocity
          const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
          if (speed > 12) {
            n.vx = (n.vx / speed) * 12;
            n.vy = (n.vy / speed) * 12;
          }

          n.x += n.vx;
          n.y += n.vy;

          // Boundary bounce / confinement
          const padding = n.radius + 15;
          if (n.x < padding) {
            n.x = padding;
            n.vx = Math.abs(n.vx);
          }
          if (n.x > width - padding) {
            n.x = width - padding;
            n.vx = -Math.abs(n.vx);
          }
          if (n.y < padding) {
            n.y = padding;
            n.vy = Math.abs(n.vy);
          }
          if (n.y > height - padding) {
            n.y = height - padding;
            n.vy = -Math.abs(n.vy);
          }
        });
      }

      // 3. Draw Directed Edges
      edges.forEach((edge) => {
        const src = nodesRef.current.get(edge.source);
        const tgt = nodesRef.current.get(edge.target);
        if (!src || !tgt) return;

        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        // Clip edge start and end to node borders
        const startX = src.x + (dx / dist) * src.radius;
        const startY = src.y + (dy / dist) * src.radius;
        const endX = tgt.x - (dx / dist) * (tgt.radius + 6);
        const endY = tgt.y - (dy / dist) * (tgt.radius + 6);

        ctx.save();

        // Edge Glow & Line Style
        if (edge.type === 'deadlock_cycle') {
          // Intense pulsing Crimson glow
          ctx.strokeStyle = '#f43f5e';
          ctx.lineWidth = 3.5;
          ctx.shadowColor = '#f43f5e';
          ctx.shadowBlur = 15;
          if (edge.dashArray) {
            ctx.setLineDash(edge.dashArray.split(',').map(Number));
          }
        } else if (edge.type === 'held_lock') {
          // Radiant Gold
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 2.5;
          ctx.shadowColor = '#eab308';
          ctx.shadowBlur = 8;
        } else {
          // Orange Dashed LockWait
          ctx.strokeStyle = '#fb923c';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#fb923c';
          ctx.shadowBlur = 6;
          ctx.setLineDash([6, 4]);
        }

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Draw Arrowhead at target
        const arrowAngle = Math.atan2(endY - startY, endX - startX);
        const arrowLength = edge.type === 'deadlock_cycle' ? 12 : 9;
        ctx.fillStyle = edge.color;
        ctx.beginPath();
        ctx.moveTo(endX + (dx / dist) * 6, endY + (dy / dist) * 6);
        ctx.lineTo(
          endX - arrowLength * Math.cos(arrowAngle - Math.PI / 6),
          endY - arrowLength * Math.sin(arrowAngle - Math.PI / 6)
        );
        ctx.lineTo(
          endX - arrowLength * Math.cos(arrowAngle + Math.PI / 6),
          endY - arrowLength * Math.sin(arrowAngle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();

        // Draw Edge Label Badge in midpoint
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        ctx.font = 'bold 9px monospace';
        const labelText =
          edge.type === 'held_lock'
            ? 'HELD_LOCK'
            : edge.type === 'deadlock_cycle'
            ? 'CYCLE (40P01)'
            : 'LOCK_WAIT';
        const textWidth = ctx.measureText(labelText).width;

        ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
        ctx.strokeStyle = edge.color;
        ctx.lineWidth = 1;
        drawRoundedRect(ctx, midX - textWidth / 2 - 4, midY - 8, textWidth + 8, 16, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = edge.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, midX, midY);

        ctx.restore();
      });

      // 4. Draw Animated Edge Energy Particles
      if (showParticles) {
        particlesRef.current.forEach((p) => {
          const edge = edges.find((e) => e.id === p.edgeId);
          if (!edge) return;
          const src = nodesRef.current.get(edge.source);
          const tgt = nodesRef.current.get(edge.target);
          if (!src || !tgt) return;

          p.progress += p.speed;
          if (p.progress > 1) p.progress = 0;

          const px = src.x + (tgt.x - src.x) * p.progress;
          const py = src.y + (tgt.y - src.y) * p.progress;

          ctx.save();
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(px, py, edge.type === 'deadlock_cycle' ? 4 : 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      }

      // 5. Draw Graph Nodes (Transaction Process & Row Mutex Nodes)
      nodes.forEach((n: GraphNode) => {
        ctx.save();

        const isSelected = selectedNodeId === n.id;

        // Draw Selection / Deadlock Halo Ring
        if (isSelected) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 7, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (n.status === 'aborted' || (activeCycleDetected && n.status === 'waiting')) {
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.6)';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Node Inner Fill & Shadow
        ctx.shadowColor = n.color;
        ctx.shadowBlur = n.status === 'running' || n.status === 'locked' ? 18 : 10;
        ctx.fillStyle = n.type === 'row' ? '#090d16' : '#030712';
        ctx.strokeStyle = n.color;
        ctx.lineWidth = n.type === 'row' ? 3 : 2.5;

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Node Inner Accent Disc
        ctx.fillStyle = `${n.color}15`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius - 3, 0, Math.PI * 2);
        ctx.fill();

        // Draw Node Center Icon / Primary Label
        ctx.shadowBlur = 0;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (n.type === 'row') {
          // Database Row Icon Representation
          ctx.font = 'bold 11px monospace';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(n.label, n.x, n.y - 8);

          // Balance Subtitle
          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = '#fbbf24';
          ctx.fillText(`$${n.balance?.toFixed(0) || '0'} USD`, n.x, n.y + 6);

          // Status Badge below Row
          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = n.status === 'locked' ? '#f43f5e' : '#10b981';
          ctx.fillText(n.status === 'locked' ? 'LOCKED' : 'FREE MUTEX', n.x, n.y + 18);
        } else {
          // Transaction Process Node
          ctx.font = 'bold 12px monospace';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(n.label, n.x, n.y - 6);

          // Status badge
          ctx.font = 'bold 8px monospace';
          if (n.status === 'committed') ctx.fillStyle = '#10b981';
          else if (n.status === 'aborted') ctx.fillStyle = '#f43f5e';
          else if (n.status === 'waiting') ctx.fillStyle = '#fb923c';
          else if (n.status === 'running') ctx.fillStyle = '#38bdf8';
          else ctx.fillStyle = '#94a3b8';

          ctx.fillText(n.status.toUpperCase(), n.x, n.y + 8);
        }

        // Draw Pin icon indicator if pinned
        if (n.isPinned) {
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(n.x + n.radius - 4, n.y - n.radius + 4, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        // Draw Queue Depth Pill on Rows if queue > 0
        if (n.type === 'row' && (n.queueDepth || 0) > 0) {
          ctx.fillStyle = '#f43f5e';
          ctx.beginPath();
          ctx.arc(n.x + n.radius - 2, n.y - n.radius + 2, 8, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(String(n.queueDepth), n.x + n.radius - 2, n.y - n.radius + 2);
        }

        ctx.restore();
      });

      ctx.restore();
      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [physicsRunning, repulsionStrength, linkDistance, gravityStrength, showParticles, selectedNodeId, activeCycleDetected]);

  // Mouse Interaction: Dragging & Selection Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Find clicked node
    let clickedNode: GraphNode | null = null;
    nodesRef.current.forEach((n) => {
      const dx = n.x - clickX;
      const dy = n.y - clickY;
      if (Math.sqrt(dx * dx + dy * dy) <= n.radius + 5) {
        clickedNode = n;
      }
    });

    if (clickedNode) {
      draggedNodeRef.current = clickedNode;
      clickedNode.isDragging = true;
      setSelectedNodeId(clickedNode.id);
    } else {
      setSelectedNodeId(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    mousePosRef.current = { x: mouseX, y: mouseY };

    if (draggedNodeRef.current) {
      draggedNodeRef.current.x = mouseX;
      draggedNodeRef.current.y = mouseY;
      draggedNodeRef.current.vx = 0;
      draggedNodeRef.current.vy = 0;
    }
  };

  const handleMouseUp = () => {
    if (draggedNodeRef.current) {
      draggedNodeRef.current.isDragging = false;
      draggedNodeRef.current = null;
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    nodesRef.current.forEach((n) => {
      const dx = n.x - clickX;
      const dy = n.y - clickY;
      if (Math.sqrt(dx * dx + dy * dy) <= n.radius + 5) {
        n.isPinned = !n.isPinned;
      }
    });
  };

  // Selected Node Details Inspector Helper
  const selectedNode = selectedNodeId ? nodesRef.current.get(selectedNodeId) : null;

  return (
    <div
      ref={containerRef}
      className={`bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden font-mono transition-all relative ${
        isFullscreen ? 'fixed inset-4 z-50 flex flex-col bg-slate-950/95 backdrop-blur-xl border-amber-500/50' : ''
      }`}
    >
      {/* Top Header & Control Toolbar */}
      <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Row-Lock Wait Force-Directed Graph</span>
                <span className="text-[10px] font-mono text-amber-400 font-normal">
                  (Lock Contention &amp; 2PL Physics Engine)
                </span>
              </h3>
              {activeCycleDetected ? (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse flex items-center gap-1">
                  <AlertOctagon className="w-3 h-3" />
                  CYCLE DETECTED
                </span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-sans">
              Dynamic physical modeling of PostgreSQL mutex contention, lock wait queues, and 40P01 deadlock resolution
            </p>
          </div>
        </div>

        {/* Toolbar Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Physics Play/Pause */}
          <button
            onClick={() => setPhysicsRunning(!physicsRunning)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              physicsRunning
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title={physicsRunning ? 'Pause Physics' : 'Resume Physics'}
          >
            {physicsRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{physicsRunning ? 'Pause Physics' : 'Resume'}</span>
          </button>

          {/* Reset Layout */}
          <button
            onClick={resetLayout}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Re-align nodes to default positions"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Layout</span>
          </button>

          {/* Physics Settings Toggle */}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
              showConfig
                ? 'bg-blue-600/30 text-blue-300 border-blue-500/40'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Physics Parameters & Tuning"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs cursor-pointer transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Optional Physics Parameters Drawer */}
      {showConfig && (
        <div className="bg-slate-950 p-3 border-b border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <div className="flex justify-between text-slate-400 text-[10px] mb-1">
              <span>Node Repulsion:</span>
              <span className="text-amber-400 font-bold">{repulsionStrength}</span>
            </div>
            <input
              type="range"
              min="1000"
              max="8000"
              step="200"
              value={repulsionStrength}
              onChange={(e) => setRepulsionStrength(Number(e.target.value))}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-400 text-[10px] mb-1">
              <span>Link Distance:</span>
              <span className="text-amber-400 font-bold">{linkDistance}px</span>
            </div>
            <input
              type="range"
              min="80"
              max="240"
              step="10"
              value={linkDistance}
              onChange={(e) => setLinkDistance(Number(e.target.value))}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-400 text-[10px] mb-1">
              <span>Center Gravity:</span>
              <span className="text-amber-400 font-bold">{gravityStrength.toFixed(3)}</span>
            </div>
            <input
              type="range"
              min="0.01"
              max="0.1"
              step="0.005"
              value={gravityStrength}
              onChange={(e) => setGravityStrength(Number(e.target.value))}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-center gap-2">
            <label className="flex items-center space-x-2 text-slate-300 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={showParticles}
                onChange={(e) => setShowParticles(e.target.checked)}
                className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-900"
              />
              <span>Lock Energy Particles</span>
            </label>
          </div>
        </div>
      )}

      {/* Main Interactive Canvas Area */}
      <div className="relative flex-1 bg-slate-950">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          className="w-full h-full cursor-grab active:cursor-grabbing block"
        />

        {/* Live Graph Status Overlay (Top-Left HUD) */}
        <div className="absolute top-3 left-3 bg-slate-950/85 backdrop-blur-md border border-slate-800 p-2.5 rounded-xl text-[10px] space-y-1 shadow-lg pointer-events-none">
          <div className="text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <Activity className="w-3 h-3 text-cyan-400" />
            <span>Lock Graph Engine Status</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-slate-300">
            <span>Active Worker Processes:</span>
            <span className="font-bold text-white">{workers.length}</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-slate-300">
            <span>Locked Row Mutexes:</span>
            <span className="font-bold text-amber-400">
              {(wallets.walletA.lockHolder ? 1 : 0) + (wallets.walletB.lockHolder ? 1 : 0)} / 2
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 text-slate-300">
            <span>Deadlock Detection Loop:</span>
            <span className="font-bold text-emerald-400">Active ({deadlockTimeoutMs}ms)</span>
          </div>
        </div>

        {/* Floating Node Inspector Modal (Bottom-Right if a node is clicked) */}
        {selectedNode && (
          <div className="absolute bottom-3 right-3 bg-slate-950/90 backdrop-blur-md border border-amber-500/50 rounded-xl p-3.5 shadow-2xl max-w-xs w-full text-xs space-y-2 animate-fade-in font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: selectedNode.color }}
                />
                <span className="font-bold text-white">{selectedNode.label}</span>
              </div>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="text-slate-400 hover:text-white text-[10px] px-1.5 py-0.5 rounded bg-slate-800 cursor-pointer"
              >
                &times; Close
              </button>
            </div>

            <div className="space-y-1 text-[11px] text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Entity Type:</span>
                <span className="text-white uppercase font-bold">{selectedNode.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">State / Status:</span>
                <span className="font-bold uppercase" style={{ color: selectedNode.color }}>
                  {selectedNode.status}
                </span>
              </div>
              {selectedNode.type === 'transaction' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Kernel Process PID:</span>
                    <span className="text-cyan-300 font-bold">{selectedNode.pid}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Held Locks:</span>
                    <span className="text-amber-300 font-bold">
                      {selectedNode.heldLocks && selectedNode.heldLocks.length > 0
                        ? selectedNode.heldLocks.join(', ')
                        : 'None'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Waiting On:</span>
                    <span className="text-rose-400 font-bold">
                      {selectedNode.waitingOn || 'Not blocked'}
                    </span>
                  </div>
                </>
              )}
              {selectedNode.type === 'row' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Row ID:</span>
                    <span className="text-slate-200">{selectedNode.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Balance:</span>
                    <span className="text-amber-400 font-bold">
                      ${selectedNode.balance?.toFixed(2)} USD
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Queue Waiters:</span>
                    <span className="text-cyan-300 font-bold">{selectedNode.queueDepth} processes</span>
                  </div>
                </>
              )}
            </div>
            <div className="text-[9px] text-slate-500 border-t border-slate-800 pt-1.5">
              Tip: Drag node to reposition. Double click to pin/unpin in space.
            </div>
          </div>
        )}
      </div>

      {/* Visual Color Legend Bar */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-[10px]">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-cyan-500" />
            <span className="text-slate-300">Transaction Worker (Tx Node)</span>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full border-2 border-emerald-500 bg-slate-950" />
            <span className="text-slate-300">Free Row Mutex (`wallets`)</span>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full border-2 border-rose-500 bg-slate-950" />
            <span className="text-slate-300">Locked Row (`SELECT FOR UPDATE`)</span>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="w-4 h-0.5 bg-yellow-400" />
            <span className="text-amber-300 font-bold">Exclusive Lock Held</span>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="w-4 h-0.5 bg-orange-400 border-b border-dashed border-orange-400" />
            <span className="text-orange-300">LockWait Queue (Blocked)</span>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="w-4 h-0.5 bg-rose-500" />
            <span className="text-rose-400 font-bold">Deadlock 40P01 Cycle</span>
          </div>
        </div>

        <div className="text-slate-500 font-mono text-[9px]">
          Physics Engine: Hooke Springs &bull; Coulomb Repulsion &bull; Interactive Drag
        </div>
      </div>
    </div>
  );
};
