import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  props: ErrorBoundaryProps;
  state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 text-rose-400 p-8 flex flex-col items-center justify-center font-mono text-xs">
          <div className="max-w-md w-full bg-zinc-900 border border-rose-900/50 p-6 rounded-2xl space-y-4">
            <h1 className="text-sm font-bold text-rose-500 uppercase tracking-wider">Frontend Error Encountered</h1>
            <p className="text-zinc-400">An unhandled exception occurred in the component tree:</p>
            <pre className="p-3 bg-zinc-950 rounded-lg text-[11px] text-zinc-300 overflow-x-auto border border-zinc-800 whitespace-pre-wrap">
              {this.state.error?.toString() || 'Unknown Error'}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl transition-all cursor-pointer font-sans font-medium text-xs"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}


