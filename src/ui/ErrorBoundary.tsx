import React from "react";

/**
 * Last line of defence for render-time throws.
 *
 * Without one, ANY exception thrown while rendering — in a panel, a preset
 * definition, an overlay layer — unmounts the whole tree and leaves a
 * permanently blank window whose only recovery is restarting the app. The
 * global `unhandledrejection` handler in App.tsx already catches the async
 * half; this is the synchronous half.
 *
 * Deliberately dependency-free and defensive: it must not itself be able to
 * throw. Recovery is offered in-place (re-mount the tree) so a transient
 * render error doesn't cost the user their session.
 */
interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Keep the component stack — it is the only breadcrumb for a render throw.
    console.error("[render error]", error, info.componentStack);
  }

  private retry = (): void => {
    this.setState({ error: null });
  };

  private reload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="crash-screen" role="alert">
        <h1>Something broke while drawing the interface</h1>
        <p className="crash-sub">
          Your work is autosaved. Try again — if it keeps happening, reload, and please report the
          details below.
        </p>
        <pre className="crash-detail">{error.message || String(error)}</pre>
        <div className="crash-actions">
          <button className="btn-primary" onClick={this.retry}>
            Try again
          </button>
          <button className="ghost-btn" onClick={this.reload}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
