import { useMemo, useState } from 'react'
import { actions, useData } from '../data'
import type { Entry } from '../types'
import { fmtDate } from '../logic'
import { Sheet } from '../ui'

// Gäste einer früheren Veranstaltung in die aktuelle übernehmen (inkl. Ticketart und Begleitung).
export function ImportSheet({ targetId, onClose }: { targetId: string; onClose: () => void }) {
  const { events, entries, guestMap, stats } = useData()
  const others = events.filter((e) => e.id !== targetId)
  const [srcId, setSrc] = useState(others[0]?.id ?? '')
  const existing = useMemo(() => new Set(entries.filter((e) => e.eventId === targetId).map((e) => e.guestId)), [entries, targetId])
  const source = entries.filter((e) => e.eventId === srcId && e.status === 'approved' && !existing.has(e.guestId))
  const [sel, setSel] = useState<Set<string>>(new Set())

  const run = () => {
    source
      .filter((e) => sel.has(e.id))
      .forEach((e) => {
        const copy: Entry = {
          ...e,
          id: actions.newId('entries'),
          eventId: targetId,
          checkedInAt: null,
          checkedInBy: undefined,
          plus: e.plus.map((p) => ({ ...p, checkedInAt: null })),
          createdAt: Date.now(),
        }
        actions.saveEntry(copy)
      })
    onClose()
  }

  return (
    <Sheet
      title="Gäste übernehmen"
      onClose={onClose}
      footer={<button className="btn primary grow" disabled={!sel.size} onClick={run}>{sel.size} übernehmen</button>}
    >
      <select value={srcId} onChange={(e) => (setSrc(e.target.value), setSel(new Set()))}>
        {others.map((e) => <option key={e.id} value={e.id}>{e.name} · {fmtDate(e.date)}</option>)}
      </select>
      <div className="chips">
        <button className="chip" onClick={() => setSel(new Set(source.map((e) => e.id)))}>Alle</button>
        <button className="chip" onClick={() => setSel(new Set(source.filter((e) => e.checkedInAt).map((e) => e.id)))}>Nur die, die da waren</button>
        <button className="chip" onClick={() => setSel(new Set())}>Keine</button>
      </div>
      {source.map((e) => {
        const g = guestMap.get(e.guestId)
        const s = stats.get(e.guestId)
        return (
          <label key={e.id} className="check-row">
            <input type="checkbox" checked={sel.has(e.id)} onChange={(x) => {
              const n = new Set(sel)
              if (x.target.checked) n.add(e.id)
              else n.delete(e.id)
              setSel(n)
            }} />
            <span>{g?.firstName} {g?.lastName}{e.plus.length ? ` +${e.plus.length}` : ''}</span>
            {s && s.noShows > 0 && <span className="warn small">⚠ {s.noShows}× No-Show</span>}
          </label>
        )
      })}
      {!source.length && <p className="muted">Keine weiteren Gäste in dieser Veranstaltung.</p>}
    </Sheet>
  )
}
