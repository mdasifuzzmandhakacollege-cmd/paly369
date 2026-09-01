/**
 * @file ErrorBoundary.tsx
 * @description React Error Boundary to catch render-time exceptions,
 * prevent blank white screens, log crashes into errorReportingService,
 * and provide user-friendly one-click recovery.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RotateCcw, Home, ShieldAlert } from 'lucide-react';
import { errorReportingService } from '../services/errorReportingService';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught error:', error, errorInfo);
    this.setState({ errorInfo });

    try {
      errorReportingService.reportApiError({
        endpoint: 'React.ErrorBoundary',
        method: 'RENDER',
        statusCode: 500,
        error,
        context: {
          componentStack: errorInfo.componentStack
        },
        severity: 'HIGH'
      });
    } catch {
      // Ignore logging failure to prevent double faults
    }
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  private handleGoHome = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = window.location.pathname;
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] w-full flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md rounded-2xl border border-rose-500/30 my-4 text-slate-100">
          <div className="max-w-xl w-full text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400 shadow-lg shadow-rose-500/10 animate-pulse">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight font-bengali">
                {this.props.fallbackTitle || 'অ্যাপ্লিকেশন রেন্ডারিং ব্যহত হয়েছে'}
              </h2>
              <p className="text-sm text-slate-400 font-mono">
                Component rendering encountered an unexpected exception. A fallback state was loaded to prevent a blank screen.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-900 border border-rose-500/20 rounded-xl p-3.5 text-left font-mono text-xs text-rose-300 overflow-x-auto max-h-32">
                <span className="font-bold text-rose-400">Error:</span> {this.state.error.message}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold text-xs flex items-center space-x-2 shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer font-bengali"
              >
                <RotateCcw className="w-4 h-4" />
                <span>পুনরায় চেষ্টা করুন (Retry)</span>
              </button>

              <button
                onClick={this.handleGoHome}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center space-x-2 transition-all cursor-pointer font-bengali"
              >
                <Home className="w-4 h-4 text-emerald-400" />
                <span>হোমপেজে ফিরে যান (Lobby)</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
