import { useEffect, type ReactNode } from 'react'
import type { TicketType } from './types'
import { useData } from './data'

export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    document.body.classList.add('noscroll')
    return () => document.body.classList.remove('noscroll')
  }, [])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Schließen">✕</button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function TicketBadge({ tt, prefix }: { tt?: TicketType; prefix?: string }) {
  return (
    <span className="badge" style={{ ['--c' as string]: tt?.color ?? '#888' }}>
      {prefix}
      {tt?.name ?? '?'}
    </span>
  )
}

export function SyncBadge() {
  const { online, pending } = useData()
  if (!online) return <span className="sync off">● Offline</span>
  if (pending) return <span className="sync wait">● Sync…</span>
  return <span className="sync ok">● Live</span>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  )
}

export function Chips<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button type="button" key={o.value} className={'chip' + (o.value === value ? ' on' : '')} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function navigate(hash: string) {
  location.hash = hash
}

export function OfflineBanner() {
  const { online, pending } = useData()
  if (online) return null
  return (
    <div className="offline-banner">
      Kein Internet. Du kannst normal weiterarbeiten{pending ? ', Änderungen werden gesendet' : ', alles wird abgeglichen'}, sobald wieder Netz da ist.
    </div>
  )
}
