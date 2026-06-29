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
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-6 text-[var(--text)]">
          <div className="max-w-lg space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="text-sm text-[var(--muted)]">{this.state.error.message}</p>
            <button
              type="button"
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
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
