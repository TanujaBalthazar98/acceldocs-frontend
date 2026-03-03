/**
 * Error Boundary Component
 * 
 * Catches React errors and displays a fallback UI
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to error tracking service (e.g., Sentry, PostHog)
    // You can add your error tracking here
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback error={this.state.error} onReset={this.handleReset} onGoHome={this.handleGoHome} />;
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
  onGoHome: () => void;
}

function ErrorFallback({ error, onReset, onGoHome }: ErrorFallbackProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-lg border border-destructive/50 bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred. Please try again.
            </p>
          </div>
        </div>

        {process.env.NODE_ENV === 'development' && error && (
          <div className="mt-4 p-3 rounded-md bg-muted text-xs font-mono overflow-auto max-h-40">
            <div className="font-semibold mb-1">Error:</div>
            <div className="text-destructive">{error.message}</div>
            {error.stack && (
              <>
                <div className="font-semibold mt-2 mb-1">Stack:</div>
                <div className="text-muted-foreground whitespace-pre-wrap">{error.stack}</div>
              </>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button onClick={onReset} variant="default" className="flex-1">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          <Button onClick={onGoHome} variant="outline" className="flex-1">
            <Home className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </div>

        <div className="text-xs text-muted-foreground text-center pt-2">
          If this problem persists, please contact support.
        </div>
      </div>
    </div>
  );
}

export default ErrorBoundary;
