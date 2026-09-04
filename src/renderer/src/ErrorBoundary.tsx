import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Without this, an uncaught error anywhere in the tree (e.g. the preload
 * bridge failing to load, so `window.copilotDesktop` is undefined) unmounts
 * the whole app silently — just a blank window, no indication anything
 * went wrong.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Unhandled renderer error:', error, info.componentStack);
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <pre className="mono">{this.state.error.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
