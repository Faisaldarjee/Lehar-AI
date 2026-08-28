import { Component, Suspense } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Short human label for the view being guarded, e.g. "Fleet Map". */
  label?: string;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message?: string;
}

/**
 * Reusable error boundary. Wrap each view/visualization so one component that
 * throws (a bad chart, a WebGL failure) degrades locally instead of blanking
 * the whole app.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error?.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? ` · ${this.props.label}` : ''}]`, error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex-1 w-full h-full min-h-[220px] flex flex-col items-center justify-center gap-3 p-6 text-center bg-abyssal-950/80 rounded-2xl border border-red-500/20">
          <div className="p-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-sm">
            <h4 className="text-sm font-bold text-white font-heading">
              {this.props.label ? `${this.props.label} failed to render` : 'This view failed to render'}
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              {this.state.message || 'An unexpected rendering error occurred. Other views remain available.'}
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-1 px-3 py-1.5 rounded-lg bg-abyssal-900 hover:bg-abyssal-850 border border-abyssal-800 text-xs text-slate-200 hover:text-white transition cursor-pointer active:scale-95"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Lightweight loading placeholder shown while a lazily-loaded view chunk downloads. */
export function ViewLoading({ label }: { label?: string }) {
  return (
    <div className="flex-1 w-full h-full min-h-[220px] flex flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="w-9 h-9 rounded-full border-2 border-ocean-cyan/30 border-t-ocean-cyan animate-spin" />
      <p className="text-xs text-slate-400 font-mono">Loading {label || 'view'}…</p>
    </div>
  );
}

/**
 * Convenience wrapper combining an ErrorBoundary with a Suspense boundary so a
 * lazily-loaded, potentially-throwing view is guarded in one place.
 */
export function ViewBoundary({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <ErrorBoundary label={label}>
      <Suspense fallback={<ViewLoading label={label} />}>{children}</Suspense>
    </ErrorBoundary>
  );
}
