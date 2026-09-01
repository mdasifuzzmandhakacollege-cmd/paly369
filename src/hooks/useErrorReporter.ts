/**
 * @file useErrorReporter.ts
 * @description Automated React Error Reporting Hook for App.tsx.
 * Captures API failure stack traces, network rejections, and global exceptions,
 * automatically pushing structured error records to the Firestore 'SystemErrors' collection.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  errorReportingService,
  SystemErrorRecord,
  ApiErrorReportParams
} from '../services/errorReportingService';
import { seamlessEngine } from '../services/simulatedWalletEngine';

export interface UseErrorReporterReturn {
  errors: SystemErrorRecord[];
  errorCount: number;
  newErrorsCount: number;
  lastReportedError: SystemErrorRecord | null;
  reportApiError: (params: ApiErrorReportParams) => Promise<SystemErrorRecord | null>;
  reportCustomError: (error: unknown, context?: Record<string, any>) => Promise<SystemErrorRecord | null>;
  triggerTestError: () => Promise<SystemErrorRecord | null>;
  resolveError: (errorId: string) => Promise<void>;
  markInvestigating: (errorId: string) => Promise<void>;
  clearLocalErrors: () => void;
}

export function useErrorReporter(): UseErrorReporterReturn {
  const [errors, setErrors] = useState<SystemErrorRecord[]>(() =>
    errorReportingService.getRecentErrors()
  );
  const [lastReportedError, setLastReportedError] = useState<SystemErrorRecord | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    let unsubscribeFirestore: (() => void) | null = null;

    const setupFirestoreSub = () => {
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
      unsubscribeFirestore = errorReportingService.subscribeToSystemErrors((liveErrors) => {
        if (isMountedRef.current) {
          setErrors(liveErrors);
          if (liveErrors.length > 0) {
            setLastReportedError(liveErrors[0]);
          }
        }
      }, 40);
    };

    // 1. Initial subscription and listen to Auth state changes
    setupFirestoreSub();
    const unsubscribeAuth = onAuthStateChanged(auth, () => {
      setupFirestoreSub();
    });

    // 2. Global Unhandled Window Error Listener
    const handleGlobalError = (event: ErrorEvent) => {
      const errorObj = event.error || new Error(event.message || 'Unknown Global Window Error');
      errorReportingService.reportSystemError(errorObj, 'UNHANDLED_ERROR', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        endpoint: window?.location?.pathname || '/'
      });
    };

    // 3. Global Unhandled Promise Rejection Listener
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const errorObj =
        reason instanceof Error
          ? reason
          : new Error(typeof reason === 'string' ? reason : JSON.stringify(reason));
      
      errorReportingService.reportSystemError(errorObj, 'UNHANDLED_REJECTION', {
        endpoint: window?.location?.pathname || '/',
        type: 'PromiseRejection'
      });
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // 4. Connect to Seamless Wallet Engine SQL/API Failure Events
    const unsubscribeEngine = seamlessEngine.onSqlQueryRecorded((logs) => {
      const failedLogs = logs.filter((l) => l.status !== 'SUCCESS' || (l.affectedRows === 0 && l.commandType === 'LOCK'));
      if (failedLogs.length > 0) {
        const errLog = failedLogs[0];
        const engineError = new Error(`Seamless Engine Error during ${errLog.commandType} (${errLog.status}) on table '${errLog.table}': ${errLog.statement}`);
        engineError.name = 'SeamlessEngineException';

        errorReportingService.reportApiError({
          endpoint: `/engine/${errLog.table}/${errLog.commandType.toLowerCase()}`,
          method: 'SQL_MUTATION',
          statusCode: 500,
          error: engineError,
          context: {
            statement: errLog.statement,
            durationMs: errLog.durationMs,
            source: errLog.source,
            engineStatus: errLog.status
          },
          severity: 'HIGH'
        });
      }
    });

    return () => {
      isMountedRef.current = false;
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
      unsubscribeAuth();
      unsubscribeEngine();
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const reportApiError = useCallback(async (params: ApiErrorReportParams) => {
    return errorReportingService.reportApiError(params);
  }, []);

  const reportCustomError = useCallback(async (error: unknown, context?: Record<string, any>) => {
    return errorReportingService.reportSystemError(error, 'MANUAL_REPORT', context);
  }, []);

  const triggerTestError = useCallback(async () => {
    return errorReportingService.triggerTestApiFailure();
  }, []);

  const resolveError = useCallback(async (errorId: string) => {
    await errorReportingService.updateErrorStatus(errorId, 'RESOLVED');
  }, []);

  const markInvestigating = useCallback(async (errorId: string) => {
    await errorReportingService.updateErrorStatus(errorId, 'INVESTIGATING');
  }, []);

  const clearLocalErrors = useCallback(() => {
    errorReportingService.clearLocalErrors();
    setErrors([]);
  }, []);

  const newErrorsCount = errors.filter((e) => e.status === 'NEW').length;

  return {
    errors,
    errorCount: errors.length,
    newErrorsCount,
    lastReportedError,
    reportApiError,
    reportCustomError,
    triggerTestError,
    resolveError,
    markInvestigating,
    clearLocalErrors
  };
}
