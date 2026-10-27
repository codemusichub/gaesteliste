import { useData } from '../data'
import type { Entry } from '../types'
import { euro, fmtDate, isOver, priceFor } from '../logic'
import { Empty, navigate } from '../ui'
import { exportEvent } from '../export'

type Person = { entry: Entry; ticketTypeId: string; at: number | null; price: number }

export function Dashboard({ eventId }: { eventId: string }) {
  const { eventMap, entries, ttMap, guestMap, stats } = useData()
  const ev = eventMap.get(eventId)
  if (!ev) return <div className="page-pad"><Empty>Veranstaltung nicht gefunden.</Empty></div>
  const list = entries.filter((e) => e.eventId === ev.id && e.status === 'approved')
  const people: Person[] = list.flatMap((e) => [
    { entry: e, ticketTypeId: e.ticketTypeId, at: e.checkedInAt, price: priceFor(ttMap.get(e.ticketTypeId), e.pay) },
    ...e.plus.map((p) => ({ entry: e, ticketTypeId: p.ticketTypeId, at: p.checkedInAt ?? null, price: priceFor(ttMap.get(p.ticketTypeId), p.pay) })),
  ])
  const came = people.filter((p) => p.at)
  const over = isOver(ev)
  const rate = people.length ? Math.round((came.length / people.length) * 100) : 0
  const revenue = came.reduce((s, p) => s + p.price, 0)

  // Ankünfte pro Stunde
  const hours = new Map<number, number>()
  came.forEach((p) => {
    const d = new Date(p.at!)
    d.setMinutes(0, 0, 0)
    hours.set(d.getTime(), (hours.get(d.getTime()) ?? 0) + 1)
  })
  const hourKeys = [...hours.keys()].sort((a, b) => a - b)
  const hourSlots: number[] = []
  if (hourKeys.length) for (let t = hourKeys[0]; t <= hourKeys[hourKeys.length - 1]; t += 3600000) hourSlots.push(t)
  const maxHour = Math.max(1, ...hours.values())

  const group = (key: (p: Person) => string) => {
    const m = new Map<string, { listed: number; came: number }>()
    people.forEach((p) => {
      const k = key(p)
      const v = m.get(k) ?? { listed: 0, came: 0 }
      v.listed++
      if (p.at) v.came++
      m.set(k, v)
    })
    return [...m.entries()].sort((a, b) => b[1].listed - a[1].listed)
  }
  const byTicket = group((p) => ttMap.get(p.ticketTypeId)?.name ?? '?')
  const byPromoter = group((p) => p.entry.addedBy || '–')
  const missing = list.filter((e) => !e.checkedInAt)

  return (
    <div className="page-pad">
      <div className="topbar">
        <button className="icon-btn" onClick={() => navigate(`/event/${ev.id}`)} aria-label="Zurück">‹</button>
        <div className="topbar-title"><h1>Dashboard</h1><div className="muted small">{ev.name} · {fmtDate(ev.date)}</div></div>
        <button className="icon-btn" onClick={() => exportEvent(ev.id)} aria-label="Excel-Export">⬇︎</button>
      </div>
      <div className="tiles">
        <div className="tile"><b>{people.length}</b><span>auf der Liste</span></div>
        <div className="tile ok"><b>{came.length}</b><span>da</span></div>
        <div className={'tile' + (over && people.length - came.length ? ' warn' : '')}><b>{people.length - came.length}</b><span>{over ? 'nicht gekommen' : 'noch offen'}</span></div>
        <div className="tile"><b>{rate} %</b><span>Anwesenheit</span></div>
        <div className="tile wide"><b>{euro(revenue)}</b><span>Einnahmen Gästeliste (eingecheckte Zahler)</span></div>
      </div>

      <h3>Ankünfte pro Stunde</h3>
      {hourSlots.length ? (
        <div className="hbars">
          {hourSlots.map((t) => {
            const n = hours.get(t) ?? 0
            const label = new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit' })
            return (
              <div key={t} className="hbar" title={`${label} Uhr: ${n} Personen`}>
                <span className="hbar-n">{n || ''}</span>
                <div className="hbar-col"><div style={{ height: `${(n / maxHour) * 100}%` }} /></div>
                <span className="hbar-l">{label}</span>
              </div>
            )
          })}
        </div>
      ) : (
        <Empty>Noch keine Check-ins.</Empty>
      )}

      <h3>Nach Ticketart</h3>
      <RateTable rows={byTicket} />
      <h3>Nach „Eingetragen von“</h3>
      <p className="muted small">Zeigt, wessen Gäste wirklich kommen.</p>
      <RateTable rows={byPromoter} />

      <h3>{over ? 'Nicht gekommen' : 'Noch nicht da'} ({missing.length})</h3>
      {missing.map((e) => {
        const g = guestMap.get(e.guestId)
        const s = stats.get(e.guestId)
        return (
          <div key={e.id} className="card guest-row" onClick={() => navigate(`/guest/${e.guestId}`)}>
            <div>
              <div className="name">{g?.lastName}, {g?.firstName}{e.plus.length ? ` +${e.plus.length}` : ''}</div>
              <div className="muted small">von {e.addedBy || '–'}</div>
            </div>
            {s && s.noShows > 0 && <span className="warn small">⚠ {s.noShows}× No-Show gesamt</span>}
          </div>
        )
      })}
    </div>
  )
}

function RateTable({ rows }: { rows: [string, { listed: number; came: number }][] }) {
  if (!rows.length) return <Empty>Keine Daten.</Empty>
  return (
    <div className="rate-table">
      {rows.map(([k, v]) => {
        const pct = v.listed ? Math.round((v.came / v.listed) * 100) : 0
        return (
          <div key={k} className="rate-row" title={`${k}: ${v.came} von ${v.listed} da (${pct} %)`}>
            <div className="rate-head">
              <span>{k}</span>
              <span className="muted">{v.came}/{v.listed} · <b>{pct} %</b></span>
            </div>
            <div className="bar"><span style={{ width: `${pct}%` }} /></div>
          </div>
        )
      })}
    </div>
  )
}
