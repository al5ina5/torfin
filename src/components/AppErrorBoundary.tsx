import { Component, type ErrorInfo, type ReactNode } from 'react'

import { reportClientError } from '../lib/error-reporting'

type Props = {
  children: ReactNode
}

type State = {
  error: Error | null
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    void reportClientError({
      kind: 'react',
      message: error.message,
      name: error.name,
      stack: error.stack,
      componentStack: info.componentStack || undefined,
    })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="movie-empty-enter flex min-h-screen flex-col items-center justify-center bg-[var(--mac-window)] px-6 py-12 text-[var(--mac-text)]">
          <div className="flex max-w-xs flex-col items-center text-center">
            <img
              src="/sad-mac.jpg"
              alt=""
              width={120}
              height={160}
              className="mb-5 select-none"
              draggable={false}
            />
            <h1 className="text-[15px] font-semibold tracking-tight">This app is broken.</h1>
            <p className="mt-2 text-[13px] leading-5 text-[var(--mac-secondary)]">
              The hamsters stopped running. A restart might help — no promises though.
            </p>
            {this.state.error.message ? (
              <p className="mt-4 max-w-full truncate font-mono text-[11px] text-[var(--mac-tertiary)]" title={this.state.error.message}>
                {this.state.error.message}
              </p>
            ) : null}
            <button
              type="button"
              className="mt-6 h-8 rounded-md bg-[var(--mac-accent)] px-4 text-[12px] font-semibold text-white transition hover:opacity-90"
              onClick={() => window.location.reload()}
            >
              Reload app
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
