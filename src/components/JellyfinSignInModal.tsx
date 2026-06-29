import { useState } from 'react'

import { AppModal } from './AppModal'

type JellyfinSignInModalProps = {
  open: boolean
  loading?: boolean
  onClose: () => void
  onSubmit: (username: string, password: string) => void
}

export function JellyfinSignInModal({ open, loading = false, onClose, onSubmit }: JellyfinSignInModalProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  return (
    <AppModal open={open} title="Jellyfin Sign In" onClose={onClose} className="w-[min(440px,calc(100vw-32px))]">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(username.trim(), password)
        }}
      >
        <label className="grid gap-1 text-sm">
          Username
          <input value={username} onChange={(event) => setUsername(event.target.value)} className="rounded-md border px-2 py-1.5" required />
        </label>
        <label className="grid gap-1 text-sm">
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="rounded-md border px-2 py-1.5" required />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="rounded-md border px-3 py-1.5 text-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={loading} className="rounded-md bg-[var(--mac-accent)] px-3 py-1.5 text-sm text-white disabled:opacity-60">
            {loading ? 'Signing In…' : 'Sign In'}
          </button>
        </div>
      </form>
    </AppModal>
  )
}
