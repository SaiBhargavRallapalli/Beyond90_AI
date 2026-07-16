'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Optional custom fallback UI. Defaults to a styled error card. */
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * React error boundary that catches rendering errors in the component tree.
 *
 * Prevents a single failed subtree from crashing the entire page.
 * All errors are caught silently in production; the user sees a recovery prompt.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // In a real deployment, send to an observability service (Sentry, Datadog, etc.)
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, message: '' });
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="flex flex-col items-center justify-center gap-4 rounded-xl border border-red-800/60 bg-[#1a0a0a] p-8 text-center"
        >
          <p className="text-lg font-semibold text-red-400">Something went wrong</p>
          <p className="max-w-sm text-sm text-gray-400">
            An unexpected error occurred in this section. Your other pages are unaffected.
          </p>
          <button
            onClick={this.handleReset}
            className="rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-medium text-black hover:bg-[#b8943e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
