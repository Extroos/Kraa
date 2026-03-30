import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui';
import { AlertCircle, RefreshCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorDetails = null;
      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          errorDetails = (
            <div className="mt-6 p-4 bg-red-50 border border-red-100 text-red-800 rounded-xl text-sm font-mono text-left overflow-auto max-h-64 scrollbar-hide">
              <div className="flex flex-col gap-1">
                {parsed.operationType && <p><span className="opacity-60">Operation:</span> {parsed.operationType}</p>}
                {parsed.path && <p><span className="opacity-60">Path:</span> {parsed.path}</p>}
                {parsed.error && <p className="mt-2 text-red-900 font-bold">{parsed.error}</p>}
              </div>
            </div>
          );
        }
      } catch (e) {
        errorDetails = (
          <div className="mt-6 p-4 bg-red-50 border border-red-100 text-red-800 rounded-xl text-sm font-mono text-left overflow-auto max-h-64 scrollbar-hide">
             {this.state.error?.message}
          </div>
        );
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-100">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-gray-600 leading-relaxed">
              We encountered an unexpected error. Please try reloading the application or contact support if the issue persists.
            </p>
            {errorDetails}
            <Button
              onClick={() => window.location.reload()}
              icon={RefreshCcw}
              className="mt-8 w-full"
            >
              Reload Application
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
