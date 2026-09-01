/**
 * @file errorReportingService.ts
 * @description Dedicated Firestore Error Reporting Engine for 'SystemErrors' collection.
 * Automatically captures API failure stack traces, network timeouts, unhandled promise
 * rejections, and runtime exceptions for real-time monitoring and SLA auditing.
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  Unsubscribe,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export interface SystemErrorRecord {
  id: string;
  name: string;
  message: string;
  stack?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  source:
    | 'API_FETCH'
    | 'SEAMLESS_ENGINE'
    | 'UNHANDLED_ERROR'
    | 'UNHANDLED_REJECTION'
    | 'MANUAL_REPORT'
    | 'AUTH_ERROR'
    | 'SIMULATED_TEST';
  context?: Record<string, any>;
  userId?: string;
  userEmail?: string;
  userAgent?: string;
  url?: string;
  timestamp: number;
  timeLabel: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'NEW' | 'INVESTIGATING' | 'RESOLVED';
  resolvedAt?: number;
}

export interface ApiErrorReportParams {
  endpoint: string;
  method?: string;
  statusCode?: number;
  error: unknown;
  context?: Record<string, any>;
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

const COLLECTION_NAME = 'SystemErrors';
const MAX_LOCAL_CACHE = 50;

class ErrorReportingService {
  private localErrors: SystemErrorRecord[] = [];
  private listeners: Array<(errors: SystemErrorRecord[]) => void> = [];
  private isReportingInProgress = false;
  private recentErrorSignatures = new Set<string>();

  constructor() {
    this.loadCachedErrors();
  }

  private loadCachedErrors(): void {
    try {
      const raw = localStorage.getItem('playall365_cached_system_errors');
      if (raw) {
        this.localErrors = JSON.parse(raw);
      }
    } catch (e) {
      // Ignore cache load failure
    }
  }

  private saveCachedErrors(): void {
    try {
      localStorage.setItem(
        'playall365_cached_system_errors',
        JSON.stringify(this.localErrors.slice(0, MAX_LOCAL_CACHE))
      );
    } catch (e) {
      // Ignore cache write failure
    }
    this.notifyLocalListeners();
  }

  private notifyLocalListeners(): void {
    const list = [...this.localErrors];
    this.listeners.forEach((cb) => {
      try {
        cb(list);
      } catch (err) {
        console.warn('Error reporting listener notification failed', err);
      }
    });
  }

  public getRecentErrors(): SystemErrorRecord[] {
    return [...this.localErrors];
  }

  public onLocalErrorsChange(cb: (errors: SystemErrorRecord[]) => void): () => void {
    this.listeners.push(cb);
    cb([...this.localErrors]);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  /**
   * Pushes an API failure or system exception to the Firestore 'SystemErrors' collection
   */
  public async reportApiError(params: ApiErrorReportParams): Promise<SystemErrorRecord | null> {
    const { endpoint, method = 'POST', statusCode = 500, error, context, severity = 'HIGH' } = params;

    // Prevent recursive error loops if error reporting itself triggers an error
    if (this.isReportingInProgress) {
      return null;
    }

    const now = Date.now();
    const timeLabel = new Date(now).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const errorObj = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error));
    const stackTrace = errorObj.stack || (new Error().stack || 'No stack trace available');
    const errorName = errorObj.name || 'ApiError';
    const errorMessage = errorObj.message || 'API request failed without specific error message';

    // Duplicate debouncing within 3 seconds
    const signature = `${endpoint}_${statusCode}_${errorMessage.slice(0, 50)}`;
    if (this.recentErrorSignatures.has(signature)) {
      return null;
    }
    this.recentErrorSignatures.add(signature);
    setTimeout(() => this.recentErrorSignatures.delete(signature), 3000);

    const errorId = `err_${now}_${Math.random().toString(36).substring(2, 9)}`;

    const errorRecord: SystemErrorRecord = {
      id: errorId,
      name: errorName,
      message: errorMessage,
      stack: stackTrace,
      endpoint,
      method,
      statusCode,
      source: 'API_FETCH',
      context: context || {},
      userId: auth.currentUser?.uid || 'anonymous_user',
      userEmail: auth.currentUser?.email || 'unauthenticated@playall365.com',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown Browser',
      url: typeof window !== 'undefined' ? window.location.href : '',
      timestamp: now,
      timeLabel,
      severity,
      status: 'NEW'
    };

    // Store in local cache first
    this.localErrors.unshift(errorRecord);
    if (this.localErrors.length > MAX_LOCAL_CACHE) {
      this.localErrors.pop();
    }
    this.saveCachedErrors();

    // Push to Firestore 'SystemErrors' collection
    try {
      this.isReportingInProgress = true;
      const errorDocRef = doc(db, COLLECTION_NAME, errorId);
      await setDoc(errorDocRef, {
        ...errorRecord,
        createdAt: serverTimestamp()
      });
      console.info(`[SystemErrors] Automated error reported to Firestore: ${errorId} (${endpoint})`);
    } catch (firestoreErr) {
      console.warn('[SystemErrors] Could not persist error to remote Firestore:', firestoreErr);
    } finally {
      this.isReportingInProgress = false;
    }

    return errorRecord;
  }

  /**
   * Captures raw runtime exceptions or unhandled promise rejections
   */
  public async reportSystemError(
    error: unknown,
    source: SystemErrorRecord['source'] = 'UNHANDLED_ERROR',
    context?: Record<string, any>
  ): Promise<SystemErrorRecord | null> {
    if (this.isReportingInProgress) return null;

    const now = Date.now();
    const timeLabel = new Date(now).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const errorObj = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error));
    const stackTrace = errorObj.stack || (new Error().stack || 'No stack trace captured');
    const errorName = errorObj.name || 'RuntimeError';
    const errorMessage = errorObj.message || 'Unknown runtime exception';

    // Ignore benign noisy browser warnings
    if (
      errorMessage.includes('ResizeObserver loop') ||
      errorMessage.includes('WebSocket connection') ||
      errorMessage.includes('fetch-events')
    ) {
      return null;
    }

    const signature = `${source}_${errorMessage.slice(0, 60)}`;
    if (this.recentErrorSignatures.has(signature)) return null;
    this.recentErrorSignatures.add(signature);
    setTimeout(() => this.recentErrorSignatures.delete(signature), 3000);

    const errorId = `sys_err_${now}_${Math.random().toString(36).substring(2, 9)}`;

    const errorRecord: SystemErrorRecord = {
      id: errorId,
      name: errorName,
      message: errorMessage,
      stack: stackTrace,
      endpoint: context?.endpoint || window?.location?.pathname || '/',
      method: context?.method || 'CLIENT_EVENT',
      statusCode: context?.statusCode || 500,
      source,
      context: context || {},
      userId: auth.currentUser?.uid || 'anonymous_user',
      userEmail: auth.currentUser?.email || 'unauthenticated@playall365.com',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown Client',
      url: typeof window !== 'undefined' ? window.location.href : '',
      timestamp: now,
      timeLabel,
      severity: source === 'UNHANDLED_REJECTION' ? 'HIGH' : 'CRITICAL',
      status: 'NEW'
    };

    this.localErrors.unshift(errorRecord);
    if (this.localErrors.length > MAX_LOCAL_CACHE) {
      this.localErrors.pop();
    }
    this.saveCachedErrors();

    try {
      this.isReportingInProgress = true;
      const errorDocRef = doc(db, COLLECTION_NAME, errorId);
      await setDoc(errorDocRef, {
        ...errorRecord,
        createdAt: serverTimestamp()
      });
      console.info(`[SystemErrors] Runtime error logged to Firestore: ${errorId}`);
    } catch (err) {
      console.warn('[SystemErrors] Failed to upload runtime error to Firestore:', err);
    } finally {
      this.isReportingInProgress = false;
    }

    return errorRecord;
  }

  /**
   * Real-time listener for the Firestore 'SystemErrors' collection
   */
  public subscribeToSystemErrors(
    callback: (errors: SystemErrorRecord[]) => void,
    maxLimit: number = 30
  ): Unsubscribe {
    // If unauthenticated, immediately deliver local cached errors and subscribe locally
    if (!auth.currentUser) {
      callback(this.localErrors);
      return this.onLocalErrorsChange(callback);
    }

    try {
      const errorsCollection = collection(db, COLLECTION_NAME);
      const q = query(errorsCollection, orderBy('timestamp', 'desc'), limit(maxLimit));

      return onSnapshot(
        q,
        (snapshot) => {
          const errorList: SystemErrorRecord[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              name: data.name || 'SystemError',
              message: data.message || '',
              stack: data.stack || '',
              endpoint: data.endpoint || '',
              method: data.method || 'POST',
              statusCode: data.statusCode || 500,
              source: data.source || 'API_FETCH',
              context: data.context || {},
              userId: data.userId || 'anonymous',
              userEmail: data.userEmail || '',
              userAgent: data.userAgent || '',
              url: data.url || '',
              timestamp: data.timestamp || Date.now(),
              timeLabel: data.timeLabel || '',
              severity: data.severity || 'HIGH',
              status: data.status || 'NEW',
              resolvedAt: data.resolvedAt
            } as SystemErrorRecord;
          });

          // Merge with local list for instantaneous responsive UI
          if (errorList.length > 0) {
            this.localErrors = errorList;
            this.saveCachedErrors();
          }
          callback(errorList.length > 0 ? errorList : this.localErrors);
        },
        (_error) => {
          // Graceful fallback to local cache without spamming console
          callback(this.localErrors);
        }
      );
    } catch {
      callback(this.localErrors);
      return this.onLocalErrorsChange(callback);
    }
  }

  /**
   * Updates the status of a logged system error (e.g. mark as INVESTIGATING or RESOLVED)
   */
  public async updateErrorStatus(
    errorId: string,
    status: SystemErrorRecord['status']
  ): Promise<void> {
    // Update local cache
    this.localErrors = this.localErrors.map((err) =>
      err.id === errorId
        ? { ...err, status, resolvedAt: status === 'RESOLVED' ? Date.now() : undefined }
        : err
    );
    this.saveCachedErrors();

    // Update Firestore
    try {
      const docRef = doc(db, COLLECTION_NAME, errorId);
      await updateDoc(docRef, {
        status,
        resolvedAt: status === 'RESOLVED' ? Date.now() : null
      });
    } catch (err) {
      console.warn(`[SystemErrors] Could not update status in Firestore for ${errorId}:`, err);
    }
  }

  /**
   * Clears local system errors
   */
  public clearLocalErrors(): void {
    this.localErrors = [];
    this.saveCachedErrors();
  }

  /**
   * Helper to trigger a simulated API failure for testing the automated reporting pipeline
   */
  public async triggerTestApiFailure(): Promise<SystemErrorRecord | null> {
    const simulatedEndpoints = [
      '/api/seamless/v1/bet',
      '/api/seamless/v1/win',
      '/api/seamless/v1/rollback',
      '/api/cashier/bkash/deposit/verify',
      '/api/auth/token/refresh'
    ];
    const endpoint = simulatedEndpoints[Math.floor(Math.random() * simulatedEndpoints.length)];
    const statusCodes = [500, 502, 503, 504, 400, 429];
    const statusCode = statusCodes[Math.floor(Math.random() * statusCodes.length)];

    const error = new Error(`Simulated API Gateway Failure: HTTP ${statusCode} response returned from upstream provider gateway at ${endpoint}`);
    error.name = 'ApiGatewayException';

    return this.reportApiError({
      endpoint,
      method: 'POST',
      statusCode,
      error,
      context: {
        payload: {
          round_id: `rnd_sim_${Date.now()}`,
          amount: 500,
          currency: 'BDT',
          provider_id: 'PG_SOFT_SIMULATOR',
          trace_id: `trace_${Math.random().toString(36).substring(2, 9)}`
        },
        retryAttempt: 2,
        circuitBreakerOpen: statusCode === 503
      },
      severity: statusCode >= 500 ? 'CRITICAL' : 'HIGH'
    });
  }
}

export const errorReportingService = new ErrorReportingService();
