import { Copy, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

import { toast } from '../lib/toast'

type SecretInputProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  id?: string
}

const iconButtonClass =
  'grid size-6 place-items-center rounded text-[var(--mac-secondary)] transition hover:bg-[var(--mac-control-hover)] hover:text-[var(--mac-text)] disabled:opacity-40'

export function SecretInput({ value, onChange, placeholder, id }: SecretInputProps) {
  const [visible, setVisible] = useState(false)

  const handleCopy = async () => {
    if (!value.trim()) return
    try {
      await navigator.clipboard.writeText(value)
      toast.success('API key copied')
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  return (
    <div className="relative">
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        className="h-8 w-full rounded-md border border-[var(--mac-border)] bg-[var(--mac-control)] py-0 pl-2 pr-16 text-[12px] outline-none focus:border-[var(--mac-accent)]"
      />
      <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          disabled={!value}
          aria-label={visible ? 'Hide API key' : 'Show API key'}
          title={visible ? 'Hide' : 'Show'}
          className={iconButtonClass}
        >
          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        <button
          type="button"
          onClick={() => void handleCopy()}
          disabled={!value.trim()}
          aria-label="Copy API key"
          title="Copy"
          className={iconButtonClass}
        >
          <Copy size={14} />
        </button>
      </div>
    </div>
  )
}
