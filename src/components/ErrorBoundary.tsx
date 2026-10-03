import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time crashes in any page/component below it so a bug in one
 * screen (e.g. a malformed imported guide) shows a recoverable error message
 * instead of a blank white screen.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Study Hub crashed:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 text-center">
        <p className="text-4xl">⚠️</p>
        <p className="mt-3 text-lg font-semibold">Something went wrong</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {error.message || 'An unexpected error occurred while rendering this page.'}
        </p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={this.handleReset}
            className="rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-2 font-medium text-slate-800 dark:text-slate-200"
          >
            Try again
          </button>
          <a
            href="#/"
            onClick={this.handleReset}
            className="rounded-lg bg-sky-500 px-4 py-2 font-semibold text-slate-950"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    );
  }
}
