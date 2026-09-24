import React, { Component, ReactNode, ErrorInfo } from 'react';
import { trackUiRenderError, DispatchedErrorInfo, extractComponentName } from './lib/diagnosticTracker';
import {
  AlertTriangle,
  RotateCcw,
  Home,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Activity,
  Radio,
  Bug
} from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  incidentInfo: DispatchedErrorInfo | null;
  isDispatching: boolean;
  showDetails: boolean;
  copied: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    incidentInfo: null,
    isDispatching: false,
    showDetails: false,
    copied: false
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo, isDispatching: true });

    // Automated error log tracker: Dispatches UI render errors to diagnostic endpoint
    trackUiRenderError(error, errorInfo, {
      severity: 'error',
      additionalContext: {
        boundaryScope: this.props.componentName || 'RootAppBoundary'
      }
    }).then((incident) => {
      this.setState({ incidentInfo: incident, isDispatching: false });
    }).catch((err) => {
      console.error('[ErrorBoundary] Telemetry tracker encountered error:', err);
      this.setState({ isDispatching: false });
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      incidentInfo: null,
      isDispatching: false,
      showDetails: false
    });
  };

  handleCopyReport = () => {
    const { error, errorInfo, incidentInfo } = this.state;
    const report = {
      incidentId: incidentInfo?.incidentId || 'UNREGISTERED',
      timestamp: incidentInfo?.timestamp || new Date().toISOString(),
      component: incidentInfo?.componentName || extractComponentName(errorInfo?.componentStack || undefined, error?.stack),
      url: window.location.href,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack
    };

    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.state.error ? this.props.fallback(this.state.error, this.handleReset) : null;
        }
        return this.props.fallback;
      }

      const { error, errorInfo, incidentInfo, isDispatching, showDetails, copied } = this.state;
      const detectedComponent = incidentInfo?.componentName || extractComponentName(errorInfo?.componentStack || undefined, error?.stack);
      const incidentCode = incidentInfo?.incidentId || 'LOGGING...';

      return (
        <div className="min-h-screen bg-zinc-950 text-zinc-200 p-4 sm:p-6 md:p-12 flex flex-col items-center justify-center font-sans antialiased selection:bg-rose-500/30 selection:text-rose-200">
          {/* Ambient Glow */}
          <div className="fixed inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
            <div className="w-[600px] h-[600px] bg-rose-600/5 rounded-full blur-[140px]" />
          </div>

          <div className="max-w-2xl w-full bg-zinc-900/90 backdrop-blur-xl border border-rose-500/20 shadow-2xl rounded-3xl p-6 sm:p-8 space-y-6 relative z-10">
            {/* Header / Tracker Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800/80">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 shadow-inner">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    UI Render Exception Intercepted
                  </h1>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Automated error tracker caught an invisible component failure
                  </p>
                </div>
              </div>

              {/* Diagnostic Dispatch Status Badge */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <div className="px-3 py-1 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-mono flex items-center gap-2">
                  <Radio className={`w-3.5 h-3.5 ${isDispatching ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`} />
                  <span className="text-zinc-400">Tracker:</span>
                  <span className="text-white font-semibold">{incidentCode}</span>
                </div>
              </div>
            </div>

            {/* Incident Alert Details */}
            <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Bug className="w-3.5 h-3.5" /> Failing Component: &lt;{detectedComponent}&gt;
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {incidentInfo?.timestamp ? new Date(incidentInfo.timestamp).toLocaleTimeString() : 'Just now'}
                </span>
              </div>
              <div className="p-3 bg-zinc-950/80 rounded-xl border border-zinc-800/80 font-mono text-xs text-rose-300 break-words leading-relaxed">
                {error?.message || 'Component failed to render tree properly'}
              </div>
            </div>

            {/* Automated Telemetry Status Callout */}
            <div className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-zinc-300">
                  Render telemetry log automatically dispatched to backend diagnostics endpoint.
                </span>
              </div>
              <button
                onClick={this.handleCopyReport}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                title="Copy Diagnostic JSON Report"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Log'}</span>
              </button>
            </div>

            {/* Technical Stack Trace Collapse */}
            <div className="border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-950/40">
              <button
                type="button"
                onClick={() => this.setState({ showDetails: !showDetails })}
                className="w-full px-4 py-2.5 flex items-center justify-between text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40 transition-colors"
              >
                <span className="font-medium">Technical Diagnostic Trace</span>
                {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showDetails && (
                <div className="p-4 border-t border-zinc-800/80 space-y-3 font-mono text-[11px]">
                  {errorInfo?.componentStack && (
                    <div>
                      <div className="text-zinc-400 font-semibold mb-1 text-[10px] uppercase tracking-wider">React Component Tree:</div>
                      <pre className="p-2.5 bg-zinc-950 rounded-lg text-amber-300/90 overflow-x-auto border border-zinc-800 whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                  {error?.stack && (
                    <div>
                      <div className="text-zinc-400 font-semibold mb-1 text-[10px] uppercase tracking-wider">JS Exception Stack:</div>
                      <pre className="p-2.5 bg-zinc-950 rounded-lg text-zinc-400 overflow-x-auto border border-zinc-800 whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Recovery Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs rounded-xl border border-zinc-700 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <span>Recover Component</span>
              </button>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-rose-600/20"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reload Page</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  window.location.href = '/';
                }}
                className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium text-xs rounded-xl border border-zinc-800 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-4 h-4 text-zinc-400" />
                <span>Home Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
